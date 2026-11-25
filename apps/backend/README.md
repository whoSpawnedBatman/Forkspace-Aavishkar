# Forkspace backend

Rishi's integration contract is `packages/contracts/openapi.yaml`, version `0.2.0`.
The API serves that same document at `/openapi.json` and Swagger UI at `/docs`.

## Start locally

Run from the repository root with Docker Desktop running. For first-time setup:

```powershell
Copy-Item .env.example .env
```

Set `SUPABASE_AUTH_URL` to the frontend project's Supabase URL followed by
`/auth/v1`, set `SUPABASE_PUBLISHABLE_KEY` to its publishable or legacy anon
key, and set `FRONTEND_ORIGIN` to the browser origin, including its port.

```powershell
docker compose up --build -d
Invoke-RestMethod 'http://localhost:8000/snippets'
```

The local stack uses Python 3.12 and PostgreSQL 16. The API applies versioned
migrations at startup under a PostgreSQL advisory lock. Existing Phase 1 data
is upgraded in place. Restarting the API or running `docker compose down`
preserves the named data volume. The API runs as an unprivileged container user.
Check readiness at `GET /health`.

Point the frontend adapter at `http://localhost:8000`. Send the Supabase session
access token in `Authorization: Bearer <access_token>`. On a successful create,
read the returned `id` and open `GET /snippets/{id}`. Use `GET /snippets?scope=mine`
for the owner's library and `GET /snippets` for public discovery.

## Frontend adapter handoff

- `PUT /snippets/{id}` atomically replaces the complete title, tags, visibility
  and file list, using the same request body as create. Only the owner can edit.
  The last committed edit wins. Read the latest snippet before opening the editor.
- `POST /snippets/{id}/fork` takes no body and returns a newly committed private
  fork ID. The verified caller owns the fork. Use PUT to edit or publish it.
- `GET /snippets?tag=docker&q=nginx` combines tag and full-text filters.
  Public scope excludes private and unlisted snippets. `scope=mine` searches
  the caller's own library. Sorting and pagination follow the contract.
- `GET /snippets/{id}/raw?path=nginx.conf` returns exact plain text with
  `nosniff`. URL-encode the saved path.
- Use `http://localhost:8000/embed/{id}` as an iframe source for public or
  unlisted snippets. This view escapes code and detects syntax on the server.
  Private embeds return 404 for every caller.
- `GET /snippets/{id}/star` returns `count` and `starred`.
  PUT and DELETE on that path idempotently save or remove the caller's star.
- `GET /snippets/{id}/graph` returns connected public lineage as `nodes` and
  `edges`. Hidden ancestors and descendants are excluded. Detail responses
  expose a parent ID only when the parent is public or owned by the caller.
- Subscribe with `new EventSource(apiOrigin + "/snippets/" + id + "/events")`.
  Handle `graph_changed` by refetching the graph. Handle `unavailable` by
  closing the stream and removing the stale graph. Reconnect always starts
  with an invalidation so the client can recover missed updates.

Search computes PostgreSQL text vectors over the current dataset. Graph streams
poll committed public graph state every second, sending empty invalidation
events when it changes. These choices suit the bounded hackathon dataset.
Graph responses contain the entire connected public lineage.

## Seed safe demo content

Create two separate accounts through your Supabase Auth sign-in flow. Obtain
the first account's access token locally, then pass it through an environment
variable. The seed command creates a synthetic three-file Docker snippet for
each visibility. Each run creates three new records.

```powershell
$env:SEED_OWNER_TOKEN = '<first-account-access-token>'
docker compose exec -e SEED_OWNER_TOKEN api python seed.py
Remove-Item Env:SEED_OWNER_TOKEN
```

Use the second account to fork and edit the seeded public snippet. Backend
ownership always comes from server-verified identity.

## Repeat the HTTP acceptance test

From the same directory, run the isolated test stack. It provisions its own
PostgreSQL volume and internal Supabase Auth instance, signs up two test users,
and restarts a real API process between save and read.

The suite also exercises fork independence, edit rollback, search, stars,
concurrent duplicate stars, hidden lineage, raw headers, embed escaping and SSE
updates. Tests use temporary database schemas and never reset the shared
application schema. Test images include pytest, contract validation and Ruff.

```powershell
$env:TEST_JWT_SECRET = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
docker compose -p forkspace-phase1-test -f compose.yaml -f compose.test.yaml run --build --rm api python -m pytest -q -s tests
docker compose -p forkspace-phase1-test -f compose.yaml -f compose.test.yaml down
```

Run static checks in the same test image:

```powershell
docker compose -p forkspace-phase1-test -f compose.yaml -f compose.test.yaml run --rm --no-deps api ruff check .
```

The test auth service uses a fresh signing secret from the command above and
is internal to the isolated test stack. Configure the regular stack with
the same hosted Supabase project as the frontend for the later integration run.
