import { ArrowLeft, Check, Copy, Lock } from 'lucide-react';
import * as React from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { Button } from '@/src/components/ui/button';
import { isSnippetAdapterError } from '@/src/data/snippets/domain';
import { useSnippetDetail } from '@/src/features/snippets/queries';
import { copyTextToClipboard } from '@/src/lib/utils';

export function RawFilePage() {
  const { snippetId } = useParams<{ snippetId: string }>();
  const [searchParams] = useSearchParams();
  const requestedPath = searchParams.get('file');
  const detailQuery = useSnippetDetail(snippetId);
  const [copied, setCopied] = React.useState(false);

  const snippet = detailQuery.data;
  const file = React.useMemo(() => {
    if (!snippet || snippet.files.length === 0) return null;
    if (requestedPath) {
      const found = snippet.files.find((f) => f.path === requestedPath);
      if (found) return found;
    }
    return snippet.files[0];
  }, [snippet, requestedPath]);

  if (detailQuery.isLoading) {
    return (
      <div className="min-h-screen bg-[var(--paper)] p-6 font-mono text-xs text-[var(--secondary-text)]">
        Loading raw file…
      </div>
    );
  }

  if (detailQuery.isError || !snippet || !file) {
    const failure = isSnippetAdapterError(detailQuery.error) ? detailQuery.error.failure : null;
    const isDenied = failure?.code === 'unauthenticated' || failure?.code === 'forbidden';
    return (
      <div className="min-h-screen bg-[var(--canvas)] p-6 sm:p-10">
        <div className="mx-auto max-w-xl rounded-[12px] border border-[var(--hairline)] bg-[var(--paper)] p-6">
          <div className="flex items-start gap-2.5">
            <Lock className="mt-0.5 h-5 w-5 shrink-0 text-[var(--ink)]" aria-hidden="true" />
            <div>
              <h1 className="text-base font-semibold text-[var(--ink)]">
                {isDenied ? 'Raw file access denied' : 'Raw file not found'}
              </h1>
              <p className="mt-1 text-sm text-[var(--secondary-text)]">
                {failure?.message ?? 'This raw file is unavailable.'}
              </p>
              <div className="mt-4">
                <Button asChild variant="secondary" size="sm">
                  <Link to="/snippets">
                    <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                    Back to snippets
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const byteCount = new TextEncoder().encode(file.text).length;

  const handleCopy = async () => {
    const ok = await copyTextToClipboard(file.text);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)] flex flex-col">
      <div className="border-b border-[var(--hairline)] bg-[var(--canvas)] px-4 py-2.5">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <Link
              to={`/snippets/${encodeURIComponent(snippet.id)}?file=${encodeURIComponent(file.path)}`}
              className="inline-flex items-center gap-1 font-medium text-[var(--action-bright)] hover:underline"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Back to snippet
            </Link>
            <span aria-hidden="true" className="text-[var(--secondary-text)]">
              ·
            </span>
            <span className="font-mono font-semibold text-[var(--ink)]">{file.path}</span>
            <span aria-hidden="true" className="text-[var(--secondary-text)]">
              ·
            </span>
            <span className="font-mono text-[var(--secondary-text)] tabular-nums">
              {byteCount} bytes
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-[11px] text-[var(--secondary-text)]">
              Content-Type: text/plain; charset=utf-8 · X-Content-Type-Options: nosniff
            </span>
            <Button type="button" variant="secondary" size="sm" className="h-8 text-xs" onClick={handleCopy}>
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-[var(--success-ink)]" aria-hidden="true" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  Copy raw
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-[1200px] flex-1 p-4 sm:p-6">
        <pre className="m-0 overflow-x-auto whitespace-pre font-mono text-[13px] leading-[1.6] text-[var(--ink)]">
          {file.text}
        </pre>
      </main>
    </div>
  );
}
