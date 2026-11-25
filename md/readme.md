# Forkspace

Forkspace is a hackathon platform for sharing, discovering, and forking multi-file code snippets. It is intended to make small, reusable projects easy to publish, inspect, remix, and improve.

> Status: documentation scaffold. Stack, hosting provider, database, authentication provider, and deployment platform are intentionally left open until the team confirms them.

## Repository shape

This repository is expected to use a monorepo layout:

```text
/
├── apps/
│   ├── frontend/       # Rishi: user-facing discovery, preview, fork flows
│   └── backend/        # User-owned API, integrations, persistence, auth boundary
├── packages/
│   └── contracts/      # Versioned API schemas, shared types, generated clients
├── docs/               # Architecture decisions and operational notes
├── .env.example
├── AGENTS.md
└── README.md
```

The exact framework, language, package manager, database, and deployment provider are decisions to be recorded in `docs/decisions/` once confirmed. Do not infer them from this document.

## Ownership boundaries

### Frontend — Rishi

Rishi owns the user experience and frontend integration:

- browse, search, filter, and inspect snippets;
- show file trees and code previews;
- authenticate through the agreed integration boundary;
- create, edit, publish, and fork projects through the API;
- provide a mock-data mode while backend endpoints are incomplete;
- keep loading, empty, error, and unauthorized states explicit.

### Backend and integrations — user-owned

The backend boundary owns:

- API routes and request validation;
- users, projects, files, versions, forks, and permissions;
- persistence and migrations;
- authentication/session verification;
- search/indexing integrations, if selected;
- rate limits, audit events, and provider-specific adapters.

Neither side should reach into the other side's private implementation. Integration happens through `packages/contracts` and documented API endpoints.

## Branching and promotion

Long-lived branches:

- `main` — production-ready code only.
- `staging` — release candidate and integration environment.
- `develop` — shared development integration branch.

Short-lived branches should use a descriptive prefix:

```text
feature/<area>-<short-description>
fix/<area>-<short-description>
chore/<short-description>
docs/<short-description>
```

Recommended promotion flow:

```text
feature/* → develop → staging → main
```

Rules:

1. Work is committed to a feature branch and opened as a pull request into `develop`.
2. CI must pass before merge; reviewers verify scope, contracts, tests, and secrets hygiene.
3. A tested `develop` snapshot is promoted to `staging` for integrated verification.
4. A staging candidate is promoted to `main` only after the release checklist passes.
5. Hotfixes may branch from `main`, then must be back-merged into `staging` and `develop`.

The team may automate promotion later; until then, the branch policy remains the source of truth.

## CI checks

The eventual CI provider is not selected. The pipeline should provide equivalent checks for every pull request:

- install dependencies with the repository's lockfile;
- format and lint frontend, backend, and contracts;
- type-check all workspaces;
- validate contract changes and generated artifacts;
- run unit and integration tests;
- build frontend and backend artifacts;
- run a lightweight smoke test against a disposable or mocked environment;
- fail on leaked secrets, committed environment files, or invalid configuration.

Required checks should be branch-protection rules for `develop`, `staging`, and `main` once the repository is hosted.

## Environment separation

Use separate configuration and resources for:

| Environment | Purpose | Branch | Data policy |
|---|---|---|---|
| Local | Individual development | feature/* | Disposable local or mocked data |
| Development | Shared integration | develop | Non-production data only |
| Staging | Release candidate verification | staging | Isolated staging data |
| Production | Public application | main | Production data and controls |

Required configuration should be documented in `.env.example` using placeholder values only. Never commit real credentials, tokens, private keys, or production exports. Secrets belong in the selected environment's secret manager or CI secret store; the provider is intentionally undecided.

At minimum, configuration should distinguish API base URL, frontend origin, database connection, authentication settings, storage settings, third-party integration keys, logging level, and environment name. The final variable names are a team decision and must be kept consistent across apps.

## Contract-first integration

`packages/contracts` is the integration boundary between frontend and backend.

1. Define or update the request, response, error, and authentication shape first.
2. Review the contract change in the pull request.
3. Generate or update shared types/client artifacts if the chosen stack supports generation.
4. Implement the backend endpoint and validation.
5. Implement the frontend call and UI states.
6. Add contract-level tests and an integration smoke test.

Backward-incompatible changes require an explicit migration plan or a versioned endpoint. Error responses should be structured and stable enough for the frontend to render actionable states.

## Mock frontend mode

The frontend should be usable before the backend is complete. Mock mode must:

- use fixtures that follow the same contracts as real responses;
- be enabled through an explicit local configuration flag;
- simulate loading, empty, success, validation-error, unauthorized, and server-error states;
- make it obvious in the UI or developer documentation that data is mocked;
- remain replaceable without changing page-level components.

Do not let mock-only fields become accidental API requirements.

## Local setup

The commands below are placeholders until the package manager and frameworks are selected:

```text
# 1. Clone the repository and enter it
# 2. Install the pinned dependencies
# 3. Copy .env.example to the environment-specific local file
# 4. Start the frontend and backend development processes
# 5. Run checks and tests
```

When the stack is confirmed, replace this section with exact commands for installation, migrations/seeding, mock mode, tests, and production builds. Setup must not require access to production secrets or production data.

## Checkpoint-driven workflow

Each milestone should leave the repository in a runnable state and record evidence in the pull request.

### Checkpoint 0 — Decisions

Confirm stack, package manager, hosting, authentication, storage, database, and CI provider. Record decisions and unresolved placeholders.

### Checkpoint 1 — Skeleton

Create the monorepo workspaces, shared scripts, environment template, and minimal health/readiness paths.

### Checkpoint 2 — Contract

Define the first vertical-slice contract: list projects, read a project, and fork a project. Add fixtures and contract tests.

### Checkpoint 3 — Mock vertical slice

Rishi delivers browse, project detail, and fork UI against fixtures, including all major UI states.

### Checkpoint 4 — Backend vertical slice

Implement the same flow against persistence, validation, authorization, and integration tests.

### Checkpoint 5 — Environments

Configure local, development, staging, and production separation; verify secret handling and deployment rollback instructions.

### Checkpoint 6 — Release

Run CI, smoke tests, accessibility checks, security review, and the release checklist before promoting to `main`.

Every checkpoint should state: what changed, how it was verified, what remains, and which decision or risk is blocking the next checkpoint.

## Contribution expectations

Keep pull requests small enough to review. Include the user-visible behavior, affected contracts, configuration changes, test evidence, migration notes, and rollback considerations. Update this README or `AGENTS.md` when workflow rules change.

## Open decisions

The following are intentionally unresolved placeholders:

- frontend and backend frameworks;
- language and package manager;
- API style and schema format;
- database and migration tool;
- authentication and authorization provider;
- file/object storage;
- search/indexing solution;
- CI/CD provider and deployment platform;
- observability and error tracking;
- production domain and custom infrastructure.

