# Backend build checklist

Use [PRD.md](PRD.md) for acceptance IDs and record run evidence in [MEMORY.md](MEMORY.md). At each phase boundary, Rishi verifies the frontend, the project lead verifies the backend, then the project lead integrates the two and signs off on the live flow before either side starts the next phase.

## Phase 1 · Save and reopen

- [ ] Inspect the actual backend repository and choose the Python, dependency, and migration workflow.
- [ ] Confirm the auth environment and create two demo/test accounts.
- [ ] Author the canonical `openapi.yaml` for create, list, and read. Include auth, access, tags, limits, validation and errors, and create acknowledgment. Send the revision to Rishi.
- [ ] Start the API and PostgreSQL. Confirm migrations run against an empty test database and secrets stay local.
- [ ] Implement request schemas, auth verification, and the shared ownership and visibility policy.
- [ ] Write the snippet and file rows in one transaction. Verify invalid titles, duplicate paths, and failed writes create no partial data.
- [ ] Implement authorized detail and scoped list. Verify a real three-file create, list, and read after server restart. Check guest, owner, and another user for every visibility level. **B01–B03.**
- [ ] **Frontend ready:** Rishi verifies the sign-in flow, library, composer, reader, file highlighting, visibility picker, and validation/rejection states.
- [ ] **Integrate:** Sign in through the UI, create the three-file snippet, reopen it from the library, and refresh. Verify all files and content as well as a rejected save. Record frontend, backend, and contract revisions.

## Phase 2 · Complete the judging path

- [ ] Publish the matching contract revision for embed/raw access, fork, edit, and tag discovery.
- [ ] Implement and wire the iframe view and per-file raw output. Verify rendered code, fresh-browser public/unlisted access, and private denial. Check both raw headers. **B04.**
- [ ] Implement fork with new owner, ID, copied files, and immutable parent. Implement owner edit. Verify independent edits and explicit publication from the second account. **B05.**
- [ ] Implement normalized tag discovery and verify public-only results in a fresh browser. **B06.**
- [ ] **Frontend ready:** Rishi verifies the copy-embed action and view, raw-file link, fork and edit controls, and tag discovery.
- [ ] **Integrate:** Copy the iframe link from the app and load it on a separate page. Sign in as B, fork and edit the original, publish the fork, and find it by tag. Verify the original stays intact, private data stays protected, and Phase 1 still passes.

## Phase 3 · Cover the rest of the brief

- [ ] Publish the matching contract revision for search, stars, fork lineage, and the live update.
- [ ] Add title and file-content text search, plus persisted star/unstar. Check authorization and repeat requests. **B07.**
- [ ] Expose a small, visibility-filtered fork graph. Verify a new public fork appears live and hidden forks stay out of results and events. **B08.**
- [ ] Prepare reproducible setup and deployment. Test actual signed-in and anonymous sessions. **B09.**
- [ ] **Frontend ready:** Rishi verifies the search results, star toggle, and fork graph with refresh behavior for incoming updates.
- [ ] **Integrate and sign off:** Run search, stars, and live fork updates in the actual submission environment. Repeat Phases 1 and 2, including visibility and raw headers. Record passing acceptance IDs and where the judges can run the app.

Optional AI and deeper graph features come after submission checks pass.
