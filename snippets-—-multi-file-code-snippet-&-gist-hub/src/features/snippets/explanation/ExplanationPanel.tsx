import { AlertCircle, RefreshCw, Sparkles, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import * as React from 'react';
import { Button } from '@/src/components/ui/button';
import {
  isSnippetAdapterError,
  type SnippetExplanation,
} from '@/src/data/snippets/domain';
import { useSnippetsContext } from '@/src/features/snippets/context';
import { EASE_OUT_EXPO, INSTANT_TRANSITION, TRANSITION_BASE } from '@/src/lib/motion';

interface ExplanationPanelProps {
  snippetId: string;
  open: boolean;
  onClose: () => void;
  onSelectFile?: (path: string) => void;
}

export function ExplanationPanel({
  snippetId,
  open,
  onClose,
  onSelectFile,
}: ExplanationPanelProps) {
  const { adapter, viewer, announce } = useSnippetsContext();
  const prefersReducedMotion = useReducedMotion();
  const [status, setStatus] = React.useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [data, setData] = React.useState<SnippetExplanation | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  const runExplanation = React.useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus('loading');
    setErrorMessage(null);
    announce('Generating snippet explanation.');

    adapter
      .explain(snippetId, viewer, { signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        setData(result);
        setStatus('success');
        announce('Snippet explanation ready.');
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
          return;
        }
        const message = isSnippetAdapterError(err)
          ? err.failure.message ?? 'Could not explain this snippet.'
          : 'Could not generate an explanation right now.';
        setErrorMessage(message);
        setStatus('error');
        announce(`Explanation failed: ${message}`);
      });
  }, [adapter, announce, snippetId, viewer]);

  React.useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      return;
    }
    if (!data || data.snippetId !== snippetId) {
      setData(null);
      runExplanation();
    }
    return () => {
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, snippetId]);

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="explanation-disclosure"
          initial={prefersReducedMotion ? false : { opacity: 0, height: 0, y: -6 }}
          animate={{ opacity: 1, height: 'auto', y: 0 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0, y: -4 }}
          transition={prefersReducedMotion ? INSTANT_TRANSITION : TRANSITION_BASE}
          className="overflow-hidden"
        >
          <aside
            aria-label="Snippet AI explanation"
            className="rounded-[10px] border border-[var(--ai-border)] bg-[var(--ai-surface)] p-4 sm:p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--ai-border)]/70 pb-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <motion.span
                    animate={
                      status === 'loading' && !prefersReducedMotion
                        ? { rotate: [0, 12, -12, 0], scale: [1, 1.08, 1] }
                        : { rotate: 0, scale: 1 }
                    }
                    transition={
                      status === 'loading'
                        ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut' }
                        : TRANSITION_BASE
                    }
                    className="inline-flex shrink-0"
                  >
                    <Sparkles className="h-4 w-4 text-[var(--action-bright)]" aria-hidden="true" />
                  </motion.span>
                  <h2 className="text-sm font-semibold text-[var(--ink)]">Snipbase AI</h2>
                  <span aria-hidden="true" className="text-xs text-[var(--muted-text)]">
                    ·
                  </span>
                  <span className="text-xs text-[var(--secondary-text)]">
                    {data?.label ?? (adapter.mode === 'demo' ? 'Sample explanation' : 'Explanation')}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[var(--muted-text)]">
                  {adapter.mode === 'demo'
                    ? 'Deterministic file-aware breakdown in demo mode · Ready for live server-side Gemini endpoint'
                    : 'Generated from the files in this snippet'}
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                {status === 'loading' ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => {
                      abortRef.current?.abort();
                      setStatus('idle');
                      onClose();
                    }}
                  >
                    Cancel
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={runExplanation}
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    Regenerate
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Close explanation"
                  onClick={onClose}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>

            {status === 'loading' && (
              <div role="status" className="mt-3.5 space-y-2.5">
                <p className="text-xs text-[var(--secondary-text)]">Reading snippet files…</p>
                <div aria-hidden="true" className="space-y-2">
                  <div className="h-3.5 w-5/6 rounded ai-shimmer" />
                  <div className="h-3.5 w-2/3 rounded ai-shimmer" />
                </div>
              </div>
            )}

            {status === 'error' && (
              <div
                role="alert"
                className="mt-3.5 rounded-[8px] border border-[var(--error-border)] bg-[var(--error-surface)] p-3.5 text-xs text-[var(--error-ink)]"
              >
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <div>
                    <p className="font-medium">Couldn&apos;t explain this snippet</p>
                    <p className="mt-0.5">{errorMessage}</p>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="mt-2.5 h-8 text-xs"
                      onClick={runExplanation}
                    >
                      Try again
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {status === 'success' && data && (
              <motion.div
                initial={prefersReducedMotion ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={prefersReducedMotion ? INSTANT_TRANSITION : TRANSITION_BASE}
                className="mt-3.5 space-y-4 text-sm leading-relaxed text-[var(--ink)]"
              >
                <p className="max-w-[74ch] text-[13.5px] text-[var(--ink)]">{data.summary}</p>

                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {data.fileBreakdown.map((item, idx) => (
                    <motion.div
                      key={item.path}
                      initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={
                        prefersReducedMotion
                          ? INSTANT_TRANSITION
                          : { duration: 0.18, delay: idx * 0.035, ease: EASE_OUT_EXPO }
                      }
                      className="rounded-[8px] border border-[var(--ai-border)]/80 bg-[var(--paper)] p-3 transition-colors hover:border-[var(--action)]/60"
                    >
                      <div className="flex items-center justify-between gap-2">
                        {onSelectFile ? (
                          <button
                            type="button"
                            onClick={() => onSelectFile(item.path)}
                            className="truncate font-mono text-xs font-semibold text-[var(--action-bright)] hover:underline cursor-pointer"
                          >
                            {item.path}
                          </button>
                        ) : (
                          <span className="truncate font-mono text-xs font-semibold text-[var(--ink)]">
                            {item.path}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] text-[var(--muted-text)]">{item.role}</p>
                      <p className="mt-1.5 text-xs text-[var(--secondary-text)] leading-snug">
                        {item.highlights[0]}
                      </p>
                    </motion.div>
                  ))}
                </div>

                <ul className="space-y-1 border-t border-[var(--ai-border)]/60 pt-3 text-xs text-[var(--secondary-text)]">
                  {data.considerations.map((note, idx) => (
                    <li key={idx} className="flex items-baseline gap-2">
                      <span aria-hidden="true" className="text-[var(--muted-text)]">
                        –
                      </span>
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}
          </aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
