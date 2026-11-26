import { AlertCircle, ArrowLeft, Lock, LogIn, RefreshCw, UserCheck } from 'lucide-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { Button } from '@/src/components/ui/button';
import { isSnippetAdapterError } from '@/src/data/snippets/domain';
import { useSnippetsContext } from '@/src/features/snippets/context';
import { useSnippetDetail } from '@/src/features/snippets/queries';
import { SnippetWorkbench } from '@/src/features/snippets/workbench/SnippetWorkbench';

export function SnippetDetailPage({
  initialView,
}: {
  initialView?: 'edit' | 'highlighted';
}) {
  const { snippetId } = useParams<{ snippetId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { viewer } = useSnippetsContext();
  const detailQuery = useSnippetDetail(snippetId);

  if (detailQuery.isLoading) {
    return (
      <div className="mx-auto w-full max-w-[1080px] px-4 py-8 sm:px-8 space-y-5" aria-busy="true">
        <div className="h-8 w-1/2 rounded-[6px] bg-[var(--skeleton)] animate-pulse" />
        <div className="h-28 rounded-[10px] border border-[var(--hairline)] bg-[var(--sidebar)] animate-pulse" />
        <div className="h-[420px] rounded-[10px] border border-[var(--hairline)] bg-[var(--code-surface)] animate-pulse" />
      </div>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    const failure = isSnippetAdapterError(detailQuery.error) ? detailQuery.error.failure : null;
    const isDenied = failure?.code === 'unauthenticated' || failure?.code === 'forbidden';

    return (
      <div className="mx-auto w-full max-w-[720px] px-4 py-12 sm:px-8">
        <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--paper)] p-6">
          <div className="flex items-start gap-3">
            {isDenied ? (
              <Lock
                className="mt-0.5 h-5 w-5 shrink-0 text-[var(--action-bright)]"
                aria-hidden="true"
              />
            ) : (
              <AlertCircle
                className="mt-0.5 h-5 w-5 shrink-0 text-[var(--error-ink)]"
                aria-hidden="true"
              />
            )}
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-[var(--ink)]">
                {isDenied ? 'Private snippet — access restricted' : 'Snippet unavailable'}
              </h1>
              <p className="mt-1 text-sm text-[var(--secondary-text)] leading-relaxed">
                {failure?.message ?? 'This snippet could not be found or is no longer available.'}
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                {viewer.role === 'guest' && (
                  <Button asChild variant="primary" size="sm">
                    <Link to={'/login?next=' + encodeURIComponent(window.location.pathname + window.location.search)}>
                      <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
                      Sign in
                    </Link>
                  </Button>
                )}


                {!isDenied && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => detailQuery.refetch()}
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    Retry
                  </Button>
                )}

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const next = new URLSearchParams(searchParams);
                    next.set('scope', 'discover');
                    navigate(`/?${next.toString()}`);
                  }}
                >
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  Browse Discover
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <SnippetWorkbench
      mode="detail"
      snippet={detailQuery.data}
      initialView={initialView}
    />
  );
}
