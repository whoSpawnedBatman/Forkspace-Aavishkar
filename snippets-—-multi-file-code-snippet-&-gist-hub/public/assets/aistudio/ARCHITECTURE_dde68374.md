# Frontend architecture

## Application structure

Use Next.js App Router and strict TypeScript. Keep route modules, metadata, and static layout server-rendered where possible. Use client boundaries for interactive feature screens, the active adapter, and the TanStack Query provider. In demo mode, browser-dependent hydration starts with a stable loading state until storage can be read. [Next.js server and client components](https://nextjs.org/docs/app/getting-started/server-and-client-components)

```text
src/
  app/
    layout.tsx
    page.tsx
    snippets/
      page.tsx
      new/page.tsx
      [snippetId]/page.tsx
      [snippetId]/edit/page.tsx    (P1)
  components/ui/                 shadcn primitives
  features/snippets/
    library/                     SnippetList
    composer/                    SnippetComposer, FileList, CodeEditor
    reader/                      SnippetReader, FileList integration, CodeViewer
    relationships/               React Flow and equivalent list (P1)
    explanation/                 explanation panel (P1)
    queries.ts                   query/mutation setup
  data/snippets/
    domain.ts                    frontend types and errors
    adapter.ts                   typed interface and selection entry
    demo/                        fixture data, browser storage, fault scenarios
    live/                        transport and mapping after spec
    generated/                   contract types after spec
```

Share file navigation and other primitives once two screens need them. Keep network, fixture, and storage dependencies inside the data layer. The editor may use a pure validation function shared with the demo adapter.

## Domain boundary

The following TypeScript describes values the UI needs. It defines neither HTTP operations nor wire models. Names and values below are internal.

```ts
export type SnippetSummary = {
  id: string
  title: string
  fileCount: number
}

export type SnippetFile = {
  path: string
  language?: string
  text: string
}

export type Snippet = SnippetSummary & { files: readonly SnippetFile[] }
export type SnippetDraft = { title: string; files: readonly SnippetFile[] }

export type CreateReceipt = {
  id: string
  snippet?: Snippet
}

type FailureCode =
  | 'missing' | 'unauthenticated' | 'forbidden' | 'invalid'
  | 'conflict' | 'unavailable' | 'unknown' | 'save-unconfirmed'

export type Failure = {
  code: FailureCode
  fieldIssues?: ReadonlyArray<{
    field: 'title' | 'files'
    path?: string
    message: string
  }>
}

export interface SnippetAdapter {
  list(input?: { signal?: AbortSignal }): Promise<readonly SnippetSummary[]>
  read(id: string, input?: { signal?: AbortSignal }): Promise<Snippet>
  create(draft: SnippetDraft): Promise<CreateReceipt>
}
```

Adapter implementations reject with a typed error carrying `Failure`. An aborted read propagates as cancellation. Convert other unexpected failures to the safe unknown state. Known field messages must be safe for display. `save-unconfirmed` is for a write that may have reached live storage without an acknowledgment. Add P1 interfaces as each capability lands. Keep update, per-record access and share details, relationships, and explanation optional at the UI boundary. A data source may return partial or unsupported optional capabilities without misrepresenting the record as absent.

The frontend’s draft file identity is a stable local key, separate from its editable path. Create independent Monaco models under these keys. Rename updates metadata and language without replacing the active model. Dispose each model after file removal or composer unmount. Keep the plain textarea and Monaco synchronized with the same authoritative draft buffer. Avoid remounting the active editor on routine renders. If an editor normalizes line endings, preserve the text from its model consistently across modes, and compare saved text against that buffer in tests.

## State and data flow

```text
UI route → feature hooks → TanStack Query → typed SnippetAdapter
                                            ├─ demo → fixture + browser store
                                            └─ live → mapper + generated types → approved backend
```

- React owns transient state, such as confirmation dialogs and the editable draft. The URL owns the reader’s selected path. Use replace for file selection while preserving unrelated query parameters, so browser back returns to the previous screen. Never put source text or secrets in the URL.
- Query keys scope cache entries by mode and, when applicable, a stable session boundary. Add snippet ID for detail. Clear protected cache on sign-out or account change. Pass Query’s signal to reads. Retry only transient read failures with a small cap. Invalidate the current library once a create is acknowledged. Seed the detail cache only when the receipt carries a complete mapped snippet, then navigate using the confirmed ID. Otherwise let the detail route read it. Handle a post-save read failure as “Saved. Couldn’t load the snippet.” with a retry and library link.
- Use a pessimistic save. Disable mutation retries by default. If an endpoint can acknowledge a save but the response cannot map to an ID or full detail, handle the outcome explicitly. A render, cache insertion, or delayed fixture alone cannot acknowledge a write.
- Lazy-load Monaco on the composer and React Flow in its optional panel. Load Shiki for the reader, reuse a limited-language highlighter, and render plain escaped text for unsupported languages, large content chosen by a documented frontend performance threshold, or a highlighter failure. Use Shiki’s tokens rendered as text nodes or an equivalently safe rendering path. Treat source and returned explanation as untrusted text.

## Demo adapter

Use an explicit build or deployment setting such as `NEXT_PUBLIC_SNIPPETS_MODE=demo`. Show “Demo mode · Data stays in this browser” across demo routes. Seed a deterministic small dataset with a three-file example and a second contrasting example. Use a versioned storage key, clone initial fixtures, validate stored records, and scope writes to the current origin and profile. Write a proposed snapshot successfully before making it visible to readers and confirming a mutation. Keep the demo single-tab for editing during the hackathon. Keep sample data labeled, and provide short, local instructions for resetting the developer fixture store.

Supply test overrides for empty library, slow reads, missing detail, read failure, and rejected writes. Tests inject deterministic scenario settings through the demo harness. Default demo mode should not inject random failures. Storage inaccessible or corrupt should lead to an actionable error or an explicit reset, with no silent overwrite. Public share controls are disabled in this mode.

## Replace demo with live

1. The project lead provides the exact canonical `openapi.yaml` revision and integration configuration. Record its path, revision or checksum, auth mechanism, environment, and supported capabilities in [MEMORY.md](MEMORY.md).
2. Generate TypeScript types from the approved artifact. Identify which operations cover list, read, and create, and document capability and access decisions, including any intentional missing/forbidden equivalence. Flag gaps to the project lead before wiring. [OpenAPI TypeScript](https://openapi-ts.dev/introduction)
3. Implement the live adapter and mapper. Keep generated types behind this boundary. Map a successful create to `CreateReceipt` using the confirmed ID, with a full snippet only if available. If the contract offers no way to identify the saved record, flag the gap against F05 before enabling the live create path. If the save outcome cannot be confirmed, expose the unconfirmed state.
4. Configure auth and browser or server transport from the approved deployment design. Isolate server-only credentials and use approved cookies or auth flows. Any proxy, origin configuration, preflight, or stream behavior is agreed with the project lead and tested in the actual deployment.
5. Select `live` explicitly. In a live build, missing config or unsupported wiring surfaces as setup or feature unavailability. Validate mode at app startup and keep demo storage and sample fallback inaccessible in live mode. Separate Query caches and prefer separate deployment origins.
6. Run [CHECKLIST.md](CHECKLIST.md)’s live gate. A backend-confirmed save, direct read after reload, and expected negative access and error behavior are the handoff evidence.
