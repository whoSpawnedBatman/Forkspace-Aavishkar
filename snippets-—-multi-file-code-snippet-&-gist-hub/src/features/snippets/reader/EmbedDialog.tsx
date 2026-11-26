import { Check, Code2, Copy, ExternalLink, Lock } from 'lucide-react';
import * as React from 'react';
import { Link } from 'react-router';
import { Button } from '@/src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/src/components/ui/dialog';
import type { Snippet } from '@/src/data/snippets/domain';
import { copyTextToClipboard } from '@/src/lib/utils';

interface EmbedDialogProps {
  snippet: Snippet;
  activeFilePath: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCopied?: (label: string) => void;
}

export function EmbedDialog({
  snippet,
  activeFilePath,
  open,
  onOpenChange,
  onCopied,
}: EmbedDialogProps) {
  const [copiedField, setCopiedField] = React.useState<'link' | 'iframe' | 'raw' | null>(null);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const embedPath = `/embed/${encodeURIComponent(snippet.id)}`;
  const embedUrl = `${origin}${embedPath}`;
  const iframeMarkup = `<iframe src="${embedUrl}" title="${snippet.title.replace(/"/g, '&quot;')}" width="100%" height="440" style="border: 1px solid #e5e5ea; border-radius: 16px;" loading="lazy"></iframe>`;
  const rawPath = `/raw/${encodeURIComponent(snippet.id)}?file=${encodeURIComponent(activeFilePath)}`;
  const rawUrl = `${origin}${rawPath}`;
  const sandboxHref = `/sandbox?snippet=${encodeURIComponent(snippet.id)}`;

  const handleCopy = async (field: 'link' | 'iframe' | 'raw', text: string, label: string) => {
    const ok = await copyTextToClipboard(text);
    if (ok) {
      setCopiedField(field);
      onCopied?.(label);
      window.setTimeout(() => {
        setCopiedField((prev) => (prev === field ? null : prev));
      }, 2200);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogTitle>Embed &amp; raw output</DialogTitle>
        <DialogDescription>
          {snippet.canEmbed
            ? 'Copy the embed link or iframe tag to render this multi-file snippet inside external documentation or test it in the sandbox.'
            : 'Private snippets cannot be embedded or accessed anonymously.'}
        </DialogDescription>

        {!snippet.canEmbed ? (
          <div className="mt-4 rounded-[8px] border border-[var(--hairline)] bg-[var(--canvas)] p-4 text-sm text-[var(--secondary-text)]">
            <div className="flex items-start gap-2.5">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ink)]" aria-hidden="true" />
              <div>
                <p className="font-medium text-[var(--ink)]">Embedding is disabled for Private snippets</p>
                <p className="mt-1 text-xs leading-relaxed">
                  Edit this snippet and change its visibility to <strong>Public</strong> or{' '}
                  <strong>Unlisted</strong> to enable embeddable iframe widgets and anonymous raw
                  reads. You can still test how anonymous viewers are denied in the Embed Sandbox.
                </p>
                <div className="mt-3">
                  <Button asChild variant="secondary" size="sm">
                    <Link to={sandboxHref} onClick={() => onOpenChange(false)}>
                      <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Verify denial in Embed Sandbox
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {/* Embed URL */}
            <div>
              <label
                htmlFor="embed-link-input"
                className="block text-xs font-semibold text-[var(--ink)] mb-1.5"
              >
                Embed URL ({snippet.visibility})
              </label>
              <div className="flex gap-2">
                <input
                  id="embed-link-input"
                  readOnly
                  value={embedUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className="h-10 flex-1 rounded-[6px] border border-[var(--control-border)] bg-[var(--canvas)] px-3 font-mono text-xs text-[var(--ink)]"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => handleCopy('link', embedUrl, 'Embed link copied.')}
                >
                  {copiedField === 'link' ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-[var(--success-ink)]" aria-hidden="true" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      Copy link
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Iframe snippet */}
            <div>
              <label
                htmlFor="embed-iframe-textarea"
                className="block text-xs font-semibold text-[var(--ink)] mb-1.5"
              >
                HTML iframe widget
              </label>
              <textarea
                id="embed-iframe-textarea"
                readOnly
                rows={3}
                value={iframeMarkup}
                onFocus={(e) => e.currentTarget.select()}
                className="w-full rounded-[6px] border border-[var(--control-border)] bg-[var(--canvas)] p-3 font-mono text-xs leading-relaxed text-[var(--ink)]"
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-[var(--secondary-text)]">
                  Demo mode links resolve within this browser profile &amp; origin.
                </span>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => handleCopy('iframe', iframeMarkup, 'Iframe embed code copied.')}
                >
                  {copiedField === 'iframe' ? (
                    <>
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      Copied iframe
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      Copy iframe tag
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Raw per-file URL */}
            <div className="border-t border-[var(--hairline)] pt-4">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label
                  htmlFor="raw-file-input"
                  className="text-xs font-semibold text-[var(--ink)]"
                >
                  Raw plain-text endpoint ({activeFilePath})
                </label>
                <Link
                  to={rawPath}
                  onClick={() => onOpenChange(false)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[var(--action-bright)] hover:underline"
                >
                  Open raw view
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </Link>
              </div>
              <div className="flex gap-2">
                <input
                  id="raw-file-input"
                  readOnly
                  value={rawUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className="h-9 flex-1 rounded-[6px] border border-[var(--hairline)] bg-[var(--canvas)] px-3 font-mono text-xs text-[var(--secondary-text)]"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => handleCopy('raw', rawUrl, 'Raw file link copied.')}
                >
                  {copiedField === 'raw' ? 'Copied' : 'Copy raw URL'}
                </Button>
              </div>
              <p className="mt-1.5 text-[11px] font-mono text-[var(--secondary-text)]">
                Contract headers: Content-Type: text/plain; charset=utf-8 · X-Content-Type-Options: nosniff
              </p>
            </div>

            {/* Direct launch into Embed Test Sandbox */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--hairline)] pt-4">
              <Button asChild variant="secondary" size="sm">
                <Link to={embedPath} onClick={() => onOpenChange(false)}>
                  Open standalone widget
                </Link>
              </Button>
              <Button asChild variant="primary" size="sm">
                <Link to={sandboxHref} onClick={() => onOpenChange(false)}>
                  <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Test in Embed Sandbox
                </Link>
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
