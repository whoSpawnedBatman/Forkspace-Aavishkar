import { AlertCircle, Check, Code2, ExternalLink, Lock, Play } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import * as React from 'react';
import { Link, useSearchParams } from 'react-router';
import { apiOrigin } from '@/src/data/snippets/live/liveAdapter';
import { Button } from '@/src/components/ui/button';
import { Input, Label } from '@/src/components/ui/input';
import { useSnippetsList } from '@/src/features/snippets/queries';
import { INSTANT_TRANSITION, SPRING_SEGMENT, TRANSITION_BASE } from '@/src/lib/motion';
import { cn } from '@/src/lib/utils';

type ViewportPreset = 'mobile' | 'docs' | 'wide';

const WIDTH_MAP: Record<ViewportPreset, { label: string; widthClass: string }> = {
  mobile: { label: 'Mobile (360px)', widthClass: 'max-w-[360px]' },
  docs: { label: 'Docs article (680px)', widthClass: 'max-w-[680px]' },
  wide: { label: 'Wide container (960px)', widthClass: 'max-w-[960px]' },
};

function extractEmbedSnippetId(rawInput: string): { id: string | null; error: string | null } {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { id: null, error: 'Paste an embed link, iframe tag, or snippet ID.' };
  }

  // Extract src attribute if user pasted a full <iframe> tag
  let candidate = trimmed;
  const srcMatch = trimmed.match(/src=["']([^"']+)["']/i);
  if (srcMatch) {
    candidate = srcMatch[1];
  }

  // Match /embed/:id path on same origin or relative URL
  const embedPathMatch = candidate.match(/\/embed\/([^/?#"'\s]+)/);
  if (embedPathMatch) {
    // Reject cross-origin URLs for safety
    if (/^https?:\/\//i.test(candidate)) {
      try {
        const parsed = new URL(candidate);
        if (typeof window !== 'undefined' && ![window.location.origin, new URL(apiOrigin || '/', window.location.origin).origin].includes(parsed.origin)) {
          return {
            id: null,
            error: 'Only embed links from this application origin can be loaded in the sandbox.',
          };
        }
      } catch {
        return { id: null, error: 'Enter a valid embed URL or iframe tag.' };
      }
    }
    return { id: decodeURIComponent(embedPathMatch[1]), error: null };
  }

  // Also allow pasting a /snippets/:id URL or bare snippet ID
  const snippetPathMatch = candidate.match(/\/snippets\/([^/?#"'\s]+)/);
  if (snippetPathMatch) {
    return { id: decodeURIComponent(snippetPathMatch[1]), error: null };
  }

  if (/^[a-zA-Z0-9_-]{2,80}$/.test(candidate)) {
    return { id: candidate, error: null };
  }

  return {
    id: null,
    error: 'Could not recognize an embed link or snippet ID. Copy an embed link from any snippet and paste it here.',
  };
}

export function EmbedSandboxPage() {
  const prefersReducedMotion = useReducedMotion();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialId = searchParams.get('snippet') || '';

  const [inputValue, setInputValue] = React.useState(
    () => `${typeof window !== 'undefined' ? window.location.origin : ''}/embed/${encodeURIComponent(initialId)}`,
  );
  const [activeSnippetId, setActiveSnippetId] = React.useState(initialId);
  const [parseError, setParseError] = React.useState<string | null>(null);
  const [viewport, setViewport] = React.useState<ViewportPreset>('docs');
  const [reloadNonce, setReloadNonce] = React.useState(0);

  const listQuery = useSnippetsList({ query: '', tag: '', scope: 'discover' });

  React.useEffect(() => {
    const paramId = searchParams.get('snippet');
    if (paramId && paramId !== activeSnippetId) {
      setActiveSnippetId(paramId);
      setInputValue(`${window.location.origin}/embed/${encodeURIComponent(paramId)}`);
      setParseError(null);
    }
  }, [searchParams, activeSnippetId]);

  const handleLoadEmbed = (e: React.FormEvent) => {
    e.preventDefault();
    const { id, error } = extractEmbedSnippetId(inputValue);
    if (!id || error) {
      setParseError(error);
      return;
    }
    setParseError(null);
    setActiveSnippetId(id);
    setReloadNonce((n) => n + 1);
    setSearchParams({ snippet: id }, { replace: true });
  };

  const handleQuickSelect = (id: string) => {
    const url = `${window.location.origin}/embed/${encodeURIComponent(id)}`;
    setInputValue(url);
    setActiveSnippetId(id);
    setParseError(null);
    setReloadNonce((n) => n + 1);
    setSearchParams({ snippet: id }, { replace: true });
  };

  const iframeSrc = apiOrigin + '/embed/' + encodeURIComponent(activeSnippetId);

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-8 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--ink)]">
            Interactive embed sandbox
          </h1>
          <p className="mt-1.5 max-w-[65ch] text-sm text-[var(--secondary-text)]">
            Paste any copied embed URL or <code className="font-mono text-xs">&lt;iframe&gt;</code>{' '}
            tag to render the widget inside a simulated external documentation page and verify
            Public, Unlisted, and Private visibility enforcement.
          </p>
        </div>
      </div>

      {/* Controls Panel */}
      <section
        aria-label="Embed sandbox controls"
        className="mt-6 rounded-[12px] border border-[var(--hairline)] bg-[var(--paper)] p-5 space-y-4"
      >
        <form onSubmit={handleLoadEmbed} className="space-y-2">
          <Label htmlFor="sandbox-embed-input">
            Embed URL, full iframe tag, or snippet ID
          </Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="sandbox-embed-input"
              value={inputValue}
              invalid={Boolean(parseError)}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Paste copied embed link or <iframe src='...'> tag"
              className="flex-1 font-mono text-xs"
            />
            <Button type="submit" variant="primary" size="md">
              <Play className="h-3.5 w-3.5" aria-hidden="true" />
              Load embed
            </Button>
          </div>
          {parseError && (
            <p role="alert" className="flex items-center gap-1.5 text-xs font-medium text-[var(--error-ink)]">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {parseError}
            </p>
          )}
        </form>

        {/* Quick-load buttons from current library + private denial test */}
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--hairline)] pt-3.5">
          <span className="text-xs font-medium text-[var(--secondary-text)] mr-1">
            Quick test:
          </span>
          {(listQuery.data?.items ?? []).slice(0, 4).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleQuickSelect(item.id)}
              className={cn(
                'rounded-[6px] border px-2.5 py-1 text-xs transition-colors cursor-pointer whitespace-nowrap',
                activeSnippetId === item.id
                  ? 'border-[var(--action)] bg-[var(--selected-tint)] font-semibold text-[var(--action-bright)]'
                  : 'border-[var(--code-border)] bg-[var(--code-surface)] text-[var(--code-ink)] hover:border-[var(--action)] hover:text-white',
              )}
            >
              {item.title} ({item.visibility})
            </button>
          ))}
          <button
            type="button"
            onClick={() => handleQuickSelect('rate-limit-draft')}
            className={cn(
              'inline-flex items-center gap-1 rounded-[6px] border px-2.5 py-1 text-xs transition-colors cursor-pointer whitespace-nowrap',
              activeSnippetId === 'rate-limit-draft'
                ? 'border-[var(--action)] bg-[var(--selected-tint)] font-semibold text-[var(--action-bright)]'
                : 'border-[var(--code-border)] bg-[var(--code-surface)] text-[var(--code-ink)] hover:border-[var(--action)] hover:text-white',
            )}
          >
            <Lock className="h-3 w-3" aria-hidden="true" />
            Test Private denial
          </button>
        </div>

        {/* Viewport & Anonymous Simulation toggles */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--hairline)] pt-3.5">
          <div
            role="group"
            aria-label="Simulated host width"
            className="inline-flex items-center rounded-[8px] border border-[var(--hairline)] bg-[var(--canvas)] p-1"
          >
            {(Object.keys(WIDTH_MAP) as ViewportPreset[]).map((preset) => (
              <button
                key={preset}
                type="button"
                aria-pressed={viewport === preset}
                onClick={() => setViewport(preset)}
                className={cn(
                  'relative rounded-[6px] px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap',
                  viewport === preset
                    ? 'text-[var(--action-bright)]'
                    : 'text-[var(--secondary-text)] hover:text-[var(--ink)]',
                )}
              >
                {viewport === preset && (
                  <motion.span
                    layoutId="sandbox-viewport-pill"
                    transition={prefersReducedMotion ? INSTANT_TRANSITION : SPRING_SEGMENT}
                    className="absolute inset-0 rounded-[8px] bg-[var(--selected-tint)] [box-shadow:inset_0_0_0_1px_rgba(0,113,227,0.18)]"
                  />
                )}
                <span className="relative z-10">{WIDTH_MAP[preset].label}</span>
              </button>
            ))}
          </div>

          <p className="text-xs">Embeds always use anonymous access. Private snippets are denied.</p>
        </div>
      </section>

      {/* Simulated External Host Article Rendering Live Iframe */}
      <section aria-label="Simulated external host page" className="mt-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--secondary-text)]">
          <span className="inline-flex items-center gap-1.5 font-medium text-[var(--ink)]">
            <Code2 className="h-4 w-4 text-[var(--action)]" aria-hidden="true" />
            Simulated external host page — rendering live <code className="font-mono">{iframeSrc}</code>
          </span>
          <a
            href={iframeSrc}
            className="inline-flex items-center gap-1 font-medium text-[var(--action-bright)] hover:underline"
          >
            Open iframe target directly
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </div>

        <div className="rounded-[12px] border border-[var(--hairline)] bg-[var(--paper)] p-6 sm:p-8">
          <motion.article
            layout={!prefersReducedMotion}
            transition={prefersReducedMotion ? INSTANT_TRANSITION : TRANSITION_BASE}
            className={cn('mx-auto', WIDTH_MAP[viewport].widthClass)}
          >
            <p className="text-xs font-medium text-[var(--secondary-text)]">
              Engineering Notes · External Documentation Preview
            </p>
            <h2 className="mt-1.5 text-xl font-bold text-[var(--ink)]">
              Integrating shared multi-file snippets in technical docs
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--secondary-text)]">
              The embedded frame below is an actual <code className="font-mono text-xs">&lt;iframe&gt;</code>{' '}
              pointing at <code className="font-mono text-xs">{iframeSrc}</code>. The backend renders escaped, highlighted code.
            </p>

            <div className="mt-5 overflow-hidden rounded-[12px] border border-[var(--hairline)] bg-[var(--canvas)]">
              <iframe
                key={`${iframeSrc}-${reloadNonce}`}
                src={iframeSrc}
                title={`Embedded snippet ${activeSnippetId}`}
                className="block w-full h-[450px] border-0 bg-[var(--paper)]"
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--secondary-text)]">
              <span className="inline-flex items-center gap-1 text-[var(--success-ink)] font-medium">
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                Zero raw HTML execution
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Viewer context: Anonymous guest
              </span>
            </div>
          </motion.article>
        </div>
      </section>
    </div>
  );
}
