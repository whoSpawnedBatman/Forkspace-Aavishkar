# Multi-file snippet platform

Frontend engineering handoff for Rishi, 25 November 2026. The product name is open. Use “Snippets” as the working UI label.

## Product

Developers need to capture and revisit small, related sets of source files as a single snippet. A snippet has a title and distinct file paths, so the reader can follow the example without reconstructing it from separate pastes. The hackathon demo starts with a three-file example, creates a second example, and reopens it to verify that every saved file is present.

## Ownership

| Owner | Responsibility |
| --- | --- |
| Rishi | Entire frontend. Product screens, responsive UI, accessibility, editor and viewer, design system, domain adapter interface, fixtures, frontend checks, and handoff evidence. |
| Backend owner and project lead | Backend, database, security and access rules, AI engine, canonical `openapi.yaml`, final wiring, and end-to-end release verification. |

Rishi can start immediately in demo mode. Ask the project lead to resolve a missing backend capability through the shared spec. Record the answer and affected acceptance criteria in [MEMORY.md](MEMORY.md). Both workstreams reference the same canonical spec revision. If copies are necessary, use identical bytes and record the commit or checksum.

## Scope and order

- **P0**: Landing, snippet library, multi-file creation, read-only detail, and direct reopen. Ship a clearly labeled same-browser demo and a stable adapter boundary. Live delivery requires the real integration gate in [CHECKLIST.md](CHECKLIST.md).
- **P1**: Editing saved snippets, public sharing where the contract permits it, a read-only relationship graph, and one narrowly scoped AI explanation flow. Start only after the P0 path works. See the recommended build order in [PRD.md](PRD.md).
- **P2**: Forking, richer discovery, extra graph tools, theme switching, additional AI features, and other polish.
- **Outside the hackathon build**: Running uploaded code, live collaboration, a full repository IDE, and a custom identity system.

The P0 route map and priority cuts are planning decisions for this handoff. If the judging rubric adds a hard requirement, update [PRD.md](PRD.md), [CHECKLIST.md](CHECKLIST.md), and [MEMORY.md] before changing implementation.

## Working agreement

Treat code as text. Keep edits local to the editor until the chosen save operation confirms persistence. Use the typed domain adapter for snippet and backend data. Actual URLs, payloads, auth, capability rules, and streaming behavior come from the project lead’s approved spec and integration configuration. UI screens should remain usable while those details are pending.

Use “Saved in this browser” for confirmed demo writes and “Saved” for confirmed live writes. A failed storage or network operation keeps the draft and offers an appropriate recovery. A copied demo link is local to a browser profile and origin.

## Start here

Read [PRD.md](PRD.md) for behavior, [DESIGN.md](DESIGN.md) for screen and interaction rules, [ARCHITECTURE.md](ARCHITECTURE.md) for the adapter and state model, and [TOOLING.md](TOOLING.md) for setup. Execute [CHECKLIST.md](CHECKLIST.md) and put decisions and evidence in [MEMORY.md](MEMORY.md). [AGENTS.md](AGENTS.md) is the repository entry point for a coding agent.
