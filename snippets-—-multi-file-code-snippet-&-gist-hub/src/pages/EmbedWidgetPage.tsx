import { AlertCircle, ExternalLink, Lock } from 'lucide-react';
import * as React from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { isSnippetAdapterError } from '@/src/data/snippets/domain';
import { useSnippetDetail } from '@/src/features/snippets/queries';
import { CodeViewer } from '@/src/features/snippets/reader/CodeViewer';
import { cn } from '@/src/lib/utils';

export function EmbedWidgetPage() {
  const { snippetId } = useParams<{ snippetId: string }>();
  const [searchParams] = useSearchParams();
  const forceAnonymous = searchParams.get('viewer') === 'anonymous';

  const detailQuery = useSnippetDetail(snippetId, { asAnonymous: forceAnonymous });
  const snippet = detailQuery.data;
  const [selectedPath, setSelectedPath] = React.useState<string>('');

  React.useEffect(() => {
    if (snippet && snippet.files.length > 0) {
      const requested = searchParams.get('file');
      const match = requested ? snippet.files.find((f) => f.path === requested) : null;
      setSelectedPath(match ? match.path : snippet.files[0].path);
    }
  }, [snippet, searchParams]);

  if (detailQuery.isLoading) {
    return (
      <div className="min-h-screen bg-[var(--paper)] p-4 text-xs text-[var(--secondary-text)]">
        Loading embedded snippet…
      </div>
    );
  }

  if (detailQuery.isError || !snippet) {
    const failure = isSnippetAdapterError(detailQuery.error) ? detailQuery.error.failure : null;
    const isDenied = failure?.code === 'unauthenticated' || failure?.code === 'forbidden';

    return (
      <div className="min-h-screen bg-[var(--paper)] p-5 text-[var(--ink)]">
        <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--canvas)] p-4">
          <div className="flex items-start gap-2.5">
            {isDenied ? (
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ink)]" aria-hidden="true" />
            ) : (
              <AlertCircle
                className="mt-0.5 h-4 w-4 shrink-0 text-[var(--error-ink)]"
                aria-hidden="true"
              />
            )}
            <div>
              <p className="text-sm font-semibold">
                {isDenied ? 'Embed access denied (Private snippet)' : 'Embedded snippet unavailable'}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--secondary-text)]">
                {isDenied
                  ? 'Private snippets cannot be rendered in anonymous embeds. Only Public and Unlisted snippets are embeddable.'
                  : failure?.message ?? 'This snippet could not be found.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const activeFile =
    snippet.files.find((f) => f.path === selectedPath) ?? snippet.files[0];

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)] flex flex-col">
      {/* Compact widget header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--hairline)] px-4 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[var(--ink)]">{snippet.title}</p>
          <p className="text-[11px] text-[var(--secondary-text)]">
            by {snippet.ownerName} · {snippet.visibility} · {snippet.files.length}{' '}
            {snippet.files.length === 1 ? 'file' : 'files'}
          </p>
        </div>

        <Link
          to={`/snippets/${encodeURIComponent(snippet.id)}`}
          target="_top"
          className="inline-flex items-center gap-1 text-xs font-medium text-[var(--action-bright)] hover:underline whitespace-nowrap shrink-0"
        >
          Open in Snipbase
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </Link>
      </div>

      {/* Multi-file tab bar */}
      {snippet.files.length > 1 && (
        <div
          role="tablist"
          aria-label="Embedded snippet files"
          className="flex items-center gap-1 overflow-x-auto border-b border-[var(--hairline)] bg-[var(--canvas)] px-3 py-1.5"
        >
          {snippet.files.map((file) => {
            const active = file.path === activeFile.path;
            return (
              <button
                key={file.path}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelectedPath(file.path)}
                className={cn(
                  'rounded-[6px] px-2.5 py-1 font-mono text-xs transition-colors cursor-pointer whitespace-nowrap',
                  active
                    ? 'bg-[var(--selected-tint)] font-semibold text-[var(--action-bright)]'
                    : 'text-[var(--secondary-text)] hover:text-[var(--ink)]',
                )}
              >
                {file.path}
              </button>
            );
          })}
        </div>
      )}

      {/* Highlighted Code Surface */}
      <div className="flex-1 p-3 bg-[var(--canvas)]/50">
        <CodeViewer
          path={activeFile.path}
          language={activeFile.language}
          code={activeFile.text}
          compact
        />
      </div>
    </div>
  );
}
