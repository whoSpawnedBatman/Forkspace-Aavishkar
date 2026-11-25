import asyncio
import json
import os
from contextlib import asynccontextmanager
from html import escape
from pathlib import Path
from typing import Annotated, Literal
from uuid import UUID, uuid4

import httpx
import psycopg
import yaml
from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import (
    HTMLResponse,
    JSONResponse,
    PlainTextResponse,
    StreamingResponse,
)
from pygments import highlight
from pygments.formatters import HtmlFormatter
from pygments.lexers import TextLexer, get_lexer_for_filename
from pygments.util import ClassNotFound
from starlette.exceptions import HTTPException as StarletteHTTPException
from pydantic import ValidationError

from models import CreateSnippet, GrantAccess
from database import connect, migrate


@asynccontextmanager
async def lifespan(app):
    await asyncio.to_thread(migrate)
    yield


app = FastAPI(title="Forkspace", version="0.2.0", lifespan=lifespan)
app.openapi_schema = yaml.safe_load(
    Path(__file__).with_name("openapi.yaml").read_text("utf-8")
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ["FRONTEND_ORIGIN"].split(","),
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.middleware("http")
async def response_headers(request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    if not request.url.path.startswith("/embed/"):
        response.headers["X-Frame-Options"] = "DENY"
    return response


AUTH_URL = os.environ["SUPABASE_AUTH_URL"].rstrip("/")
PUBLISHABLE_KEY = os.environ["SUPABASE_PUBLISHABLE_KEY"]
if not AUTH_URL or not PUBLISHABLE_KEY:
    raise RuntimeError("Set SUPABASE_AUTH_URL and SUPABASE_PUBLISHABLE_KEY")


def problem(status: int, code: str, message: str) -> HTTPException:
    return HTTPException(status, {"code": code, "message": message})


@app.exception_handler(StarletteHTTPException)
async def http_error(request, exc):
    detail = exc.detail
    if not isinstance(detail, dict):
        code = "not_found" if exc.status_code == 404 else "method_not_allowed"
        detail = {"code": code, "message": str(exc.detail)}
    return JSONResponse(
        {"error": detail}, exc.status_code, headers={"Cache-Control": "no-store"}
    )


@app.exception_handler(RequestValidationError)
@app.exception_handler(ValidationError)
async def invalid_input(request, exc):
    details = []
    for issue in exc.errors():
        field = ".".join(
            str(part) for part in issue["loc"] if part not in ("query", "body")
        )
        details.append({"field": field or "body", "message": issue["msg"]})
    return JSONResponse(
        {
            "error": {
                "code": "invalid_input",
                "message": "Invalid request.",
                "details": details,
            }
        },
        422,
    )


@app.exception_handler(psycopg.Error)
@app.exception_handler(httpx.RequestError)
async def service_error(request, exc):
    return JSONResponse(
        {"error": {"code": "service_error", "message": "Service unavailable."}}, 500
    )


def unauthorized():
    return problem(401, "unauthorized", "A valid sign-in is required.")


def caller(request: Request) -> UUID | None:
    header = request.headers.get("authorization")
    if header is None:
        return None
    parts = header.split()
    if (
        len(parts) != 2
        or parts[0].lower() != "bearer"
        or not parts[1].isascii()
        or not parts[1].isprintable()
    ):
        raise unauthorized()
    result = httpx.get(
        f"{AUTH_URL}/user",
        headers={
            "apikey": PUBLISHABLE_KEY,
            "Authorization": f"Bearer {parts[1]}",
        },
        timeout=5,
    )
    if result.status_code in (400, 401, 403):
        raise unauthorized()
    if result.status_code != 200:
        raise problem(500, "service_error", "Identity verification unavailable.")
    try:
        return UUID(result.json()["id"])
    except (ValueError, KeyError, TypeError, AttributeError):
        raise problem(
            500, "service_error", "Invalid response from identity provider."
        ) from None


Caller = Annotated[UUID | None, Depends(caller)]


async def read_body(request: Request) -> CreateSnippet:
    body = bytearray()
    async for chunk in request.stream():
        if len(body) + len(chunk) > 1048576:
            raise problem(413, "payload_too_large", "Request exceeds 1 MiB.")
        body.extend(chunk)
    return CreateSnippet.model_validate_json(body)


def require_user(user):
    if user is None:
        raise unauthorized()
    return user


def readable(db, id, user, *, owner=False, lock=False):
    predicate = (
        "s.owner_id = %s"
        if owner
        else """(s.visibility IN ('public','unlisted') OR s.owner_id = %s OR
                 EXISTS (
                    SELECT 1 FROM snippet_access a
                    WHERE a.snippet_id=s.id AND a.user_id=%s))"""
    )
    row = db.execute(
        "SELECT s.* FROM snippets s WHERE s.id = %s AND "
        + predicate
        + (" FOR UPDATE" if lock else " FOR SHARE"),
        (id, user) if owner else (id, user, user),
    ).fetchone()
    if row is None:
        raise problem(404, "not_found", "Snippet not found.")
    return row


def save_files(db, snippet_id, files):
    with db.cursor() as cursor:
        cursor.executemany(
            "INSERT INTO snippet_files (snippet_id, position, path, content) VALUES (%s,%s,%s,%s)",
            [
                (snippet_id, pos, file.path, file.content)
                for pos, file in enumerate(files)
            ],
        )


@app.post("/snippets", status_code=201)
def create_snippet(user: Caller, data: Annotated[CreateSnippet, Depends(read_body)]):
    require_user(user)
    snippet_id = uuid4()
    with connect() as db:
        db.execute(
            "INSERT INTO snippets (id, owner_id, title, tags, visibility) VALUES (%s,%s,%s,%s,%s)",
            (snippet_id, user, data.title, data.tags, data.visibility),
        )
        save_files(db, snippet_id, data.files)
    return {"id": snippet_id}


SUMMARY = """SELECT s.id, s.title, s.tags, s.visibility, s.created_at, s.updated_at,
                    CASE WHEN EXISTS (SELECT 1 FROM snippets p WHERE p.id = s.parent_snippet_id
                                      AND (p.visibility = 'public' OR p.owner_id = %s))
                         THEN s.parent_snippet_id ELSE NULL END AS parent_snippet_id,
                    (SELECT count(*) FROM snippet_files WHERE snippet_id = s.id) AS file_count
             FROM snippets s """


@app.get("/snippets")
def list_snippets(
    user: Caller,
    response: Response,
    scope: Literal["public", "mine", "shared"] = "public",
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    tag: str | None = Query(None, min_length=1, max_length=32),
    q: str | None = Query(None, min_length=1, max_length=200),
):
    if scope in ("mine", "shared") and user is None:
        raise unauthorized()
    predicate = {
        "public": "WHERE s.visibility = 'public'",
        "mine": "WHERE s.owner_id = %s",
        "shared": """WHERE s.visibility = 'private' AND EXISTS (
            SELECT 1 FROM snippet_access a WHERE a.snippet_id=s.id AND a.user_id=%s)""",
    }[scope]
    params = [user] if scope == "public" else [user, user]
    if tag is not None:
        predicate += " AND %s = ANY(s.tags)"
        params.append(tag.strip().lower())
    if q is not None:
        # shortcut: computed search over the demo dataset, add maintained vectors when measured load requires it.
        predicate += """ AND to_tsvector('simple', s.title || ' ' ||
            COALESCE((SELECT string_agg(content, ' ' ORDER BY position)
                      FROM snippet_files WHERE snippet_id = s.id), ''))
            @@ plainto_tsquery('simple', %s)"""
        params.append(q.strip())
    params.extend([limit, offset])
    with connect() as db:
        items = db.execute(
            SUMMARY
            + predicate
            + " ORDER BY s.created_at DESC, s.id DESC LIMIT %s OFFSET %s",
            params,
        ).fetchall()
    response.headers["Cache-Control"] = "no-store"
    return {"items": items}


@app.get("/snippets/{id}")
def read_snippet(id: UUID, user: Caller, response: Response):
    with connect() as db:
        readable(db, id, user)
        row = db.execute(SUMMARY + "WHERE s.id = %s", (user, id)).fetchone()
        row["files"] = db.execute(
            "SELECT path, content FROM snippet_files WHERE snippet_id = %s ORDER BY position",
            (id,),
        ).fetchall()
    response.headers["Cache-Control"] = "no-store"
    return row


@app.put("/snippets/{id}")
def replace_snippet(
    id: UUID, user: Caller, data: Annotated[CreateSnippet, Depends(read_body)]
):
    require_user(user)
    with connect() as db:
        readable(db, id, user, owner=True, lock=True)
        db.execute(
            "UPDATE snippets SET title=%s, tags=%s, visibility=%s, updated_at=clock_timestamp() WHERE id=%s",
            (data.title, data.tags, data.visibility, id),
        )
        db.execute("DELETE FROM snippet_files WHERE snippet_id=%s", (id,))
        save_files(db, id, data.files)
    return {"id": id}


@app.post("/snippets/{id}/fork", status_code=201)
def fork_snippet(id: UUID, user: Caller):
    require_user(user)
    fork_id = uuid4()
    with connect() as db:
        source = readable(db, id, user)
        db.execute(
            """INSERT INTO snippets (id, owner_id, title, tags, visibility, parent_snippet_id)
                      VALUES (%s,%s,%s,%s,'private',%s)""",
            (fork_id, user, source["title"], source["tags"], id),
        )
        db.execute(
            """INSERT INTO snippet_files (snippet_id, position, path, content)
                      SELECT %s, position, path, content FROM snippet_files WHERE snippet_id=%s""",
            (fork_id, id),
        )
    return {"id": fork_id}


@app.put("/snippets/{id}/access")
def grant_access(id: UUID, user: Caller, data: GrantAccess):
    require_user(user)
    with connect() as db:
        snippet = readable(db, id, user, owner=True, lock=True)
        if snippet["visibility"] != "private":
            raise problem(400, "invalid_input", "Set visibility to private before granting access.")
        recipient = db.execute(
            "SELECT id FROM auth.users WHERE lower(email)=lower(%s)", (data.email,)
        ).fetchone()
        if recipient is None:
            raise problem(404, "not_found", "No account exists for that email.")
        db.execute(
            "INSERT INTO snippet_access (snippet_id,user_id) VALUES (%s,%s) ON CONFLICT DO NOTHING",
            (id, recipient["id"]),
        )
    return {"email": data.email, "access": "viewer"}


@app.get("/snippets/{id}/raw")
def raw_file(
    id: UUID, user: Caller, path: str = Query(..., min_length=1, max_length=255)
):
    with connect() as db:
        readable(db, id, user)
        file = db.execute(
            "SELECT content FROM snippet_files WHERE snippet_id=%s AND path=%s",
            (id, path),
        ).fetchone()
        if file is None:
            raise problem(404, "not_found", "Snippet not found.")
    return PlainTextResponse(
        file["content"],
        headers={
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "no-store",
        },
    )


@app.get("/embed/{id}", response_class=HTMLResponse)
def embed(id: UUID, user: Caller, request: Request):
    # Embeds are always anonymous, including when an owner views one.
    with connect() as db:
        snippet = readable(db, id, None)
        files = db.execute(
            "SELECT path, content FROM snippet_files WHERE snippet_id=%s ORDER BY position",
            (id,),
        ).fetchall()
    formatter = HtmlFormatter()
    sections = []
    for file in files:
        try:
            lexer = get_lexer_for_filename(file["path"], stripnl=False, ensurenl=False)
        except ClassNotFound:
            lexer = TextLexer(stripnl=False, ensurenl=False)
        sections.append(
            "<section><h2>"
            + escape(file["path"])
            + "</h2>"
            + highlight(file["content"], lexer, formatter)
            + "</section>"
        )
    forwarded_host = request.headers.get("x-forwarded-host")
    app_origin = (
        request.headers.get("referer", "").split("/app")[0]
        or (
            request.headers.get("x-forwarded-proto", request.url.scheme)
            + "://"
            + (forwarded_host or request.headers.get("host", ""))
        )
    )
    html = (
        '<!doctype html><html lang="en"><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1">'
        "<title>" + escape(snippet["title"]) + "</title><style>"
        "body{font:16px system-ui;margin:24px}h2{font-size:16px}pre{overflow:auto}"
        + formatter.get_style_defs(".highlight")
        + "</style><h1>"
        + escape(snippet["title"])
        + "</h1>"
        + '<p><a target="_blank" rel="noopener noreferrer" href="'
        + escape(app_origin.rstrip("/") + "/app?snippet=" + str(id))
        + '">Open in workspace to fork</a></p>'
        + "".join(sections)
        + "</html>"
    )
    return HTMLResponse(
        html,
        headers={
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors *; sandbox allow-popups allow-popups-to-escape-sandbox",
        },
    )


@app.put("/snippets/{id}/star")
def star(id: UUID, user: Caller):
    require_user(user)
    with connect() as db:
        readable(db, id, user)
        db.execute(
            "INSERT INTO snippet_stars (user_id, snippet_id) VALUES (%s,%s) ON CONFLICT DO NOTHING",
            (user, id),
        )
    return {"starred": True}


@app.delete("/snippets/{id}/star")
def unstar(id: UUID, user: Caller):
    require_user(user)
    with connect() as db:
        readable(db, id, user)
        db.execute(
            "DELETE FROM snippet_stars WHERE user_id=%s AND snippet_id=%s", (user, id)
        )
    return {"starred": False}


@app.get("/snippets/{id}/star")
def star_state(id: UUID, user: Caller):
    with connect() as db:
        readable(db, id, user)
        row = db.execute(
            """SELECT count(*) AS count,
                            COALESCE(bool_or(user_id = %s), false) AS starred
                            FROM snippet_stars WHERE snippet_id=%s""",
            (user, id),
        ).fetchone()
    return row


def public_graph(id):
    with connect() as db:
        db.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
        if not db.execute(
            "SELECT 1 FROM snippets WHERE id=%s AND visibility='public'", (id,)
        ).fetchone():
            raise problem(404, "not_found", "Snippet not found.")
        # shortcut: return the demo's connected public lineage, paginate when graph size outgrows one response.
        rows = db.execute(
            """WITH RECURSIVE visible AS (
            SELECT id, parent_snippet_id, title FROM snippets WHERE visibility='public'
        ), family AS (
            SELECT id, parent_snippet_id, title FROM visible WHERE id=%s
            UNION
            SELECT v.id, v.parent_snippet_id, v.title FROM visible v JOIN family f
            ON v.id=f.parent_snippet_id OR v.parent_snippet_id=f.id
        ) SELECT * FROM family ORDER BY id""",
            (id,),
        ).fetchall()
    ids = {row["id"] for row in rows}
    return {
        "nodes": [{"id": row["id"], "title": row["title"]} for row in rows],
        "edges": [
            {"parent_id": row["parent_snippet_id"], "child_id": row["id"]}
            for row in rows
            if row["parent_snippet_id"] in ids
        ],
    }


@app.get("/snippets/{id}/graph")
def graph(id: UUID, user: Caller):
    return public_graph(id)


@app.get("/snippets/{id}/events")
def graph_events(id: UUID, user: Caller, request: Request):
    public_graph(id)

    async def events():
        previous = None
        while not await request.is_disconnected():
            try:
                snapshot = await asyncio.to_thread(public_graph, id)
            except HTTPException:
                yield "event: unavailable\ndata: {}\n\n"
                return
            except psycopg.Error:
                return  # EventSource reconnects and receives a fresh invalidation.
            fingerprint = json.dumps(snapshot, default=str, sort_keys=True)
            if fingerprint != previous:
                yield "event: graph_changed\ndata: {}\n\n"
                previous = fingerprint
            else:
                yield ": keepalive\n\n"
            await asyncio.sleep(1)

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-store",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/health")
def health():
    with connect() as db:
        db.execute("SELECT 1")
    return {"status": "ok"}
