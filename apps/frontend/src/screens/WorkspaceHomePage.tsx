import { Code2, Compass, Plus } from 'lucide-react';
import { Link, Navigate, useSearchParams } from 'react-router';
import { Button } from '@/src/components/ui/button';
import type { LibraryScope } from '@/src/data/snippets/domain';
import { useSnippetsContext } from '@/src/features/snippets/context';
import { useSnippetsList } from '@/src/features/snippets/queries';

const VALID_SCOPES: ReadonlyArray<LibraryScope> = ['mine', 'shared', 'discover', 'starred'];

function resolveScope(raw: string | null, isGuest: boolean): LibraryScope {
  if (raw && (VALID_SCOPES as readonly string[]).includes(raw)) {
    return raw as LibraryScope;
  }
  return isGuest ? 'discover' : 'mine';
}

export function WorkspaceHomePage() {
  const { viewer } = useSnippetsContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const isGuest = viewer.role === 'guest';
  const scope = resolveScope(searchParams.get('scope'), isGuest);
  const tag = searchParams.get('tag') ?? '';
  const query = searchParams.get('q') ?? '';

  const listQuery = useSnippetsList({ scope, tag, query });
  const items = listQuery.data?.items ?? [];

  if (listQuery.isError) {
    return <div role="alert" className="p-8 space-y-4">
      <p>{listQuery.error instanceof Error ? listQuery.error.message : 'Could not load snippets.'}</p>
      <Button onClick={() => listQuery.refetch()}>Retry</Button>
    </div>;
  }

  if (listQuery.isLoading) {
    return (
      <div className="mx-auto w-full max-w-[1080px] px-4 py-8 sm:px-8 space-y-5" aria-busy="true">
        <div className="h-8 w-1/2 rounded-[6px] bg-[var(--skeleton)] animate-pulse" />
        <div className="h-28 rounded-[10px] border border-[var(--hairline)] bg-[var(--sidebar)] animate-pulse" />
        <div className="h-[420px] rounded-[10px] border border-[var(--hairline)] bg-[var(--code-surface)] animate-pulse" />
      </div>
    );
  }

  // Redirect cleanly to the active snippet URL so sidebar selection and breadcrumb stay in sync
  const defaultSnippetId =
    items[0]?.id;

  if (defaultSnippetId) {
    const next = new URLSearchParams(searchParams);
    if (!next.get('scope')) {
      next.set('scope', scope);
    }
    return (
      <Navigate
        to={`/snippets/${encodeURIComponent(defaultSnippetId)}?${next.toString()}`}
        replace
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[680px] flex-col items-start px-4 py-14 sm:px-8">
      <div className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-[var(--hairline)] bg-[var(--paper)] text-[var(--action-bright)]">
        <Code2 className="h-5 w-5" aria-hidden="true" />
      </div>
      <h1 className="mt-4 text-xl font-bold tracking-tight text-[var(--ink)]">
        {tag || query ? 'No snippets match this filter' : 'Your Snipbase workbench is ready'}
      </h1>
      <p className="mt-1.5 text-sm leading-relaxed text-[var(--secondary-text)]">
        {tag || query
          ? 'Clear the current tag or search query in the sidebar, or create a new multi-file snippet.'
          : 'Create a multi-file snippet with auto-detected syntax highlighting, visibility controls, and live embeds — or browse Discover to fork an existing template.'}
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-2.5">
        <Button asChild variant="primary" size="md">
          <Link to="/snippets/new">
            <Plus className="h-4 w-4" aria-hidden="true" />
            New snippet
          </Link>
        </Button>

        {scope !== 'discover' && (
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              next.set('scope', 'discover');
              next.delete('tag');
              next.delete('q');
              setSearchParams(next, { replace: true });
            }}
          >
            <Compass className="h-4 w-4" aria-hidden="true" />
            Browse Discover
          </Button>
        )}
      </div>
    </div>
  );
}
