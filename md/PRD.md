# Backend product requirements

## Build order and acceptance

| ID | Priority | Capability | Acceptance check |
| --- | --- | --- | --- |
| B01 | P0 first slice | Authenticated create | User A creates a snippet with `Dockerfile`, `docker-compose.yml` and `nginx.conf`, a title, tags, and visibility. The server confirms success and returns a stable ID after the transaction commits. The verified identity determines ownership. |
| B02 | P0 first slice | Read and list | User A reads the saved record by ID after refresh and API restart. Verify exact file contents and stable ordering. The owned library lists the snippet with its title, tags, visibility, and file count. Validation failure creates no partial data. |
| B03 | P0 first slice | Visibility and owner checks | Public records are discoverable. Unlisted records open by direct link and stay out of public discovery. Private records are readable only by the owner for this prototype. Check guest, owner, and another signed-in user against the access matrix in [ARCHITECTURE.md](ARCHITECTURE.md). |
| B04 | P0 judging flow | Embed and raw | Copy the embed URL and render the three files with auto-detected highlighting in an iframe on a separate test page. Verify public and unlisted links in a fresh browser. A raw file response preserves the stored text and returns `Content-Type: text/plain; charset=utf-8` and `X-Content-Type-Options: nosniff`. Private snippet data stays inaccessible through public embeds and unprivileged raw requests. |
| B05 | P0 judging flow | Fork and edit | User B signs in, forks an accessible snippet, and edits the fork. It has a new ID and owner, retains its parent relationship, and leaves the original intact. A fork starts private as a proposed safe default. B explicitly makes it public for the judging demo. |
| B06 | P0 judging flow | Tag discovery | From a fresh guest session, searching or filtering by the agreed tag finds the now-public fork. Unlisted and private snippets do not appear in public results, counts, or previews. |
| B07 | P1 required before submission | Full-text search and stars | A term present only in a public snippet’s file content finds that snippet. Title terms work too. Signed-in users can star and unstar readable snippets, and the state survives reload. Repeated requests do not create duplicate stars. |
| B08 | P1 required before submission | Fork graph and real-time | Show an original and its visible forks in a small, read-only graph. With the public original’s graph open, a visible new fork appears without a page reload. Private and unlisted forks stay out of the public graph and update stream. Ship the simplest working graph and one live update. |
| B09 | P1 required before submission | Runnable deployment | Run the actual integrated backend and frontend through the full judging flow on a hosted URL or with Docker Compose. Include reproducible setup, two test accounts, and safe seed snippets. Confirm structured errors and server-side access rules in the target environment. |

## Scope calls

- The official brief calls for an embed widget. Use a working, read-only iframe first. The code remains text, with highlighting handled by the frontend. Preserve raw output separately.
- Use authenticated user and owner permissions for the prototype. The official brief requires role-based access control and leaves additional roles unspecified.
- P2 extensions from the discussion include AI adaptation, semantic search, AI fork analysis, AI cross-file validation, and more elaborate graph controls. Add them after submission requirements pass.

## Judge walkthrough

1. User A signs in, creates a public three-file Docker snippet tagged `docker`, and reopens it.
2. A copies the iframe link. Open it on a separate page and verify rendered files.
3. User B signs in in a second browser profile, opens the original, forks it, edits it, and explicitly publishes the fork. Verify the original still has its original content.
4. Find B’s fork through `docker` tag discovery. Show its visible parent relationship and live fork update. Check a raw file response and demonstrate star/unstar if time permits in the presentation.
