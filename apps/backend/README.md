# Forkspace backend

Rishi's integration contract is `packages/contracts/openapi.yaml`, version `0.2.0`.
The API serves that same document at `/openapi.json` and Swagger UI at `/docs`.

## Integrated UI verification · 26 November 2026

The imported workspace UI now uses the live API and Supabase session. The local
production demo runs at `http://localhost:3100` through `start-demo.ps1`.
Migration 005 adds descriptions without replacing existing snippet data.
Summary responses include owner identity, ordered file paths, and persisted star
state; `scope=starred` applies the same read permissions as snippet details.

Verified with two separate browser accounts: account creation, rejected empty
title, three-file Monaco creation, exact saved file contents and description,
refresh, star and starred library, anonymous iframe rendering, raw text headers,
private-fork denial, authenticated private raw reads, independent fork ownership
and edits, publication, combined tag/text discovery, and public fork graph.
A title change from the second account appeared in the first account's graph
without refreshing. Event streams send `Cache-Control: no-store, no-transform`
so the Next.js proxy does not gzip and buffer live updates.
Embed return links use a configured frontend origin for both sandbox and external
referrers. Sign-in can return to the requested snippet URL.

Validation: nine backend acceptance tests passed, the targeted embed-link
regression and live-graph regression passed after their final fixes, Ruff passed, TypeScript passed, and the
Docker frontend production build completed. Both demo services report healthy.
Hosted authentication and cloud deployment were not changed or verified in this run.

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

## Local load and recovery checks

Start the isolated test stack, then run regression and load checks sequentially.
The load script requires the local test auth URL and removes only the records
owned by its two freshly created test identities.

```powershell
$env:TEST_JWT_SECRET = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
docker compose -p forkspace-phase1-test -f compose.yaml -f compose.test.yaml up --build -d --wait
docker exec forkspace-phase1-test-api-1 python -m pytest -q tests
docker exec forkspace-phase1-test-api-1 python tests/stress.py
Invoke-RestMethod http://localhost:8000/health
```

The measured local run on 25 November 2026 passed all six regression tests in
29.22 seconds and completed 560 load requests with zero unexpected failures.
Mixed requests at concurrency 5, 20 and 50 achieved respectively 22.05, 28.46
and 28.46 requests/second. Their p95 latencies were 442.1, 1247.8 and
3233.4 milliseconds. Expected 404 privacy denials and 422 invalid-save
responses were validated. Forty concurrent saves reopened with all 120 files
intact, and duplicate stars left a single row. Load records were removed afterward.

Stopping the isolated database made health return HTTP 500 with a structured
service_error. Starting it again restored HTTP 200 and status ok without an
API restart. Health confirms API-to-database connectivity. The regression
tests exercise auth separately. This bounded workload measures the local
machine and dataset, with no production capacity or long-duration guarantee.

## Backend architecture for beginners

Forkspace has one FastAPI application and one PostgreSQL database. The frontend
does not connect to PostgreSQL directly. It calls HTTP endpoints, and the API
decides what the caller may read or change before it touches the database.

    Browser
      |
      | Supabase session access token
      v
    Next.js frontend
      |
      | Authorization: Bearer <token>
      v
    FastAPI API
      |-- verifies the token with Supabase Auth
      |-- validates the request with Pydantic
      |-- checks public, unlisted, private and owner permissions
      |-- reads or writes PostgreSQL
          |-- snippets
          |-- snippet_files
          |-- snippet_stars
          |-- schema_migrations

The important trust rule is that the frontend never tells the backend who owns
a snippet. The backend gets the user ID from the verified Supabase token and
uses that ID as owner_id. A client cannot save a snippet for someone else by
adding an owner_id field to the request.

### What each backend file does

| File | Purpose |
| --- | --- |
| apps/backend/main.py | FastAPI routes, authentication, permissions, embeds and SSE. |
| apps/backend/models.py | Validation for titles, tags, paths, files and visibility. |
| apps/backend/database.py | PostgreSQL connection and startup migration runner. |
| apps/backend/migrations/001_snippets.sql | Original snippet and file tables. |
| apps/backend/migrations/002_features.sql | Fork lineage, timestamps and stars. |
| apps/backend/seed.py | Creates safe demo snippets through the API. |
| apps/backend/tests/ | Regression, contract and load tests. |
| apps/backend/Dockerfile | Python 3.12 API image running as user app. |
| compose.yaml | Regular local PostgreSQL and API services. |
| compose.test.yaml | Isolated local Supabase Auth test service. |
| packages/contracts/openapi.yaml | The frontend and backend integration contract. |

### How a save works

The frontend sends one JSON request containing a title, tags, visibility and
the ordered file list.

    {
      "title": "Local nginx",
      "tags": ["docker", "nginx"],
      "visibility": "public",
      "files": [
        {"path": "Dockerfile", "content": "FROM nginx:alpine"},
        {"path": "nginx.conf", "content": "events {}"}
      ]
    }

FastAPI validates the request first. The API then inserts the parent snippet
and all file rows inside one PostgreSQL transaction. The connection context
commits only when every insert succeeds. If one file fails, PostgreSQL rolls
back the snippet and earlier file inserts together. The API returns the ID only
after the commit succeeds.

### How visibility works

| Visibility | Public list | Direct read | Owner read |
| --- | --- | --- | --- |
| public | Included | Everyone | Yes |
| unlisted | Excluded | Anyone with the ID | Yes |
| private | Excluded | Owner only | Yes |

The same permission rule is applied to details, raw files, embeds, forks,
stars and graph access. An inaccessible private record returns the same 404
shape as an unknown record, so its existence is not disclosed.

### How login connects to the API

The frontend signs in with Supabase Auth. Supabase returns a session containing
an access token. The frontend sends that token with each protected API request.
The backend calls Supabase Auth's user endpoint to verify the token. It then
uses the verified UUID for owner checks.

The frontend needs these public variable names in its local environment file.

    NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
    NEXT_PUBLIC_API_URL=http://localhost:8000

The backend needs these variable names in its local environment file.

    DATABASE_URL=postgresql://postgres:local-only@db/forkspace
    SUPABASE_AUTH_URL=https://your-project.supabase.co/auth/v1
    SUPABASE_PUBLISHABLE_KEY=your-publishable-key
    FRONTEND_ORIGIN=http://localhost:3000

Secret keys belong in server secret storage. They must never appear in frontend
environment variables, browser code, Git, screenshots or documentation.

### How the judging flow maps to endpoints

| User action | Backend call | Expected result |
| --- | --- | --- |
| Sign in | Supabase Auth in frontend | Access token available. |
| Save files | POST /snippets | 201 with a new snippet ID. |
| Reopen after refresh | GET /snippets/{id} | Metadata and exact ordered files. |
| Copy embed link | Build /embed/{id} | Public or unlisted read-only HTML. |
| Fork as user B | POST /snippets/{id}/fork | New private snippet ID owned by B. |
| Edit the fork | PUT /snippets/{fork_id} | Complete replacement committed atomically. |
| Publish the fork | Same PUT with visibility public | Fork enters public discovery. |
| Search by tag | GET /snippets?tag=docker | Public matching snippets only. |

### What the frontend should do

The frontend should keep the Supabase session and attach its current access
token through one shared API helper. It should use the returned ID after create,
refresh the detail endpoint after navigation, and show the API error code,
message and optional field details.

For the demo, use this order:

1. Sign in as user A.
2. Create a public three-file snippet tagged docker.
3. Read the returned ID and show the saved snippet.
4. Copy the /embed/{id} URL.
5. Sign in as user B.
6. Fork the original.
7. Edit the fork and set visibility to public.
8. Search docker and show the fork.

The API already supports the backend side of this sequence. Frontend work
remains responsible for screens, session state, Monaco editing, React Flow
rendering and user-facing loading and error states.

### Common status codes

| Status | Meaning |
| --- | --- |
| 200 | Read or update completed. |
| 201 | A snippet or fork was committed and its ID is returned. |
| 401 | A required token is missing or invalid. |
| 404 | The ID is missing or the resource is hidden from this caller. |
| 413 | The JSON body is larger than 1 MiB. |
| 422 | Request validation failed. |
| 500 | PostgreSQL or an identity provider dependency is unavailable. |

### Why Redis and pgvector are not required for the demo

The requested judging flow only needs PostgreSQL filtering and full-text
search. The current implementation computes the search vector from the saved
title and files. Redis and pgvector can be added later if measurement shows
that the dataset needs them. They are not required for create, fork, edit and
tag search.

### Troubleshooting

If the API does not start, check docker compose logs api and then run:

    Invoke-RestMethod http://localhost:8000/health
    docker compose ps

If every protected request returns 401, inspect the browser token and confirm
that the backend SUPABASE_AUTH_URL and publishable key belong to the same
Supabase project as the frontend. If the browser reports a CORS error, set
FRONTEND_ORIGIN to the exact frontend origin, including its port.

If a user can log in but cannot save, check that the frontend sends
Authorization: Bearer <access_token> and that the request body follows
packages/contracts/openapi.yaml version 0.2.0.
