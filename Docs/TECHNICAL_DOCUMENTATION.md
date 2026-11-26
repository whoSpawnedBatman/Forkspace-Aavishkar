# Forkspace Technical Documentation

## Architecture

```text
Browser
  -> Next.js frontend
  -> FastAPI backend
  -> PostgreSQL
  -> Supabase Auth for token verification
```

The browser never connects directly to PostgreSQL. Ownership comes from the
verified Supabase token, not from a client-supplied owner field.

## Backend boundaries

- Pydantic validates titles, tags, paths, visibility, files, and request size.
- Each file is limited to 5 MiB UTF-8.
- The JSON request envelope is limited to 6 MiB.
- Writes run in PostgreSQL transactions.
- A failed file insert rolls back the entire snippet edit.
- Private resources return the same not-found shape as unknown resources.

## Security controls

The write-path watchdog scans submitted text for high-confidence signatures such
as download-and-execute shell pipelines, destructive root deletion, encoded
PowerShell, direct OS command execution, and fork bombs. It does not execute
submitted code.

The scanner runs in a private hardened container with no published host port,
no Linux capabilities, read-only storage, and `no-new-privileges`. The API fails
closed if the scanner is unavailable.

Embeds use escaped code, `nosniff`, no-store caching, restrictive CSP, and no
script execution. Raw file responses are plain text.

## Data model

Core tables include:

- `snippets`
- `snippet_files`
- `snippet_access`
- `snippet_stars`
- `snippet_chunks`
- `schema_migrations`
- `button_events`
- `language_usage`

Migrations are versioned and applied under a PostgreSQL advisory lock. Existing
data is upgraded in place.

## API capabilities

- `POST /snippets`
- `GET /snippets`
- `GET /snippets/{id}`
- `PUT /snippets/{id}`
- `POST /snippets/{id}/fork`
- `PUT /snippets/{id}/access`
- `GET /snippets/{id}/raw`
- `GET /embed/{id}`
- `PUT`, `DELETE`, and `GET /snippets/{id}/star`
- `GET /snippets/{id}/graph`
- `GET /snippets/{id}/events`
- `POST /snippets/{id}/ask`

## Assistant limits

The grounded assistant is bounded to 3 requests per user and snippet per minute,
4,000 context characters, 200 output tokens, and a 20-second provider timeout.
OpenAI is the primary provider and Gemini is the configured fallback. Provider
keys belong in deployment secret storage only.

