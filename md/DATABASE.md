# PostgreSQL data model

Use the existing repository’s database tooling where available. Otherwise start with a small, versioned migration. The names below are proposed storage names. The canonical API can map them to different response field names.

| Table | Fields and constraints | When |
| --- | --- | --- |
| `snippets` | App-generated opaque UUID primary key, verified owner ID, title, visibility constrained to public/unlisted/private, normalized tags as `text[]`, `created_at` and `updated_at` with timezone, and nullable `parent_snippet_id` referencing `snippets.id` once forking lands. | First slice, lineage by B05 |
| `snippet_files` | `snippet_id` foreign key, normalized relative `path`, `position`, and `content` as text. Optional language override only if agreed in the contract. Unique path and position within each snippet. Cascade file deletion if snippet deletion is later enabled. | First slice |
| `snippet_stars` | Verified user ID, `snippet_id` foreign key, and timestamp. Composite primary key on user and snippet. | B07 |

Use the verified auth subject as the owner ID. A separate users table is unnecessary for the first slice unless the chosen auth integration needs one. If Auth is provisioned separately, avoid assuming a database foreign key to its user table.

## Writes and validation

- Create the snippet and all files in one transaction. Update or fork in a transaction as well. A fork gets its own file rows and references its source through the parent ID. Lock or recheck source visibility inside the fork transaction when visibility changes can race a fork. Keep parent linkage immutable.
- Require a trimmed nonempty title and at least one file. Agree on title length, maximum file count, per-file size, total request size, and tag limits in the contract before enforcing exact numbers. Preserve original file text and ordering.
- Align path validation with Rishi. Normalize slashes and surrounding whitespace, reject empty, absolute, traversal, drive-prefixed, and control-character paths, and enforce unique normalized paths with a documented case policy. File paths identify database entries.
- Store only server-assigned IDs, owner identity, timestamps, and lineage. On any failed write, leave no partial snippet or fork.
- Normalize and deduplicate tags. Agree on the display and filter behavior. Preserve file order with explicit integer positions.

## Reads and indexes

Start with indexes for owner-library order, public discovery order, and parent lookup when forking is added. Use bound SQL parameters. Apply authorization before returning rows, counts, and search results. The owned library may include the caller’s private and unlisted rows. Public discovery includes public rows only.

For tag search, filter normalized tags. For full-text search, match titles and file content with PostgreSQL text search. Start with a query over the bounded demo dataset, then measure before adding a maintained search document or index. Test results when a term appears only in a file and when the matching snippet is private. [PostgreSQL text search](https://www.postgresql.org/docs/current/textsearch-controls.html)

Seed an original public Docker snippet, a private snippet, and an unlisted snippet with synthetic content. Associate test records with real test identities created in the demo auth environment. Document the seed command and keep seed credentials out of Git.
