import { Link } from 'react-router';
import type { Snippet } from '@/src/data/snippets/domain';
import { Button } from '@/src/components/ui/button';
export function ForkGraphHistory({ snippet, onOpenDiffView }: {
  snippet: Snippet; onFork?: () => void; isForking?: boolean; onOpenDiffView?: () => void;
}) {
  return <section aria-label="Fork graph" className="rounded-xl border border-[var(--hairline)] bg-[var(--paper)] p-5">
    <h2 className="font-semibold">Fork graph</h2>
    <p className="mt-1 text-xs text-[var(--secondary-text)]">Public lineage updates automatically. Private and unlisted forks are excluded.</p>
    {snippet.forkGraph.length ? <div className="relative mt-5 overflow-hidden rounded-xl border border-[var(--hairline)] bg-[var(--canvas)] p-4">
      <div className="pointer-events-none absolute bottom-6 left-[31px] top-6 w-px bg-[var(--hairline)]" />
      <ul className="relative space-y-3">
        {snippet.forkGraph.map((node, index) => <li key={node.id} className="relative flex gap-3">
          <span className={`relative z-10 mt-4 h-3 w-3 shrink-0 rounded-full border-2 ${node.isCurrent ? 'border-[var(--action)] bg-[var(--action)] shadow-[0_0_0_4px_var(--selected-tint)]' : 'border-[var(--code-border)] bg-[var(--paper)]'}`} aria-hidden="true" />
          <div className={`min-w-0 flex-1 rounded-xl border p-3.5 transition-colors ${node.isCurrent ? 'border-[var(--action)] bg-[var(--selected-tint)]' : 'border-[var(--hairline)] bg-[var(--paper)] hover:border-[var(--control-border)]'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link className="truncate text-sm font-semibold text-[var(--action)] hover:underline" to={'/snippets/' + node.id}>{node.title}</Link>
                <p className="mt-1 text-xs text-[var(--secondary-text)]">{node.parentId ? 'Fork of ' + (snippet.forkGraph.find(p => p.id === node.parentId)?.title ?? 'public snippet') : 'Original snippet'}</p>
              </div>
              <span className="shrink-0 font-mono text-[10px] text-[var(--muted-text)]">{node.isCurrent ? 'CURRENT' : `NODE ${index + 1}`}</span>
            </div>
          </div>
        </li>)}
      </ul>
    </div> : <p className="mt-4 text-sm">Public lineage is available for public snippets.</p>}
    {snippet.forkOriginFiles && <Button className="mt-4" variant="secondary" onClick={onOpenDiffView}>Compare with parent</Button>}
  </section>;
}
