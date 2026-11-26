# Frontend design

## Direction

Take the reference’s concise hierarchy, calm pacing, and emphasis on showing the product in use. Make the identity specific to code snippets through a file index, visible paths, and a large reading surface. Use original visuals, names, and copy. [Wispr Flow product reference](https://wisprflow.ai/)

The landing’s main visual is a three-file snippet preview with actual fixture content. Use the same visual language in the reader. Label the preview “Example snippet”. Keep it static on P0 if interactive file selection would duplicate reader logic. Avoid decorative dashboards, fabricated metrics, or fake account controls.

## Tokens and typography

Set semantic CSS variables and bind them to Tailwind and shadcn tokens. Values below are starting points for one theme. Measure final pairs, including any syntax theme and UI states.

| Role | Value | Usage |
| --- | --- | --- |
| Canvas | `#F3F5F8` | Page background |
| Paper | `#FFFFFF` | Shell and file pane |
| Ink | `#18243A` | Main text |
| Secondary text | `#44536B` | Descriptions and metadata |
| Hairline | `#D8DFE9` | Decorative dividers |
| Control border | `#66758C` | Fields or controls that need a visible boundary |
| Action | `#2C4AA3` | Primary action, links, and light-surface focus ring |
| Selected tint | `#E6ECFF` | Current file with an action-colored marker and selected semantics |
| Code surface | `#111C2F` | Reader and editor, with light code and a pale focus ring |
| Error ink | `#A6263B` | Inline text plus short recovery instructions |

Use DM Sans for UI and headings and IBM Plex Mono for code and file paths. Provide system sans and monospace fallbacks. Use a 40–64 px landing headline with a responsive clamp, 28–36 px page titles, 15–16 px body, 14 px labels and controls, and 13–14 px code at about 1.55 line height. Use a 4/8/12/16/24/32/48 px spacing scale. Use 6 px radius for controls, 12 px for code wells, and 16 px for the landing preview. Use a shadow only when it helps show overlay depth. Treat empty, pending, and error regions as layout states so actions do not jump around.

## Layout

Constrain the shell to about 1200 px with 16 px mobile gutters and 32 px desktop gutters. Keep body text around 65 characters wide. Align page and workbench titles to the same grid.

```text
Wide reader or composer
┌──────────────────────────────────────────────────────────┐
│ Snippets       Browse snippets                Demo mode │
│ Title                              Copy code / Save     │
├───────────────────┬──────────────────────────────────────┤
│ Files             │ Current path                         │
│ src/main.ts       │                                      │
│ src/format.ts     │ Code reader or editor                 │
│ README.md         │                                      │
└───────────────────┴──────────────────────────────────────┘

Narrow reader or composer
┌─────────────────────────┐
│ Snippets       Demo mode│
│ Title                   │
│ File selector           │
│ Current path            │
│ Code reader or textarea │
│ Copy code / Save        │
└─────────────────────────┘
```

- **1024 px and wider**: Split the landing into copy and preview. Give the workbench a 220–260 px file rail and a fluid code pane. Stack library rows with consistently positioned counts.
- **640–1023 px**: Stack the landing. Use a narrower rail when space permits. Collapse to a file selector before filenames and actions crowd the code area.
- **Below 640 px**: Use a single column and a labeled native file selector. Composer file actions remain visible for the current file. Default to a native textarea with the same buffer. Keep actions in the document flow so the mobile keyboard cannot cover a fixed toolbar. Keep code scrolling local to its pane.

## Components and states

- **Library row**: One primary text link plus a readable count. Loading skeletons preserve shape and are hidden from assistive tech. A single status announces loading. On refetch retain the last successful list where safe and surface a refresh failure.
- **File control**: Use a labeled list of native buttons with a current indicator or a labeled select. Keep visual and DOM order aligned. Add focuses the new path field. After removal, focus the next or previous surviving file. A long path truncates visually where needed and remains available to touch and keyboard users through an accessible full-path display.
- **Composer controls**: Title and path are labeled inputs. Error text sits near its field. “Save snippet” becomes “Saving…” during the write. Failure gets inline guidance and the editor remains populated. Discard and destructive file confirmation use Radix dialogs with focus management.
- **Reader**: Put the active path and “Copy code” above the code. Use a readable monospace block with optional decorative line numbers excluded from the accessible name and clipboard text. Show “Plain text” when highlighting is unavailable. Use raw file content as the clipboard source.
- **Graph and AI**: Load on explicit panel open. Keep the file list usable while a panel loads. Pair the graph with a relationship list. Provide visible result labels for fixture AI output and concise status changes for pending versus complete.

## Motion and accessibility

Use Motion for short feedback tied to actions. Use about 120–180 ms for selection or disclosure, and up to 220 ms for an overlay. Use opacity and small transforms without delaying focus or moving the editor on file switch. With reduced motion, remove transforms and use instant or near-instant changes. Route transitions are optional and stay outside P0.

Target WCAG 2.2 AA. Check 4.5:1 contrast for normal text and 3:1 for large text and essential non-text cues. Use 44 px targets for primary touch controls where practical. Provide a skip link, landmark labels, one page heading, and a visible focus ring that remains unobscured. Do not use color alone to indicate state. Announce result and failure changes once with an appropriate live region. Give the editor a name and demonstrate how to leave it using the keyboard. Make the plain editor accessible whenever Monaco is active. Confirm 320 px reflow, 200% zoom, keyboard-only completion, and a basic screen-reader pass. [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
