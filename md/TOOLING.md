# Backend tooling

| Need | Pick for the hackathon |
| --- | --- |
| API | FastAPI, Pydantic, and Uvicorn. Follow repository conventions for dependency pinning and a supported Python runtime. |
| Database | PostgreSQL with versioned migrations. Reuse the project’s driver and migration tool. For a new repo, start with one driver and SQL migrations or the team’s preferred migration tool. |
| Identity | Supabase Auth if confirmed. Use two separate test accounts for the demo. Keep identity verification on the server for all restricted operations. |
| Tests | pytest with HTTP integration tests against a real test database, and an actual-auth run before handoff. Tests can substitute the auth dependency for repeatable policy cases. |
| Discovery | PostgreSQL tag filtering and text search. |
| Contract | Owner-approved OpenAPI in Git. FastAPI docs are useful for inspection. Rishi generates types from the approved revision. |
| Deployment | Hosted backend and frontend or a reproducible local Docker Compose setup, per the brief. |

## Setup to document in the backend repository

1. Record the Python and database versions and dependency install command.
2. Document the config variables. Suggested names include `DATABASE_URL`, `SUPABASE_URL`, the approved auth configuration, and `FRONTEND_ORIGIN`. Commit an example with blank or safe values and ignore local secret files.
3. Provide the actual migrate, seed, run, and test commands once the repository exists. Give tests their own database. Avoid cleaning or resetting shared data.
4. Run the core smoke test with Sample A and Sample B accounts, plus an anonymous browser for read access and embeds.
5. Verify the target frontend’s auth, allowed origins, iframe rendering, raw headers, and real-time connectivity in the actual deployment.

Install dependencies as their checkpoints start. Redis, pgvector, and AI SDKs from the discussion are optional follow-up tooling.
