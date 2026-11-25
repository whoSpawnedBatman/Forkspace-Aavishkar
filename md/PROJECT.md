# Code Snippet & Gist Sharing Hub

Backend engineering kit for AVISHKAR ’26, problem statement 35. The team has 24 hours to demonstrate a working full-stack application.

The product lets developers package related source and configuration files into one snippet. A user can control access, embed a snippet on another site, and make an independent copy while preserving its origin.

## Ownership

| Owner | Work |
| --- | --- |
| Backend owner and project lead | FastAPI, PostgreSQL, authentication and authorization, the canonical `openapi.yaml`, backend tests, deployment, and final frontend integration. |
| Rishi | Entire frontend, including the editor and reader, visibility controls, public embed UI as agreed, fork graph, discovery, and connecting frontend screens to their typed adapter. |

Start with real persistence for one multi-file snippet. Then complete the judging journey: one user creates a snippet and copies its embed link, a second user forks and edits it, and the fork can be found by tag once it is public. Finish the remaining brief requirements before submission. [PRD.md](PRD.md) and [CHECKLIST.md](CHECKLIST.md) define both checkpoints.

Work in matching frontend and backend phases. At the start of each phase, agree on its contract revision and shared acceptance checks. Both developers build their parts, then the project lead connects them and runs the checks against the real backend. Start the next phase after the integrated flow passes. Rishi can build against fixtures while the backend for that phase is in progress.

The current frontend kit was drafted before the official brief was available. When you hand Rishi the contract, also hand him the updated core priorities in [PRD.md](PRD.md). In particular, the required graph shows **snippet fork lineage**. A diagram of files within a snippet serves a different purpose.

The organizer’s image governs submission coverage. The pasted discussion informs the proposed implementation stack and optional ideas. This kit records decisions and acceptance checks. The project lead publishes the canonical OpenAPI contract for both developers to use.
