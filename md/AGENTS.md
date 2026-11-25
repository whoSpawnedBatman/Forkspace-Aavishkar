# Backend agent entry point

Implement the backend for AVISHKAR ’26 problem 35. Read [PROJECT.md](PROJECT.md), [PRD.md](PRD.md), [DATABASE.md](DATABASE.md), [ARCHITECTURE.md](ARCHITECTURE.md), [TOOLING.md](TOOLING.md), [MEMORY.md](MEMORY.md), and [CHECKLIST.md](CHECKLIST.md).

Start with the first unchecked checkpoint. Inspect the repository and look for the project lead’s canonical `openapi.yaml`. Work from its approved revision. If there is no spec and the project lead asks for help authoring it, mark the draft as proposed and confirm its actual paths, fields, and auth before treating it as shared.

Build the FastAPI/PostgreSQL create, list, and read workflow first, exercising real persistence and server-side permission checks. Use the technical notes and acceptance IDs in this kit to plan the embed, raw output, fork/edit, and tag-search follow-through. The frontend remains Rishi’s responsibility.

At the end of each phase, give the project lead the backend build reference, spec revision, and evidence so they can integrate it with Rishi’s matching frontend. Begin the next phase after the integrated checks pass. Record the tests run, observed behavior, and remaining work in MEMORY.md.
