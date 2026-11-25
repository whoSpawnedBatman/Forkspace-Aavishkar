# Backend project memory

Initial handoff dated 25 November 2026. This is a planning baselinicec 

## Full backend verification · 25 November 2026

### Local regression, load and recovery rerun

- Six regressions passed in 29.22 seconds against the running local Docker stack.
- The bounded load test completed 560 measured HTTP requests with zero unexpected failures. Mixed concurrency 5/20/50 achieved 22.05/28.46/28.46 requests per second with p95 latency 442.1/1247.8/3233.4 ms.
- Forty concurrent creates reopened with all 120 exact file texts. Expected invalid-save and private-read rejections passed, duplicate stars remained unique, and the script removed its own records afterward.
- Health returned 200 and status ok before and after load. A stopped database produced structured 500 service_error, and restarting the database restored health 200 without an API restart.
- The local API remains running on localhost port 8000 with isolated local Supabase Auth. Hosted-project and browser integration remain pending. Reproduction commands and limits are recorded in the backend README.

The project lead authorized completion of the remaining backend before frontend integration, followed by a backend-only commit on the backend branch.

- Contract revision `0.2.0` adds complete replacement edits, private-by-default forks, raw files, escaped highlighted iframe HTML, tag and full-text discovery, persisted stars, public fork graphs and SSE invalidations.
- Final backend tests passed, `6 passed in 35.11s`, against local PostgreSQL 16 and separate local Supabase Auth accounts. The API ran as an unprivileged container user.
- Verified create/reopen after restart, invalid-save and failed-edit rollback, owner-only edits, fork independence, public-only discovery, private denial, hidden parent links, concurrent duplicate stars, star persistence after restart, SSE publish/hide invalidation, contract schemas and authenticated seeding.
- Verified an existing Phase 1 record survived migration and two API starts. Migration tracking uses an advisory lock and upgrades in place.
- Ruff passed against the final formatted backend files. Contract validation passed. Tests create and remove only temporary schemas.
- Runbook and frontend handoff are in `apps/backend/README.md`. Integration with the hosted auth project and Rishi's browser UI remains pending.
