# Snipbase / Forkspace — UI Templates, Design References & Motion Spec

> Handoff document for **OpenCode / Antigravity** (or any frontend agent) to evaluate, select, and implement the best-fit UI templates and interactive enhancements for **Snipbase** (`Forkspace-Aavishkar`, `frontend` branch).

---

## 1. Current Stack & Design Constitution (Do Not Break)

- **Framework**: Vite 8 + React 19 + TypeScript + Tailwind CSS v4 + React Router + TanStack Query
- **Primitives & Code**: Radix UI (`@radix-ui/react-dialog`, `@radix-ui/react-alert-dialog`), `motion/react`, `lucide-react`, local `@monaco-editor/react` (`monaco-editor` with JSON/CSS/HTML/TS workers), and XSS-safe `shiki` tokenized rendering (zero `dangerouslySetInnerHTML`)
- **Typography**: `DM Sans` (UI & headings) + `IBM Plex Mono` (paths, code, metadata, `tabular-nums`)
- **Color Palette (Matte Obsidian & Muted-Iris — Anti-AI-Slop)**:
  - Canvas: `#111114` (`--canvas`)
  - Sidebar Rail: `#16161B` (`--sidebar`)
  - Elevated Paper: `#1B1B22` (`--paper`)
  - Code Well: `#0D0D11` (`--code-surface`)
  - Hairline Borders: `#262630` (`--hairline`)
  - Muted-Iris Accent (~10% budget): `#7C6AF0` (`--action`), `#B6AAFF` (`--action-bright`), `#231F36` (`--selected-tint`)
  - AI Disclosure Surface: `#181625` (`--ai-surface`), border `#322B52` (`--ai-border`)
- **Strict Visual Rules**:
  - No neon purple halos, floating gradient orbs, decorative pulsing dots, thick `border-l-4` accents, or nested cards-in-cards.
  - Keep all motion tight (`120–200ms`, `cubic-bezier(0.22, 1, 0.36, 1)` or high-damping springs) and honor `prefers-reduced-motion`.
  - Never shift or delay focus on the Monaco editor when switching tabs.
  - Preserve the typed `SnippetAdapter` boundary (`src/data/snippets/domain.ts`) so demo and live backend modes stay swappable.

---

## 2. Curated Design Benchmarks & Template Sources

### A. Awwwards & Live Developer-Tool References
| Reference | URL / Search Query | What to Adopt for Snipbase |
| --- | --- | --- |
| **Linear** | `https://linear.app` | Keyboard-first navigation, `1px` matte borders, restrained purple/iris focus & selection states, ultra-clean action bars. |
| **Raycast** | `https://raycast.com` | Floating `⌘K` Command Palette UX, contextual action menus, crisp shortcut hints (`⌘K`, `⌘S`, `Esc`). |
| **Vercel / Supabase** | `https://vercel.com` / `https://supabase.com` | Dark minimal typography, high-contrast syntax-highlighted multi-file code frames, clean documentation/embed surfaces. |
| **Awwwards Collections** | Search Awwwards: `Dark Mode`, `Minimal`, `Code Editors and Online Front-end Tools` | Hero layout choreography, smooth scroll reveals, interactive IDE preview frames (if adding a marketing landing page). |
| **Saaspo (Dark Mode)** | `https://saaspo.com` (filter: Dark Mode SaaS) | High-craft dark developer-tool landing layouts and bento grids without marketing bloat. |

### B. Figma Community UI Kits
Search [Figma Community](https://www.figma.com/community) for these exact kits to align layout spacing and component states:
1. **`Linear Dark Mode UI Kit` / `Linear Design System`** — Matches Snipbase's left sidebar density, keyboard shortcut badges, and matte graphite hierarchy.
2. **`Notion Dark Mode UI Kit`** — Matches Snipbase's inline editable document title, horizontal key-value property rows (`Access`, `Visibility`, `Tags`, `Lineage`), and Notion AI inline callout surface.
3. **`Raycast Dark UI Kit`** — Reference for a centered floating `⌘K` modal with grouped search results (Snippets, Tags, Accounts, Actions).
4. **`shadcn/ui Figma Kit` (Dark Mode)** — 1:1 token alignment with our Radix + Tailwind CSS component layer.

### C. Drop-In React + Tailwind Component Registries (Directly Compatible)
| Library / Registry | URL / Package | Best Use Case in Snipbase |
| --- | --- | --- |
| **Kibo UI** | `https://www.kibo-ui.com` | Purpose-built IDE `CodeBlock`, collapsible `Tree` (nested file explorer), and multi-file `Sandbox` patterns built on Radix/Tailwind. |
| **Motion Primitives** | `https://motion-primitives.com` | Physics-based `motion/react` micro-interactions: sliding tab/segment backgrounds, smooth height disclosures, animated panels, subtle hover/focus transitions. |
| **21st.dev** | `https://21st.dev` | Searchable TSX registry for `shadcn/ui` + Tailwind (`"command menu"`, `"Linear"`, `"code editor"`, `"diff viewer"`). |
| **`cmdk`** | `npm install cmdk` | The exact open-source primitive behind Linear and Raycast `⌘K` command palettes. |
| **`react-resizable-panels`** | `npm install react-resizable-panels` | Accessible VS Code-style draggable split panes (`PanelGroup`, `Panel`, `PanelResizeHandle`). |
| **Cult UI** | `https://www.cult-ui.com` | Dark-mode AI disclosure blocks and animated prompt/summary surfaces for upgrading `ExplanationPanel.tsx`. |

---

## 3. Recommended Implementation Options (Ranked by Impact)

Agents reviewing this file should inspect the current codebase (`src/components/AppShell.tsx`, `src/features/snippets/workbench/SnippetWorkbench.tsx`, `src/features/snippets/explanation/ExplanationPanel.tsx`, `src/pages/EmbedSandboxPage.tsx`) and implement the highest-value option(s):

### Option 1 (Highest UX Impact): Raycast / Linear `⌘K` Command Palette (`cmdk`)
- **Why**: Right now `⌘K` focuses the sidebar text input. Upgrading it to a real floating `cmdk` command modal makes Snipbase feel unmistakably like Linear/Raycast/VS Code.
- **Scope**:
  - Global `⌘K` / `Ctrl+K` floating command dialog (`src/components/CommandPalette.tsx`).
  - Grouped instant actions:
    - **Snippets**: Fuzzy-search across visible snippets (title, tags, file paths) and jump straight to `/snippets/:id`.
    - **Quick Actions**: Create new snippet, Copy current embed link, Toggle Edit/Highlighted view, Toggle Snipbase AI explanation, Open Embed Sandbox.
    - **Switch Account**: Instant switch between Rishi, Ananya, Guest, or `/login`.
    - **Filter by Tag**: Jump directly to `Discover` filtered by `#demo`, `#docker`, `#python`, `#javascript`, etc.
- **Animation**: `150ms` scale (`0.98 -> 1`) + opacity entrance, keyboard arrow navigation with smooth active item highlight.

### Option 2 (Strongest IDE Vibe): Draggable VS Code Split Panes + File Tree (`react-resizable-panels` + Kibo UI Tree)
- **Why**: Elevates the IDE workbench from a flat tab bar into a real developer workspace when snippets have nested paths (`routers/query.py`, `utils/embed.py`, `src/limiter.ts`).
- **Scope**:
  - Make the left workspace rail resizable on desktop using `react-resizable-panels` with a crisp `1px` hover-highlighted drag handle.
  - Add an optional collapsible **Files** tree panel inside the IDE frame (using Kibo UI tree pattern) for multi-file snippets with nested directories, synced with the horizontal tab bar.
  - Optional split view: **Code Editor | Live Highlighted / Fork Diff** side-by-side pane (using Monaco's built-in `DiffEditor` when inspecting a forked snippet against its parent!).

### Option 3 (Best for Demos & Judging): Interactive Fork Diff & Visual Fork Graph
- **Why**: Directly showcases the hackathon's core challenge (**Multi-File Highlighting + Fork Graph**) inside the Notion × IDE aesthetic.
- **Scope**:
  - When viewing a forked snippet (`snippet.forkedFrom`), add a **"Compare with parent"** toggle in the IDE tab bar that renders a side-by-side diff against the immutable parent snapshot.
  - Add a clean interactive **Lineage / Fork Graph** drawer or tab showing parent -> child forks with click-to-open navigation.

### Option 4 (Marketing Entry): Awwwards-Style Dark Minimal Landing Page (`/welcome`)
- **Why**: Useful if the team wants a showcase hero before entering the live workspace.
- **Scope**:
  - Matte obsidian hero with crisp typography (`DM Sans` display clamp), an interactive 3-file live preview card (reusing `three-file-web-demo` fixture), and a restrained 3-cell bento feature strip (Multi-File Highlighting, One-Click Forking, XSS-Safe Embeds & Raw Endpoints).

---

## 4. Verification Checklist for Implementing Agents

After implementing any selected option:
1. Run `npm run lint` (`tsc --noEmit`) and `npm run build` (`vite build`) with zero errors.
2. Verify all 5 Expected Outcome flows still work end-to-end:
   - Create a multi-file public snippet (`index.html`, `app.js`, `styles.css`)
   - Copy embed link & test live iframe + Private denial in `/sandbox`
   - Switch user / Sign out & sign in as a second developer
   - Fork, edit, and publish without mutating the parent snippet
   - Filter by `#tag` and search full-text code across `Mine / Shared / Discover`
3. Verify keyboard-only navigation (`Tab`, `Esc`, `⌘K`, `⌘S`), `prefers-reduced-motion`, and mobile `<640px` reflow.
