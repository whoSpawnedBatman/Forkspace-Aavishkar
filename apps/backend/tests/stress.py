"""Bounded load against the isolated local stack. Removes only its own data."""

import asyncio
import json
import math
import os
import time
from collections import Counter
from uuid import UUID, uuid4

import httpx
import psycopg


async def main():
    if os.environ["SUPABASE_AUTH_URL"] != "http://auth:9999":
        raise RuntimeError("Run only with compose.test.yaml and local test auth")
    base_url = "http://127.0.0.1:8000"
    users = []
    results = []
    failures = []
    tag = "load" + uuid4().hex[:12]
    payload = {
        "title": "Local load test",
        "tags": [tag],
        "visibility": "public",
        "files": [
            {"path": "Dockerfile", "content": "FROM nginx:alpine\n"},
            {
                "path": "docker-compose.yml",
                "content": "services:\n  web:\n    build: .\n",
            },
            {
                "path": "nginx.conf",
                "content": "# stressneedle\n" + "# synthetic\n" * 100,
            },
        ],
    }
    async with httpx.AsyncClient(
        base_url=base_url,
        timeout=30,
        limits=httpx.Limits(max_connections=60, max_keepalive_connections=60),
    ) as api:

        async def hit(label, method, path, expected=200, **kwargs):
            start = time.perf_counter()
            status = "transport_error"
            try:
                response = await api.request(method, path, **kwargs)
                status = response.status_code
                if status != expected:
                    failures.append(
                        {"operation": label, "expected": expected, "actual": status}
                    )
                return response
            except httpx.RequestError as exc:
                failures.append({"operation": label, "error": type(exc).__name__})
                return None
            finally:
                results.append((label, status, 1000 * (time.perf_counter() - start)))

        def measure(name, offset, elapsed, concurrency):
            samples = results[offset:]
            latencies = sorted(item[2] for item in samples)
            return {
                "stage": name,
                "concurrency": concurrency,
                "requests": len(samples),
                "seconds": round(elapsed, 2),
                "requests_per_second": round(len(samples) / elapsed, 2),
                "p50_ms": round(latencies[math.ceil(len(samples) * 0.5) - 1], 1),
                "p95_ms": round(latencies[math.ceil(len(samples) * 0.95) - 1], 1),
                "max_ms": round(latencies[-1], 1),
                "status_counts": dict(Counter(str(item[1]) for item in samples)),
            }

        try:
            for _ in range(2):
                response = await api.post(
                    "http://auth:9999/signup",
                    json={
                        "email": f"{uuid4().hex}@example.org",
                        "password": uuid4().hex,
                    },
                )
                response.raise_for_status()
                user = response.json()
                users.append(
                    (
                        UUID(user["user"]["id"]),
                        {"Authorization": "Bearer " + user["access_token"]},
                    )
                )
            owner, other = users[0][1], users[1][1]
            public = await api.post("/snippets", headers=owner, json=payload)
            public.raise_for_status()
            root = public.json()["id"]
            private = await api.post(
                "/snippets", headers=owner, json=dict(payload, visibility="private")
            )
            private.raise_for_status()
            private_id = private.json()["id"]
            stages = []
            for concurrency in (5, 20, 50):
                gate = asyncio.Semaphore(concurrency)

                async def request(index):
                    async with gate:
                        operation = index % 8
                        if operation == 0:
                            response = await hit(
                                "public_read", "GET", f"/snippets/{root}"
                            )
                            if response is not None and response.status_code == 200:
                                assert response.json()["files"] == payload["files"]
                        elif operation == 1:
                            await hit(
                                "private_denial",
                                "GET",
                                f"/snippets/{private_id}",
                                404,
                                headers=other,
                            )
                        elif operation == 2:
                            await hit(
                                "invalid_save",
                                "POST",
                                "/snippets",
                                422,
                                headers=owner,
                                json=dict(payload, title=" "),
                            )
                        elif operation == 3:
                            response = await hit(
                                "search",
                                "GET",
                                "/snippets",
                                params={"tag": tag, "q": "stressneedle"},
                            )
                            if response is not None and response.status_code == 200:
                                assert [
                                    item["id"] for item in response.json()["items"]
                                ] == [root]
                        elif operation == 4:
                            response = await hit(
                                "raw",
                                "GET",
                                f"/snippets/{root}/raw",
                                params={"path": "nginx.conf"},
                            )
                            if response is not None and response.status_code == 200:
                                assert response.text == payload["files"][2]["content"]
                        elif operation == 5:
                            await hit("health", "GET", "/health")
                        elif operation == 6:
                            await hit(
                                "library", "GET", "/snippets?scope=mine", headers=owner
                            )
                        else:
                            await hit(
                                "duplicate_star",
                                "PUT",
                                f"/snippets/{root}/star",
                                headers=owner,
                            )

                offset, start = len(results), time.perf_counter()
                await asyncio.gather(*(request(index) for index in range(160)))
                stages.append(
                    measure("mixed", offset, time.perf_counter() - start, concurrency)
                )

            gate = asyncio.Semaphore(10)
            saved_ids = []

            async def write(index):
                async with gate:
                    response = await hit(
                        "create",
                        "POST",
                        "/snippets",
                        201,
                        headers=owner,
                        json=dict(payload, visibility="private", title=f"Load {index}"),
                    )
                    if response is not None and response.status_code == 201:
                        id = response.json()["id"]
                        saved_ids.append(UUID(id))
                        read = await hit(
                            "reopen", "GET", f"/snippets/{id}", headers=owner
                        )
                        if read is not None and read.status_code == 200:
                            assert read.json()["files"] == payload["files"]

            offset, start = len(results), time.perf_counter()
            await asyncio.gather(*(write(index) for index in range(40)))
            stages.append(
                measure("save_and_reopen", offset, time.perf_counter() - start, 10)
            )
            with psycopg.connect(os.environ["DATABASE_URL"]) as db:
                assert db.execute(
                    "SELECT count(*) FROM snippets WHERE id=ANY(%s)", (saved_ids,)
                ).fetchone() == (40,)
                assert db.execute(
                    "SELECT count(*) FROM snippet_files WHERE snippet_id=ANY(%s)",
                    (saved_ids,),
                ).fetchone() == (120,)
                assert db.execute(
                    "SELECT count(*) FROM snippet_stars WHERE snippet_id=%s", (root,)
                ).fetchone() == (1,)
                assert db.execute(
                    "SELECT count(*) FROM snippets WHERE owner_id=%s", (users[0][0],)
                ).fetchone() == (42,)
            health = await api.get("/health")
            health.raise_for_status()
            print(
                json.dumps(
                    {
                        "stages": stages,
                        "measured_requests": len(results),
                        "unexpected_failures": failures[:10],
                        "unexpected_failure_count": len(failures),
                        "verified_writes": 40,
                        "verified_files": 120,
                        "health_after": health.json(),
                    },
                    indent=2,
                ),
                flush=True,
            )
            assert not failures, f"{len(failures)} unexpected load-test failures"
        finally:
            # These are new test identities, used exclusively by this run.
            with psycopg.connect(os.environ["DATABASE_URL"]) as db:
                owner_ids = [user[0] for user in users]
                db.execute(
                    "DELETE FROM snippet_stars WHERE snippet_id IN (SELECT id FROM snippets WHERE owner_id=ANY(%s))",
                    (owner_ids,),
                )
                db.execute(
                    "DELETE FROM snippet_files WHERE snippet_id IN (SELECT id FROM snippets WHERE owner_id=ANY(%s))",
                    (owner_ids,),
                )
                db.execute("DELETE FROM snippets WHERE owner_id=ANY(%s)", (owner_ids,))


if __name__ == "__main__":
    asyncio.run(main())
