# Frontend product requirements

## Routes

These are Next.js UI paths. `[snippetId]` represents an opaque snippet identifier from the active adapter. Use URL-safe encoding and avoid deriving semantics from the identifier.

| UI path | Priority | Screen and route behavior |
| --- | --- | --- |
| `/` | P0 | Landing. Lead with a compact, clearly labeled example and two actions, “Create snippet” and “Browse snippets”. Example opens an existing sample only when available in the active mode. |
| `/snippets` | P0 | Library. Show snippets available to the current viewer, with title and file count. Link each row to its detail. Include create action, loading, empty, and failure states. |
| `/snippets/new` | P0 | Composer. Starts with one editable file. Save creates the snippet and navigates to the confirmed detail only after the adapter returns success. |
| `/snippets/[snippetId]` | P0 | Reader. File list, selected file, code, and “Copy code”. Use `?file=<encoded-path>` as an optional file selection within this route. Missing or invalid selections open the first available file. |
| `/snippets/[snippetId]/edit` | P1 | Edit a saved snippet using the composer, subject to contract-confirmed permissions. A direct visit honors signed-out, forbidden, missing, and unsupported states as mapped by the integration. |

Graph and AI explanation are optional panels within the reader. Sharing, if enabled, uses the contract-approved share URL or the detail URL when the backend confirms that the anonymous reader can use it. A sign-in page or callback is added only if the agreed authentication flow requires one. A frontend route shell alone establishes no access rights.

## P0 acceptance criteria

| ID | Requirement | Acceptance check |
| --- | --- | --- |
| F01 | Landing and navigation | Direct-load `/`. Both actions lead to their intended routes. Browser back works. Demo data is visibly labeled on every demo route. |
| F02 | Library and read states | With records present, rows show accurate titles and counts. With zero records, show “No snippets yet” and a create action. A delayed response has a readable loading state. A read failure has a retry or exit appropriate to the error. |
| F03 | Multi-file authoring | Create a snippet with `src/main.ts`, `src/format.ts`, and `README.md`. Switching files preserves text and undo while the respective model lives. Add, rename, and remove files. Confirm removal of a file with content and keep at least one file. Preserve editor content on validation and save failures. |
| F04 | Validation | Require a trimmed title and at least one file with a nonblank, unique normalized relative path. Reject empty segments, `.`, `..`, leading slash, control characters, and drive-prefixed or absolute paths. Normalize backslashes to slashes and trim outer whitespace before uniqueness checks. Preserve code byte-for-byte as represented in the editor buffer. Empty file content is allowed. Case sensitivity and limits follow the canonical contract when available. Demo uses exact-case comparisons after normalization. Focus the first invalid field and associate errors with fields. |
| F05 | Confirmed save | Disable multiple submissions and edits while saving. On success, use the returned ID and open its detail. On failure, keep all input and show an error in the form. For an ambiguous live result, prompt the user to check the library before retrying unless replay safety is confirmed. Reload the confirmed detail and verify all files and contents match. |
| F06 | Reading and clipboard | Open a saved detail directly and switch files using a keyboard. Reload a valid selected-file URL. Show unknown languages or highlighter failures as escaped plain text. Report “Copied” only after clipboard success. On failure, keep the code selectable and offer a manual copy instruction. |
| F07 | Route and access failures | An absent fixture leads to a missing-snippet state with “Back to snippets”. In live mode, render signed-out, forbidden, unavailable, and missing as specified by the contract. Respect any intentional concealment of protected resources. No fixture fallback in live mode. |
| F08 | Responsive and accessible | At 320, 390, 768, and 1440 CSS px, core actions remain available with keyboard and touch. Long filenames and code may scroll in their own regions. Test visible focus, dialog return focus, reduced motion, 200% zoom, and keyboard-only completion. Include the plain textarea editing alternative on phones or when Monaco fails. |
| F09 | Unsaved work | Dirty navigation through app-controlled exit links shows a discard confirmation. Cancel returns focus and retains input. Install a browser unload warning only while dirty where supported. Opening a different snippet starts a fresh draft. Successful navigation after saving skips the warning. Draft recovery after closing/reloading is outside P0. |
| F10 | Demo persistence and failure | A successful demo save survives reload in the same browser profile and origin. A fresh profile starts from the seed dataset. A missing user-created demo ID shows the missing state in a fresh profile. Blocking storage or forcing rejection cannot produce a saved status or redirect. |

## P1 and P2 acceptance criteria

Complete P1 in this order, subject to the canonical contract and remaining time.

| ID | Feature | Acceptance check |
| --- | --- | --- |
| F11 | P1 edit | An authorized viewer can rename or change files, save, then reload the updated snippet. Cancel leaves the original unchanged. A failed or conflicting update retains input and follows the contract’s recovery rules. |
| F12 | P1 public sharing | Show “Copy share link” only for a confirmed shareable resource and usable share URL. Verify the exact copied URL from a fresh signed-out browser. Private or unknown access has no public-share action. Disable public sharing in demo mode. |
| F13 | P1 file relationships | Show each file as a node. Display only relationships supplied by the adapter, including clearly labeled fixture data in demo, and provide a list with equivalent navigation. Selecting a node opens its file. If no relationships are available, show an explicit empty state. Omit graph editing and dependency inference. |
| F14 | P1 AI explanation | Trigger “Explain snippet” explicitly. Show pending, result, empty, and actionable error states. Preserve the reader and ignore stale responses if the snippet changes. Use a cancellable request when transport supports it. A canned example is labeled “Sample explanation”. Live controls require capability and approved auth and data handling. Start with one complete response. Streaming depends on a defined transport and time. |
| F15 | P2 deferred features | Pull in one item at a time with its own acceptance criteria. Examples include fork, server discovery and filtering, graph editing, theme switching, and multi-turn AI. Keep their controls off shipped routes unless the behavior is implemented. |

## Demo script

1. Open the library in demo mode. Open the seeded three-file snippet, switch files, and copy one file.
2. Create a new snippet with three paths. Enter different content, switch away and back, then save.
3. Read the saved record, reload the selected-file URL, then find it again in the library.
4. Run the deterministic save-failure scenario separately. Show that edited text stays available and that no saved state appears.
5. Show optional features only if their own acceptance criteria pass. Say which mode each feature uses.
