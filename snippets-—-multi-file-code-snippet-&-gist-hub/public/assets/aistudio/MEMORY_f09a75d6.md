# Frontend project memory

Baseline recorded 25 November 2026. Update after each checkpoint and whenever the contract, scope, or demo status changes.

## Confirmed context

- Rishi owns the complete frontend. The project lead owns backend, database, AI, canonical `openapi.yaml`, final integration, and release verification.
- Agreed frontend stack is Next.js, TypeScript, Tailwind, shadcn/Radix, Motion, Monaco, Shiki, React Flow, and TanStack Query. Delivery order is in [TOOLING.md](TOOLING.md).
- The Wispr Flow reference informs hierarchy, pacing, and product demonstration. The detailed design choices in [DESIGN.md](DESIGN.md) are proposed for this handoff.
- The earlier ChatGPT planning conversation was reviewed. It described a two-frontend-developer kit that preceded the current assignment. Its actual file contents, a project repository, and the official judging rubric were unavailable during this handoff. Earlier sample HTTP operations are illustrative and have no standing in the live adapter.

## Decisions to carry forward

| Decision | Status |
| --- | --- |
| Working UI label “Snippets”, route map, P0 create/read path, and P1 ordering | Handoff planning defaults. Confirm with the project lead if the rubric differs. |
| Same-browser demo persistence behind a typed domain adapter | Handoff design. Demo is labeled and isolated from live. |
| Dependency versions and repository conventions | Pending scaffold or source review. |
| Repository location, branch, and deployment target | Pending. |
| Application progress and evidence | Implementation pending. This memory contains initial documentation only. |

## Open integration inputs

| Input | Owner | Impact |
| --- | --- | --- |
| Canonical spec path and exact revision or checksum | Project lead | Blocks generated types and live operation mapping. |
| Authentication, session behavior, access semantics, and environment | Project lead | Blocks live permission behavior, auth UI decisions, and release validation. |
| Available operations, validation limits, visibility, and share URL rules | Project lead | Blocks live mapping and determines P1 share capability. |
| Relationship and explanation support, including any streaming transport | Project lead | Determines P1 live controls. |
| Official judging rubric and finalized product name | Project lead | May change scope and copy. |
| Node/package manager, lockfile, repository conventions, and fixtures | Rishi | Record at checkpoint 0 or 1 as applicable. |

## Log template

Copy one entry per checkpoint or material decision. Link evidence or paste a short reproducible command and result.

```text
Date and owner:
Checkpoint and acceptance IDs:
Commit or build reference:
Mode and environment:
Decision and reason:
Evidence and result:
Open gap, owner, and next check:
```
