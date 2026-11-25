# Backend architecture

Use a single FastAPI application and PostgreSQL database. Follow existing repository conventions if a project already exists. A small layout can keep request schemas and routes together initially, with separate auth, database, migrations, and tests.

Normal request flow: validate input and identity → enforce access → read or write through PostgreSQL → serialize the result described by the contract. A write succeeds once its database transaction commits.

## Auth and permissions

Use the team’s proposed Supabase Auth setup if confirmed. Verify the signed-in identity server-side through the approved library or provider flow. Derive ownership from that identity. Use named permissions in the API for guest, authenticated user, and owner. A supplied invalid session returns an auth error according to the contract. A guest can discover public snippets and open public or unlisted snippets by direct link. [Supabase user lookup](https://supabase.com/docs/reference/javascript/auth-getuser)

| Operation | Public | Unlisted | Private |
| --- | --- | --- | --- |
| Guest or non-owner direct read and raw | Yes | With the link | Denied |
| Owner direct read and raw | Yes | Yes | Yes |
| Anonymous external embed | Yes | With the link | Denied |
| Public listing, tag search, full-text search | Included | Excluded | Excluded |
| Authenticated fork | If readable | If readable | Owner only |
| Edit and change visibility | Owner only | Owner only | Owner only |
| Public fork graph and live events | Include only visible public nodes and edges | Excluded | Excluded |

Use one server-side policy across detail, files, embeds, search, fork, stars, and graph. Check permission when reading a raw file through its parent snippet. Hide private resources behind the same response as missing resources when the approved contract calls for that. Returned graph nodes and parent links must not reveal hidden records. Use response caching that respects visibility and permission changes. For the prototype, `Cache-Control: no-store` is a simple option for protected data and embed responses that may become private.

## Contract handoff

The backend owner creates and approves one canonical `openapi.yaml` in source control. Choose the actual paths, fields, status codes, authorization scheme, and error schema there. This kit specifies capabilities and behavior. Its operation labels do not define HTTP paths.

1. Publish the first revision covering **create, list, and read**, auth, visibility, tags, input limits, and the error envelope. Include a create acknowledgment that lets the UI reopen the confirmed saved ID.
2. Agree whether list returns separate owned-library and public-discovery modes or separate operations. Document defaults, limits, sorting, and visibility behavior.
3. Add edit, fork, embed data, raw file, tag and full-text discovery, stars, graph, and any live update transport as each checkpoint starts. Decide whether the iframe URL is a frontend route or a backend-rendered view and document how the UI obtains it.
4. Keep FastAPI’s emitted OpenAPI aligned with the approved spec. Test response and error shapes against that revision. If a field or operation changes, update the canonical artifact and tell Rishi which revision to regenerate against.
5. For each phase, Rishi prepares the UI and adapter against the approved revision. Once both sides are ready, the project lead enables that phase’s live operations and runs the shared checks in [CHECKLIST.md](CHECKLIST.md). Recheck earlier flows whenever a new phase changes a shared behavior. Record the contract revision, the frontend/backend build references, and the result before moving on.

## Error, output, and deployment behavior

- Return one structured error shape with a stable code, safe message, and field details for validation when applicable. Define how authentication failure, denied/missing resources, invalid input, and service failure map into it. FastAPI’s validation/error handlers should agree with the OpenAPI responses. [FastAPI error handling](https://fastapi.tiangolo.com/tutorial/handling-errors/)
- Serve raw files as exact text with the two headers in [PRD.md](PRD.md). Render embed content as escaped code. Enable framing for the intended embed route and test the actual deployment on a separate origin. Keep auth/editor surfaces outside the embeddable view.
- For the required real-time feature, agree on one public graph update. Use the existing project’s real-time service or a small SSE stream with reconnect behavior. Publish a scoped invalidation or ID only after the transaction commits, and refetch the visibility-filtered graph. Expose updates only when they are safe for the subscribed audience.
- Keep credentials in environment variables and commit only an example config. Allow the agreed frontend origin, keep database credentials server-side, and avoid logging access tokens or source contents.
