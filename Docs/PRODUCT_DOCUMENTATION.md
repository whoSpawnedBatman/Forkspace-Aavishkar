# Forkspace Product Documentation

## Product summary

Forkspace is a secure, collaborative code-snippet workspace for saving, sharing,
forking, explaining, and embedding small multi-file projects. It is designed for
developers who need more context and control than a single paste, without the
operational weight of a full repository platform.

## Problem statement

Developers repeatedly lose useful code in isolated chats, temporary files, and
unstructured paste services. Existing workflows make it difficult to:

- preserve multiple files and exact contents;
- control who can see a snippet;
- share an embeddable, read-only version safely;
- fork another developer's work without overwriting the source;
- understand lineage and changes over time; and
- ask grounded questions about the saved code.

## Product constraints

The solution was required to work within a bounded hackathon scope:

- PostgreSQL as the durable store;
- Supabase Auth for identity;
- a real HTTP API between frontend and database;
- no direct browser access to PostgreSQL;
- public, unlisted, and private visibility semantics;
- exact file persistence and atomic edits;
- safe anonymous embeds with escaped code;
- bounded request, file, context, and model-output sizes; and
- a local Docker workflow that could be validated end to end.

## Core experience

1. Sign in with email and password.
2. Create a snippet from a blank editor or import existing files.
3. Save title, description, tags, visibility, and ordered files.
4. Reopen the exact saved project after refresh.
5. Share an unlisted embed or a private shared workspace.
6. Fork a snippet into an independently editable private copy.
7. Publish the fork, search it, star it, and inspect its public lineage.
8. Read a grounded explanation using only retrieved code context.

## Visibility and expiry

- Public snippets are listed and embeddable.
- Unlisted snippets are hidden from discovery and available through a link.
- Private snippets are owner-only unless access is explicitly granted.
- Unlisted and private shared access can expire after 1 hour, 1 day, 7 days, or never.
- Owners retain access to their own snippets.

## Innovations

- **Fork graph:** public lineage is represented as a live graph rather than a flat list.
- **Grounded code assistant:** answers include the file and line sources used for context.
- **Safe embed surface:** code is escaped and rendered read-only with restrictive headers.
- **Write-path watchdog:** high-confidence dangerous-code signatures are rejected before persistence.
- **Atomic project edits:** metadata and files commit together, preventing partial saves.
- **Import-first workflow:** users can start from a blank editor, local files, or a GitHub repository.

