import asyncio
import json
import os
import re
import time
from contextlib import asynccontextmanager
from datetime import timedelta
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
from pygments.lexers import TextLexer, get_lexer_for_filename, guess_lexer
from pygments.util import ClassNotFound
from starlette.exceptions import HTTPException as StarletteHTTPException
from pydantic import ValidationError

from models import AskSnippet, CreateSnippet, GrantAccess
from database import connect, migrate


@asynccontextmanager
async def lifespan(app):
    await asyncio.to_thread(migrate)
    yield


app = FastAPI(title="Forkspace", version="0.2.0", lifespan=lifespan)
ask_limits: dict[str, list[float]] = {}
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
    response.headers.setdefault("Cache-Control", "no-store")
    response.headers["X-Content-Type-Options"] = "nosniff"
    if not request.url.path.startswith("/embed/"):
        response.headers["X-Frame-Options"] = "DENY"
    return response


AUTH_URL = os.environ["SUPABASE_AUTH_URL"].rstrip("/")
PUBLISHABLE_KEY = os.environ["SUPABASE_PUBLISHABLE_KEY"]
if not AUTH_URL or not PUBLISHABLE_KEY:
    raise RuntimeError("Set SUPABASE_AUTH_URL and SUPABASE_PUBLISHABLE_KEY")


def problem(status: int, code: str, message: str, details=None) -> HTTPException:
    detail = {"code": code, "message": message}
    if details:
        detail["details"] = details
    return HTTPException(status, detail)


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
    with httpx.Client(timeout=5, trust_env=False) as client:
        result = client.get(
            f"{AUTH_URL}/user",
            headers={
                "apikey": PUBLISHABLE_KEY,
                "Authorization": f"Bearer {parts[1]}",
            },
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
        if len(body) + len(chunk) > 6 * 1024 * 1024:
            raise problem(413, "payload_too_large", "Request exceeds 6 MiB.")
        body.extend(chunk)
    data = CreateSnippet.model_validate_json(body)
    try:
        async with httpx.AsyncClient(timeout=2, trust_env=False) as client:
            response = await client.post(
                os.environ.get("WATCHDOG_URL", "http://watchdog:9000") + "/scan",
                json={"files": [file.model_dump() for file in data.files]},
            )
            response.raise_for_status()
            findings = response.json()["findings"]
    except (httpx.HTTPError, KeyError, ValueError) as exc:
        raise problem(503, "watchdog_unavailable", "Security scanner is unavailable.") from exc
    if findings:
        raise problem(422, "malicious_code", "Potentially dangerous code detected by the watchdog.", findings)
    return data


def require_user(user):
    if user is None:
        raise unauthorized()
    return user


def expiry_for(value):
    return None if value == "forever" else {"1h": timedelta(hours=1), "1d": timedelta(days=1), "7d": timedelta(days=7)}[value]


def readable(db, id, user, *, owner=False, lock=False):
    predicate = (
        "s.owner_id = %s"
        if owner
        else """(s.visibility = 'public' OR
                 (s.visibility = 'unlisted' AND (s.link_expires_at IS NULL OR s.link_expires_at > clock_timestamp())) OR s.owner_id = %s OR
                 EXISTS (
                    SELECT 1 FROM snippet_access a
                    WHERE a.snippet_id=s.id AND a.user_id=%s
                      AND (s.link_expires_at IS NULL OR s.link_expires_at > clock_timestamp())))"""
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


def rebuild_chunks(db, snippet_id):
    db.execute("DELETE FROM snippet_chunks WHERE snippet_id=%s", (snippet_id,))
    files = db.execute(
        "SELECT path, content FROM snippet_files WHERE snippet_id=%s ORDER BY position", (snippet_id,)
    ).fetchall()
    rows = []
    for file in files:
        lines = file["content"].splitlines() or [file["content"]]
        for start in range(0, len(lines), 40):
            rows.append((snippet_id, file["path"], start + 1, "\n".join(lines[start:start + 40])))
    if rows:
        with db.cursor() as cursor:
            cursor.executemany(
                "INSERT INTO snippet_chunks (snippet_id,file_path,start_line,content) VALUES (%s,%s,%s,%s)", rows
            )


@app.post("/snippets", status_code=201)
def create_snippet(user: Caller, data: Annotated[CreateSnippet, Depends(read_body)]):
    require_user(user)
    snippet_id = uuid4()
    with connect() as db:
        db.execute(
            "INSERT INTO snippets (id, owner_id, title, description, tags, visibility, link_expires_at) VALUES (%s,%s,%s,%s,%s,%s, CASE WHEN %s::interval IS NULL THEN NULL ELSE clock_timestamp() + %s::interval END)",
            (snippet_id, user, data.title, data.description, data.tags, data.visibility, expiry_for(data.link_expiry), expiry_for(data.link_expiry)),
        )
        save_files(db, snippet_id, data.files)
        rebuild_chunks(db, snippet_id)
    return {"id": snippet_id}


SUMMARY = """SELECT s.id, s.owner_id, COALESCE(u.raw_user_meta_data->>'username', split_part(u.email, '@', 1), 'Developer') AS owner_name, s.title, s.description, s.tags, s.visibility, s.link_expires_at, s.created_at, s.updated_at,
                    CASE WHEN EXISTS (SELECT 1 FROM snippets p WHERE p.id = s.parent_snippet_id
                                      AND (p.visibility = 'public' OR p.owner_id = %s))
                         THEN s.parent_snippet_id ELSE NULL END AS parent_snippet_id,
                    (SELECT count(*) FROM snippet_files WHERE snippet_id = s.id) AS file_count,
                    ARRAY(SELECT path FROM snippet_files WHERE snippet_id = s.id ORDER BY position) AS file_paths,
                    (SELECT count(*) FROM snippet_stars WHERE snippet_id = s.id) AS star_count,
                    EXISTS (SELECT 1 FROM snippet_stars WHERE snippet_id = s.id AND user_id = %s) AS starred
             FROM snippets s LEFT JOIN auth.users u ON u.id = s.owner_id """


@app.get("/snippets")
def list_snippets(
    user: Caller,
    response: Response,
    scope: Literal["public", "mine", "shared", "starred"] = "public",
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    tag: str | None = Query(None, min_length=1, max_length=32),
    q: str | None = Query(None, min_length=1, max_length=200),
):
    if scope in ("mine", "shared", "starred") and user is None:
        raise unauthorized()
    predicate = {
        "public": "WHERE s.visibility = 'public'",
        "mine": "WHERE s.owner_id = %s",
        "starred": """WHERE EXISTS (SELECT 1 FROM snippet_stars st WHERE st.snippet_id=s.id AND st.user_id=%s)
            AND (s.visibility = 'public' OR (s.visibility='unlisted' AND (s.link_expires_at IS NULL OR s.link_expires_at > clock_timestamp())) OR s.owner_id=%s OR EXISTS
            (SELECT 1 FROM snippet_access a WHERE a.snippet_id=s.id AND a.user_id=%s))""",
        "shared": """WHERE s.visibility = 'private' AND (s.link_expires_at IS NULL OR s.link_expires_at > clock_timestamp()) AND EXISTS (
            SELECT 1 FROM snippet_access a WHERE a.snippet_id=s.id AND a.user_id=%s)""",
    }[scope]
    params = [user, user] if scope == "public" else [user, user, user]
    if scope == "starred":
        params.extend([user, user])
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
        row = db.execute(SUMMARY + "WHERE s.id = %s", (user, user, id)).fetchone()
        row["files"] = db.execute(
            "SELECT path, content FROM snippet_files WHERE snippet_id = %s ORDER BY position",
            (id,),
        ).fetchall()
    response.headers["Cache-Control"] = "no-store"
    return row


@app.post("/snippets/{id}/ask")
def ask_snippet(id: UUID, user: Caller, data: AskSnippet):
    """Small RAG path: authorize, retrieve relevant file chunks, then optionally generate."""
    with connect() as db:
        readable(db, id, user)
        now = time.monotonic()
        key = f"{user}:{id}"
        recent = [stamp for stamp in ask_limits.get(key, []) if now - stamp < 60]
        if len(recent) >= min(int(os.getenv("RAG_MAX_REQUESTS_PER_MINUTE", "3")), 3):
            raise problem(429, "rate_limited", "Too many assistant requests. Try again shortly.")
        ask_limits[key] = recent + [now]
        terms = set(re.findall(r"[a-zA-Z0-9_]{2,}", data.question.lower()))
        overview = data.question.lower().startswith("explain how the files")
        chunks = db.execute(
            """SELECT file_path, start_line, content,
                      ts_rank_cd(search, plainto_tsquery('simple', %s)) AS rank
               FROM snippet_chunks
               WHERE snippet_id=%s
               ORDER BY rank DESC, id LIMIT 6""", (data.question, id)
        ).fetchall()
        chunks = [row for row in chunks if overview or any(term in row["content"].lower() for term in terms)]
        # A legacy database may predate the index; keep the endpoint self-healing.
        if not chunks:
            rebuild_chunks(db, id)
            chunks = db.execute(
                """SELECT file_path, start_line, content,
                          ts_rank_cd(search, plainto_tsquery('simple', %s)) AS rank
                   FROM snippet_chunks
                   WHERE snippet_id=%s
                   ORDER BY rank DESC, id LIMIT 6""", (data.question, id)
            ).fetchall()
            chunks = [row for row in chunks if overview or any(term in row["content"].lower() for term in terms)]
    context = "\n\n".join(f"[{row['file_path']}:{row['start_line']}]\n{row['content']}" for row in chunks[:4])
    context = context[:min(int(os.getenv("RAG_MAX_CONTEXT_CHARS", "4000")), 4000)]
    if not context:
        context = "No matching code chunk was found in the snippet."
    prompt = f"Question: {data.question}\n\nCode context:\n{context}"
    sources = [f"{row['file_path']}:{row['start_line']}" for row in chunks[:4]]
    timeout = min(float(os.getenv("RAG_OPENAI_TIMEOUT_SECONDS", "20")), 20)
    key = os.getenv("OPENAI_API_KEY")
    if key:
        try:
            result = httpx.post(
                os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1") + "/chat/completions",
                headers={"Authorization": f"Bearer {key}"},
                json={"model": os.getenv("OPENAI_MODEL", "gpt-4o-mini"), "temperature": 0.1, "max_tokens": min(int(os.getenv("RAG_MAX_OUTPUT_TOKENS", "200")), 200),
                      "messages": [{"role": "system", "content": "Answer briefly using only the code context. Say insufficient context when needed."}, {"role": "user", "content": prompt}]},
                timeout=timeout,
            )
            if result.status_code == 200:
                return {"answer": result.json()["choices"][0]["message"]["content"], "sources": sources}
        except httpx.HTTPError:
            pass
    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key:
        try:
            result = httpx.post(
                "https://generativelanguage.googleapis.com/v1beta/models/" + os.getenv("GEMINI_MODEL", "gemini-2.0-flash") + ":generateContent",
                params={"key": gemini_key},
                json={"systemInstruction": {"parts": [{"text": "Answer briefly using only the code context. Say insufficient context when needed."}]},
                      "contents": [{"parts": [{"text": prompt}]}], "generationConfig": {"temperature": 0.1, "maxOutputTokens": min(int(os.getenv("RAG_MAX_OUTPUT_TOKENS", "200")), 200)}},
                timeout=timeout,
            )
            if result.status_code == 200:
                answer = result.json()["candidates"][0]["content"]["parts"][0]["text"]
                return {"answer": answer, "sources": sources}
        except (httpx.HTTPError, KeyError, IndexError, TypeError):
            pass
    if chunks:
        source_text = ", ".join(f"{row['file_path']}:{row['start_line']}" for row in chunks[:4])
        excerpts = []
        for row in chunks[:3]:
            lines = [line.strip() for line in row["content"].splitlines() if line.strip()][:3]
            if lines:
                excerpts.append(f"{row['file_path']} contains: " + " ".join(lines))
        answer = f"I found relevant code in {source_text}. " + " ".join(excerpts)
    else:
        answer = "I could not find code in this snippet that answers that question."
    return {"answer": answer, "context": context,
            "sources": [f"{row['file_path']}:{row['start_line']}" for row in chunks[:4]]}


@app.put("/snippets/{id}")
def replace_snippet(
    id: UUID, user: Caller, data: Annotated[CreateSnippet, Depends(read_body)]
):
    require_user(user)
    with connect() as db:
        readable(db, id, user, owner=True, lock=True)
        db.execute(
            "UPDATE snippets SET title=%s, description=%s, tags=%s, visibility=%s, link_expires_at=CASE WHEN %s::interval IS NULL THEN NULL ELSE clock_timestamp() + %s::interval END, updated_at=clock_timestamp() WHERE id=%s",
            (data.title, data.description, data.tags, data.visibility, expiry_for(data.link_expiry), expiry_for(data.link_expiry), id),
        )
        db.execute("DELETE FROM snippet_files WHERE snippet_id=%s", (id,))
        save_files(db, id, data.files)
        rebuild_chunks(db, id)
    return {"id": id}


@app.delete("/snippets/{id}")
def delete_snippet(id: UUID, user: Caller):
    require_user(user)
    with connect() as db:
        readable(db, id, user, owner=True, lock=True)
        db.execute("UPDATE snippets SET parent_snippet_id=NULL WHERE parent_snippet_id=%s", (id,))
        db.execute("DELETE FROM snippet_files WHERE snippet_id=%s", (id,))
        db.execute("DELETE FROM snippet_stars WHERE snippet_id=%s", (id,))
        db.execute("DELETE FROM snippet_access WHERE snippet_id=%s", (id,))
        db.execute("DELETE FROM snippets WHERE id=%s", (id,))
    return {"id": id, "deleted": True}


@app.post("/snippets/{id}/fork", status_code=201)
def fork_snippet(id: UUID, user: Caller):
    require_user(user)
    fork_id = uuid4()
    with connect() as db:
        source = readable(db, id, user)
        db.execute(
            """INSERT INTO snippets (id, owner_id, title, description, tags, visibility, parent_snippet_id)
                      VALUES (%s,%s,%s,%s,%s,'private',%s)""",
            (fork_id, user, source["title"], source["description"], source["tags"], id),
        )
        db.execute(
            """INSERT INTO snippet_files (snippet_id, position, path, content)
                      SELECT %s, position, path, content FROM snippet_files WHERE snippet_id=%s""",
            (fork_id, id),
        )
        rebuild_chunks(db, fork_id)
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
            try:
                lexer = guess_lexer(file["content"]) if file["content"].strip() else TextLexer(stripnl=False, ensurenl=False)
            except ClassNotFound:
                lexer = TextLexer(stripnl=False, ensurenl=False)
        code_html = (
            highlight(file["content"], lexer, formatter)
            if file["content"]
            else '<div class="highlight"><pre style="color:#94a3b8;font-style:italic">(empty file)</pre></div>'
        )
        sections.append(
            "<section><h2>"
            + escape(file["path"])
            + f' <span style="font-size:12px;font-weight:500;color:#64748b;background:#f1f5f9;padding:2px 8px;border-radius:999px;margin-left:8px">{escape(lexer.name)}</span>'
            + "</h2>"
            + '<div style="overflow:auto;margin:0;padding:12px 14px;border:1px solid #29384c;border-radius:8px;background:#101722;color:#eef4ff">'
            + code_html
            + "</div>"
            + "</section>"
        )
    origins = [origin.rstrip("/") for origin in os.environ["FRONTEND_ORIGIN"].split(",")]
    referer = request.headers.get("referer", "")
    app_origin = next((origin for origin in origins if referer.startswith(origin + "/")), origins[0])
    html = (
        '<!doctype html><html lang="en"><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1">'
        "<title>" + escape(snippet["title"]) + "</title><style>"
        "body{font:16px system-ui;margin:24px;color:#172033;background:#f7f8fb}h1{font-size:24px}h2{font-size:16px;margin:18px 0 8px}pre{overflow:auto;margin:0;padding:10px 12px;border:0;border-radius:6px;background:transparent;color:#eef4ff}"
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
            """SELECT count(*) AS star_count,
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
            "Cache-Control": "no-store, no-transform",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/health")
def health():
    with connect() as db:
        db.execute("SELECT 1")
    return {"status": "ok"}


