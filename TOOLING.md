# Frontend tooling

## Stack and install order

Keep an existing repository’s package manager, lockfile, supported runtime, lint rules, and scripts. For a new app, use one supported Node LTS release compatible with the selected Next.js version, npm, and the Next.js App Router with TypeScript, ESLint, Tailwind, `src/`, and the `@/*` alias. Pin the chosen Node version, commit the lockfile, and record the actual versions in [MEMORY.md](MEMORY.md). Review the initial scaffold and preserve existing kit documents if scaffolding needs an empty directory. [Next.js installation](https://nextjs.org/docs/app/getting-started/installation)

| When | Tool | Use |
| --- | --- | --- |
| Checkpoint 0 | Next.js, TypeScript, Tailwind CSS | App Router, strict type checks, and semantic styling. |
| Checkpoint 1 | shadcn/ui with Radix primitives | Generate Button, Dialog, AlertDialog, and any form primitives needed for the current screen. Style them with the project tokens. |
| Checkpoint 1 | Motion (`motion`) | User-triggered feedback and reduced-motion support. |
| Checkpoint 1 | TanStack Query (`@tanstack/react-query`) | Browser query and mutation lifecycle behind feature hooks. |
| Checkpoint 2 | Monaco (`monaco-editor` with an optional `@monaco-editor/react` wrapper) | Desktop composer. Configure worker and asset loading for the built deployment. Keep a textarea alternative. |
| Checkpoint 3 | Shiki (`shiki`) | Reader syntax highlighting for a small language set. Plain text is always supported. |
| Checkpoint 5 | React Flow (`@xyflow/react`) | Optional read-only file relationships. Install when the panel is committed to scope. |
| Live gate | `openapi-typescript` | Generate from the project lead’s approved spec when available. Use the already selected transport or a typed client compatible with the contract. |

Pin compatible versions at scaffold time. Start without component catalogs, graph layout libraries, extra state stores, or animation packages beyond Motion. If Monaco uses a wrapper, verify that its loader and worker configuration do not rely on an accidental remote CDN or an unreviewed production network request. Verify assets under the real deployment policy. Keep the app usable if Monaco cannot load.

## Local workflow

For the greenfield npm path, expose the following scripts in `package.json`. Adapt commands if the existing project has equivalents.

```text
npm ci                  clean install after the lockfile exists
npm run dev             start the app with the documented mode
npm run lint            run ESLint
npm run typecheck       run the configured TypeScript check without emitting app code
npm run build           verify the production build
npm run start           smoke-test the production build locally
npm run test:e2e        run the Playwright smoke suite once added
```

Use a committed `.env.example` with the supported mode names and no credentials. Configure `NEXT_PUBLIC_SNIPPETS_MODE=demo` in the appropriate build environment for the demo. Select live mode only with approved wiring and settings. Publicly exposed variables are limited to values safe for the browser. Supply secrets through the deployment environment.

Keep the P0 test surface small. Cover path normalization, a three-file create and reload, rejected writes, missing records, and keyboard file navigation. Use Playwright for the browser smoke path and deterministic fixture overrides for failures. Record manual checks for touch, 200% zoom, keyboard trap avoidance in Monaco, reduced motion, and a screen reader. Use the browser’s accessibility inspection or an axe scan as a supplement to manual testing.

## Agent and browser setup

The repo, terminal, and a browser are sufficient. Use an available browser automation tool for reproducible smoke runs and screenshots. Official documentation or a connected documentation tool can resolve package-specific questions if needed. Keep external services optional. Use the project’s actual build and browser evidence to report progress.

## References

- [shadcn/ui components](https://ui.shadcn.com/docs/components) and [Radix Primitives](https://www.radix-ui.com/primitives/docs/overview/introduction)
- [Motion for React](https://motion.dev/docs/react) and [TanStack Query for React](https://tanstack.com/query/latest/docs/framework/react/overview)
- [Monaco Editor](https://github.com/microsoft/monaco-editor), [Shiki](https://shiki.style/guide/), and [React Flow](https://reactflow.dev/learn)
- [OpenAPI TypeScript](https://openapi-ts.dev/introduction) and [Playwright](https://playwright.dev/docs/intro)
