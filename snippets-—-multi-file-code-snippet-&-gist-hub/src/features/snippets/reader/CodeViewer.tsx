import { Check, Copy, ExternalLink } from 'lucide-react';
import * as React from 'react';
import { Link } from 'react-router';
import { Button } from '@/src/components/ui/button';
import { highlightCodeSafely, type HighlightResult } from '@/src/lib/shiki';
import { cn, copyTextToClipboard } from '@/src/lib/utils';

interface CodeViewerProps {
  path: string;
  language?: string;
  code: string;
  rawUrl?: string;
  compact?: boolean;
  onCopySuccess?: (path: string) => void;
  className?: string;
}

export function CodeViewer({
  path,
  language,
  code,
  rawUrl,
  compact = false,
  onCopySuccess,
  className,
}: CodeViewerProps) {
  const [highlight, setHighlight] = React.useState<HighlightResult>(() => ({
    highlighted: false,
    languageLabel: language && language !== 'text' ? language : 'Plain text',
    lines: code.split(/\r?\n/).map((line) => [{ content: line }]),
  }));
  const [copyStatus, setCopyStatus] = React.useState<'idle' | 'copied' | 'failed'>('idle');
  const codeBlockRef = React.useRef<HTMLPreElement>(null);

  React.useEffect(() => {
    let cancelled = false;
    setCopyStatus('idle');
    // Render immediate escaped plain text so there is zero latency while Shiki tokenizes
    setHighlight({
      highlighted: false,
      languageLabel: language && language !== 'text' ? language : 'Plain text',
      lines: code.split(/\r?\n/).map((line) => [{ content: line }]),
    });

    highlightCodeSafely(code, language).then((result) => {
      if (!cancelled) {
        setHighlight(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [code, language, path]);

  const handleCopy = async () => {
    const ok = await copyTextToClipboard(code);
    if (ok) {
      setCopyStatus('copied');
      onCopySuccess?.(path);
      window.setTimeout(() => {
        setCopyStatus((prev) => (prev === 'copied' ? 'idle' : prev));
      }, 2200);
    } else {
      setCopyStatus('failed');
      // Select text inside the code block for manual keyboard copy
      if (codeBlockRef.current && window.getSelection) {
        const range = document.createRange();
        range.selectNodeContents(codeBlockRef.current);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    }
  };

  const lineCount = highlight.lines.length;

  return (
    <div
      className={cn(
        'code-surface-focus overflow-hidden rounded-[12px] border border-[var(--code-border)] bg-[var(--code-surface)] text-[var(--code-ink)]',
        className,
      )}
    >
      {/* Code header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--code-border)] bg-[var(--code-surface-elevated)] px-4 py-2.5">
        <div className="min-w-0 flex items-center gap-2.5">
          <span
            className="truncate font-mono text-xs sm:text-[13px] font-medium text-[var(--code-ink)]"
            title={path}
          >
            {path}
          </span>
          <span aria-hidden="true" className="text-[var(--code-muted)] text-xs">
            ·
          </span>
          <span className="text-xs text-[var(--code-muted)] whitespace-nowrap">
            {highlight.highlighted ? highlight.languageLabel : 'Plain text'}
          </span>
          <span aria-hidden="true" className="hidden sm:inline text-[var(--code-muted)] text-xs">
            ·
          </span>
          <span className="hidden sm:inline font-mono text-xs text-[var(--code-muted)] tabular-nums whitespace-nowrap">
            {lineCount} {lineCount === 1 ? 'line' : 'lines'}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {rawUrl && (
            <Button asChild variant="code" size="sm" className="h-8 px-2.5 text-xs">
              <Link to={rawUrl}>
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                Raw
              </Link>
            </Button>
          )}
          <Button
            type="button"
            variant="code"
            size="sm"
            onClick={handleCopy}
            className="h-8 px-2.5 text-xs"
          >
            {copyStatus === 'copied' ? (
              <>
                <Check className="h-3.5 w-3.5 text-[#5dd59b]" aria-hidden="true" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                Copy code
              </>
            )}
          </Button>
        </div>
      </div>

      {copyStatus === 'failed' && (
        <div
          role="status"
          className="border-b border-[var(--code-border)] bg-[#3a1f25] px-4 py-2 text-xs text-[#ff8a94]"
        >
          Clipboard access was blocked. The code below is selected—press Ctrl+C (or Cmd+C) to copy
          it manually.
        </div>
      )}

      {/* Horizontally scrollable code well */}
      <div
        className={cn(
          'overflow-x-auto',
          compact ? 'max-h-[340px] overflow-y-auto' : 'max-h-[640px] overflow-y-auto',
        )}
      >
        <div className="flex min-w-full font-mono text-[13px] leading-[1.58]">
          {/* Decorative line numbers excluded from assistive tech and clipboard */}
          <div
            aria-hidden="true"
            className="select-none border-r border-[var(--code-border)]/70 bg-[var(--code-surface)] px-3 py-4 text-right text-xs leading-[1.58] text-[var(--code-muted)]/75 tabular-nums shrink-0"
          >
            {highlight.lines.map((_, idx) => (
              <div key={idx} className="h-[20.54px]">
                {idx + 1}
              </div>
            ))}
          </div>

          {/* Code tokens rendered strictly as React text nodes (zero raw HTML injection) */}
          <pre
            ref={codeBlockRef}
            tabIndex={0}
            aria-label={`Source code for ${path}`}
            className="m-0 flex-1 px-4 py-4 font-mono text-[13px] leading-[1.58] text-[var(--code-ink)] focus:outline-none"
          >
            <code>
              {code.length === 0 ? (
                <span className="italic text-[var(--code-muted)]">(Empty file)</span>
              ) : (
                highlight.lines.map((tokens, lineIdx) => (
                  <React.Fragment key={lineIdx}>
                    {tokens.length === 0 ? (
                      '\n'
                    ) : (
                      <>
                        {tokens.map((token, tokenIdx) => (
                          <span
                            key={tokenIdx}
                            style={token.color ? { color: token.color } : undefined}
                          >
                            {token.content}
                          </span>
                        ))}
                        {lineIdx < highlight.lines.length - 1 ? '\n' : ''}
                      </>
                    )}
                  </React.Fragment>
                ))
              )}
            </code>
          </pre>
        </div>
      </div>
    </div>
  );
}
