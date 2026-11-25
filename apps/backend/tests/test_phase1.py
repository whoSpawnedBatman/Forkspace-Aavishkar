import os
import subprocess
import sys
import time
from contextlib import contextmanager
from pathlib import Path
from uuid import uuid4

import httpx
import psycopg
import yaml
from psycopg import sql
from psycopg.conninfo import make_conninfo


@contextmanager
def server(dsn):
    env = dict(os.environ, DATABASE_URL=dsn)
    process = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "main:app", "--port", "8091"], env=env
    )
    try:
        with httpx.Client(base_url="http://127.0.0.1:8091") as api:
            for _ in range(60):
                assert process.poll() is None
                try:
                    if api.get("/openapi.json").is_success:
                        break
                except httpx.ConnectError:
                    pass
                time.sleep(0.1)
            else:
                raise AssertionError("API did not start")
            yield api
    finally:
        process.terminate()
        process.wait(timeout=10)


def account():
    # The test stack has its own internal GoTrue instance with auto-confirmed email.
    assert os.environ["SUPABASE_AUTH_URL"] == "http://auth:9999"
    result = httpx.post(
        "http://auth:9999/signup",
        json={
            "email": f"{uuid4().hex}@example.org",
            "password": uuid4().hex,
        },
    )
    result.raise_for_status()
    return {"Authorization": "Bearer " + result.json()["access_token"]}


def test_save_reopen_and_permissions():
    owner, other = account(), account()
    schema = "test_" + uuid4().hex
    dsn = make_conninfo(os.environ["DATABASE_URL"], options=f"-c search_path={schema}")
    spec = yaml.safe_load(Path("openapi.yaml").read_text())
    sample = spec["paths"]["/snippets"]["post"]["requestBody"]["content"][
        "application/json"
    ]["example"]
    ids = {}
    with psycopg.connect(os.environ["DATABASE_URL"], autocommit=True) as admin:
        admin.execute(sql.SQL("CREATE SCHEMA {}").format(sql.Identifier(schema)))
        try:
            with psycopg.connect(dsn) as db:
                db.execute(Path("migrations/001_snippets.sql").read_text())
            with server(dsn) as api:
                assert api.get("/openapi.json").json() == spec
                for visibility in ("public", "unlisted", "private"):
                    body = dict(
                        sample,
                        visibility=visibility,
                        tags=[" Docker ", "docker", "nginx"],
                    )
                    saved = api.post("/snippets", json=body, headers=owner)
                    assert saved.status_code == 201, saved.text
                    ids[visibility] = saved.json()["id"]
                for invalid in (
                    dict(sample, title="  "),
                    dict(sample, files=[sample["files"][0]] * 2),
                    dict(sample, owner_id=str(uuid4())),
                ):
                    denied = api.post("/snippets", json=invalid, headers=owner)
                    assert (
                        denied.status_code == 422
                        and denied.json()["error"]["code"] == "invalid_input"
                    )
                assert api.post("/snippets", json=sample).status_code == 401
                assert (
                    api.post(
                        "/snippets", headers=owner, content=b" " * 1048577
                    ).status_code
                    == 413
                )
                # A database error on the second file must roll back the first file and parent.
                with psycopg.connect(dsn) as db:
                    db.execute(
                        "ALTER TABLE snippet_files ADD CHECK (path <> 'reject-in-test')"
                    )
                bad_files = [
                    sample["files"][0],
                    {"path": "reject-in-test", "content": ""},
                ]
                failed = api.post(
                    "/snippets", json=dict(sample, files=bad_files), headers=owner
                )
                assert (
                    failed.status_code == 500
                    and failed.json()["error"]["code"] == "service_error"
                )
                assert (
                    api.put(
                        "/snippets/" + ids["private"] + "/star", headers=owner
                    ).status_code
                    == 200
                )
            with server(dsn) as api:
                assert api.get(
                    "/snippets/" + ids["private"] + "/star", headers=owner
                ).json() == {
                    "starred": True,
                    "count": 1,
                }
                for headers in ({}, other, owner):
                    listing = api.get("/snippets", headers=headers).json()["items"]
                    assert [s["id"] for s in listing] == [ids["public"]]
                    for vis, sid in ids.items():
                        result = api.get("/snippets/" + sid, headers=headers)
                        assert result.headers["Cache-Control"] == "no-store"
                        if vis == "private" and headers != owner:
                            assert result.status_code == 404
                            assert (
                                result.json()
                                == api.get(
                                    "/snippets/" + str(uuid4()), headers=headers
                                ).json()
                            )
                            continue
                        assert result.status_code == 200
                        detail = result.json()
                        assert (
                            detail["files"] == sample["files"]
                            and detail["file_count"] == 3
                        )
                        assert (
                            detail["title"],
                            detail["tags"],
                            detail["visibility"],
                        ) == (sample["title"], sample["tags"], vis)
                assert api.get("/snippets?scope=mine").status_code == 401
                assert (
                    api.get("/snippets?scope=mine", headers=other).json()["items"] == []
                )
                library = api.get("/snippets?scope=mine", headers=owner).json()["items"]
                assert [s["id"] for s in library] == list(reversed(ids.values()))
                assert (
                    api.get(
                        "/snippets", headers={"Authorization": "Bearer invalid"}
                    ).status_code
                    == 401
                )
            with psycopg.connect(dsn) as db:
                assert db.execute("SELECT count(*) FROM snippets").fetchone() == (3,)
                assert db.execute("SELECT count(*) FROM snippet_files").fetchone() == (
                    9,
                )
            print(
                f"Reopened private snippet {ids['private']} after restart; other user received 404."
            )
        finally:
            admin.execute(
                sql.SQL("DROP SCHEMA {} CASCADE").format(sql.Identifier(schema))
            )


def test_legacy_upgrade_preserves_data():
    schema = "test_" + uuid4().hex
    id = uuid4()
    dsn = make_conninfo(os.environ["DATABASE_URL"], options=f"-c search_path={schema}")
    with psycopg.connect(os.environ["DATABASE_URL"], autocommit=True) as admin:
        admin.execute(sql.SQL("CREATE SCHEMA {}").format(sql.Identifier(schema)))
        try:
            with psycopg.connect(dsn) as db:
                db.execute(Path("migrations/001_snippets.sql").read_text())
                db.execute(
                    "INSERT INTO snippets (id, owner_id, title, tags, visibility) VALUES (%s,%s,'Legacy',%s,'public')",
                    (id, uuid4(), ["docker"]),
                )
                db.execute(
                    "INSERT INTO snippet_files VALUES (%s,0,'Dockerfile','FROM nginx:alpine')",
                    (id,),
                )
            for _ in range(2):
                with server(dsn) as api:
                    detail = api.get("/snippets/" + str(id)).json()
                    assert detail["title"] == "Legacy"
                    assert detail["files"] == [
                        {"path": "Dockerfile", "content": "FROM nginx:alpine"}
                    ]
                    assert detail["parent_snippet_id"] is None
                    assert detail["created_at"] == detail["updated_at"]
            with psycopg.connect(dsn) as db:
                assert db.execute(
                    "SELECT count(*) FROM schema_migrations"
                ).fetchone() == (3,)
        finally:
            admin.execute(
                sql.SQL("DROP SCHEMA {} CASCADE").format(sql.Identifier(schema))
            )
