# Forkspace integration report

Date: 26 November 2026

## Status

The local integrated stack is healthy:

- Frontend: `http://localhost:3100` returns HTTP 200.
- Backend: `GET /health` returns `{"status":"ok"}`.
- Docker demo services are healthy.

## Verified features

Two separate local Supabase accounts were used to verify account creation, sign-in,
three-file creation, exact file persistence, descriptions, refresh/reopen, validation,
stars and starred scope, raw output, anonymous embeds, private denial, private raw access,
fork ownership, independent fork edits, publishing, tag and full-text discovery, public fork
graphs, and live graph updates.

## Checks

- Backend acceptance suite: 9 passed.
- Targeted embed regression: passed.
- Live graph regression: passed.
- Ruff: passed.
- Frontend TypeScript check: passed.
- Next.js production build: passed.
- Browser console errors during the final main flow: none.

The report covers the local/demo environment. Hosted Supabase credentials and Vercel runtime
configuration were not modified by the integration tests.
