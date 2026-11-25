from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from uuid import uuid4

import os
import psycopg
import pytest
import yaml
from openapi_spec_validator import validate
from jsonschema import Draft202012Validator
from psycopg import sql
from psycopg.conninfo import make_conninfo

from test_phase1 import account, server


@pytest.fixture
def backend():
    schema = "test_" + uuid4().hex
    dsn = make_conninfo(os.environ["DATABASE_URL"], options=f"-c search_path={schema}")
    with psycopg.connect(os.environ["DATABASE_URL"], autocommit=True) as admin:
        admin.execute(sql.SQL("CREATE SCHEMA {}").format(sql.Identifier(schema)))
        try:
            with server(dsn) as api:
                yield api, account(), account(), dsn
        finally:
            admin.execute(
                sql.SQL("DROP SCHEMA {} CASCADE").format(sql.Identifier(schema))
            )


def sample():
    return yaml.safe_load(Path("openapi.yaml").read_text())["paths"]["/snippets"][
        "post"
    ]["requestBody"]["content"]["application/json"]["example"]


def save(api, owner, **overrides):
    result = api.post("/snippets", json=dict(sample(), **overrides), headers=owner)
    assert result.status_code == 201, result.text
    return result.json()["id"]


def test_fork_edit_search_raw_embed_and_stars(backend):
    api, owner, other, dsn = backend
    files = sample()["files"] + [
        {
            "path": "unsafe.html",
            "content": '<script>alert("x")</script>\r\n# uniqueneedle',
        }
    ]
    original = save(api, owner, visibility="public", files=files, title="<demo>")
    url = "/snippets/" + original
    raw = api.get(url + "/raw", params={"path": "unsafe.html"})
    assert raw.text == files[-1]["content"]
    assert raw.headers["content-type"] == "text/plain; charset=utf-8"
    assert raw.headers["x-content-type-options"] == "nosniff"
    html = api.get("/embed/" + original)
    assert html.status_code == 200 and "<script>" not in html.text
    assert (
        "&lt;demo&gt;" in html.text
        and "frame-ancestors *" in html.headers["content-security-policy"]
    )
    assert "x-frame-options" not in html.headers
    assert all(file["path"] in html.text for file in files)

    fork = api.post(url + "/fork", headers=other).json()["id"]
    fork_url = "/snippets/" + fork
    detail = api.get(fork_url, headers=other).json()
    assert detail["parent_snippet_id"] == original and detail["visibility"] == "private"
    assert detail["files"] == files
    assert api.put(fork_url, json=sample(), headers=owner).status_code == 404
    assert (
        api.get(
            fork_url + "/raw", params={"path": "Dockerfile"}, headers=owner
        ).status_code
        == 404
    )
    assert api.get("/embed/" + fork, headers=other).status_code == 404
    assert api.post(fork_url + "/fork", headers=owner).status_code == 404
    assert api.put(fork_url + "/star", headers=owner).status_code == 404
    assert api.get(fork_url + "/graph", headers=other).status_code == 404
    assert api.get(fork_url + "/events", headers=other).status_code == 404
    assert [r["id"] for r in api.get("/snippets?q=uniqueneedle").json()["items"]] == [
        original
    ]
    assert api.get("/snippets?tag=DOCKER").json()["items"][0]["id"] == original

    edited = dict(
        sample(),
        title="Forktitle",
        visibility="public",
        files=[{"path": "app.py", "content": "# forkcontentneedle\n"}],
    )
    assert api.put(fork_url, json=edited, headers=other).status_code == 200
    assert api.get(url).json()["files"] == files
    assert api.get(fork_url).json()["files"] == edited["files"]
    assert api.get("/snippets?q=forkcontentneedle").json()["items"][0]["id"] == fork
    assert api.get("/snippets?q=Forktitle&tag=docker").json()["items"][0]["id"] == fork
    assert api.get("/snippets?q=uniqueneedle&tag=missing").json()["items"] == []

    for _ in range(2):
        assert api.put(fork_url + "/star", headers=owner).json() == {"starred": True}
    assert api.get(fork_url + "/star", headers=owner).json() == {
        "count": 1,
        "starred": True,
    }
    assert api.get(fork_url + "/star").json() == {"count": 1, "starred": False}
    # Concurrent duplicate stars still leave one row per user.
    with ThreadPoolExecutor(4) as pool:
        results = list(
            pool.map(lambda _: api.put(fork_url + "/star", headers=other), range(4))
        )
    assert all(r.status_code == 200 for r in results)
    assert api.get(fork_url + "/star", headers=other).json()["count"] == 2
    for _ in range(2):
        assert api.delete(fork_url + "/star", headers=owner).json() == {
            "starred": False
        }
    assert api.get(fork_url + "/star", headers=owner).json() == {
        "count": 1,
        "starred": False,
    }
    with psycopg.connect(dsn) as db:
        assert db.execute("SELECT count(*) FROM schema_migrations").fetchone() == (2,)
    for headers in ({}, owner, other):
        assert api.get(url + "/graph", headers=headers).json() == {
            "nodes": sorted(
                [
                    {"id": original, "title": "<demo>"},
                    {"id": fork, "title": "Forktitle"},
                ],
                key=lambda n: n["id"],
            ),
            "edges": [{"parent_id": original, "child_id": fork}],
        }


def next_frame(lines):
    frame = []
    for line in lines:
        if not line:
            return "\n".join(frame)
        frame.append(line)
    raise AssertionError("Stream closed before frame")


def test_public_graph_live_updates_and_hidden_lineage(backend):
    api, owner, other, _ = backend
    root = save(api, owner, visibility="public")
    url = "/snippets/" + root
    with api.stream("GET", url + "/events") as stream:
        assert stream.status_code == 200 and stream.headers["content-type"].startswith(
            "text/event-stream"
        )
        lines = stream.iter_lines()
        assert "graph_changed" in next_frame(lines)
        fork = api.post(url + "/fork", headers=other).json()["id"]
        # A hidden fork must not trigger a graph invalidation.
        assert next_frame(lines) == ": keepalive"
        assert api.get(url + "/graph").json() == {
            "nodes": [{"id": root, "title": sample()["title"]}],
            "edges": [],
        }
        assert (
            api.put(
                "/snippets/" + fork,
                json=dict(sample(), visibility="public"),
                headers=other,
            ).status_code
            == 200
        )
        for _ in range(5):
            if "graph_changed" in next_frame(lines):
                break
        else:
            pytest.fail("No live graph update after publishing")
        assert len(api.get(url + "/graph").json()["nodes"]) == 2
        assert (
            api.put(
                "/snippets/" + fork,
                json=dict(sample(), visibility="unlisted"),
                headers=other,
            ).status_code
            == 200
        )
        for _ in range(5):
            if "graph_changed" in next_frame(lines):
                break
        else:
            pytest.fail("No invalidation after hiding public fork")
        assert (
            api.put(
                url, json=dict(sample(), visibility="private"), headers=owner
            ).status_code
            == 200
        )
        for _ in range(5):
            if "unavailable" in next_frame(lines):
                break
        else:
            pytest.fail("Stream did not revoke hidden root")
    # A public fork of an unlisted source must not disclose its parent.
    hidden = save(api, owner, visibility="unlisted")
    child = api.post("/snippets/" + hidden + "/fork", headers=other).json()["id"]
    assert (
        api.put(
            "/snippets/" + child,
            json=dict(sample(), visibility="public"),
            headers=other,
        ).status_code
        == 200
    )
    assert api.get("/snippets/" + child).json()["parent_snippet_id"] is None
    assert api.get("/snippets/" + child + "/graph").json()["edges"] == []
    assert api.get("/snippets?q=nginx").json()["items"][0]["id"] == child


def test_edit_rollback_validation_and_cors(backend):
    api, owner, other, dsn = backend
    id = save(api, owner)
    url = "/snippets/" + id
    before = api.get(url, headers=owner).json()
    with psycopg.connect(dsn) as db:
        db.execute("ALTER TABLE snippet_files ADD CHECK (path <> 'reject-in-test')")
    bad = dict(
        sample(),
        files=[
            {"path": "ok", "content": ""},
            {"path": "reject-in-test", "content": ""},
        ],
    )
    assert api.put(url, json=bad, headers=owner).status_code == 500
    assert api.get(url, headers=owner).json() == before
    for path in ("../a", "/a", "C:\\a", "a//b", "a/./b", "a\nb", ""):
        payload = dict(sample(), files=[{"path": path, "content": ""}])
        assert api.put(url, json=payload, headers=owner).status_code == 422
    assert (
        api.put(
            url, json=dict(sample(), parent_snippet_id=str(uuid4())), headers=owner
        ).status_code
        == 422
    )
    assert api.get(url + "/star", headers=other).status_code == 404
    for route in (url, url + "/raw?path=Dockerfile", url + "/star"):
        assert (
            api.get(route, headers={"Authorization": "Bearer forged"}).status_code
            == 401
        )
    for method in ("PUT", "DELETE", "POST"):
        preflight = api.options(
            url,
            headers={
                "Origin": os.environ["FRONTEND_ORIGIN"],
                "Access-Control-Request-Method": method,
                "Access-Control-Request-Headers": "authorization,content-type",
            },
        )
        assert preflight.status_code == 200
    assert api.get("/health").json() == {"status": "ok"}
    assert api.get("/missing").json()["error"]["code"] == "not_found"
    assert api.delete(url).json()["error"]["code"] == "method_not_allowed"


def test_contract_and_seed(backend):
    import subprocess
    import sys

    api, owner, _, _ = backend
    spec = api.get("/openapi.json").json()
    validate(spec)
    paths = spec["paths"]

    def check(path, method, result):
        schema = paths[path][method]["responses"][str(result.status_code)]["content"][
            "application/json"
        ]["schema"]
        Draft202012Validator(dict(schema, components=spec["components"])).validate(
            result.json()
        )

    saved = api.post("/snippets", json=sample(), headers=owner)
    check("/snippets", "post", saved)
    id = saved.json()["id"]
    check("/snippets/{id}", "get", api.get("/snippets/" + id, headers=owner))
    check("/snippets", "get", api.get("/snippets?scope=mine", headers=owner))
    check(
        "/snippets/{id}/star",
        "get",
        api.get("/snippets/" + id + "/star", headers=owner),
    )
    public = save(api, owner, visibility="public")
    check("/snippets/{id}/graph", "get", api.get("/snippets/" + public + "/graph"))
    # Resolve component responses before validating errors and acknowledgments.
    for response in spec["components"]["responses"].values():
        schema = response["content"]["application/json"]["schema"]
        Draft202012Validator.check_schema(schema)
    subprocess.run(
        [sys.executable, "seed.py"],
        check=True,
        env=dict(
            os.environ,
            SEED_API_URL="http://127.0.0.1:8091",
            SEED_OWNER_TOKEN=owner["Authorization"].split()[1],
        ),
    )
    assert len(api.get("/snippets?scope=mine", headers=owner).json()["items"]) == 5
