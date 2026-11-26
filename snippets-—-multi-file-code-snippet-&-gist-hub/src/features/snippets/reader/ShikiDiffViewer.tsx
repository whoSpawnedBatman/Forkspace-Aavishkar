import { Minus, Plus } from 'lucide-react';
import * as React from 'react';
import { computeLineDiff, type DiffLine } from '@/src/lib/diff';
import { highlightCodeSafely, type HighlightResult } from '@/src/lib/shiki';
import { cn } from '@/src/lib/utils';

interface ShikiDiffViewerProps {
  path: string;
  language?: string;
  originalText: string;
  currentText: string;
  status?: 'added' | 'removed' | 'modified' | 'unchanged';
  baseLabel?: string;
  currentLabel?: string;
  compact?: boolean;
}

const CONTEXT_LINES = 3;

function filterToChangedHunks(lines: readonly DiffLine[]): Array<DiffLine | { type: 'separator'; hiddenCount: number }> {
  const changedIndices: number[] = [];
  lines.forEach((line, idx) => {
    if (line.type !== 'unchanged') {
      changedIndices.push(idx);
    }
  });

  if (changedIndices.length === 0) {
    return [...lines];
  }

  const visible = new Set<number>();
  for (const idx of changedIndices) {
    const start = Math.max(0, idx - CONTEXT_LINES);
    const end = Math.min(lines.length - 1, idx + CONTEXT_LINES);
    for (let k = start; k <= end; k += 1) {
      visible.add(k);
    }
  }

  const output: Array<DiffLine | { type: 'separator'; hiddenCount: number }> = [];
  let hiddenRun = 0;

  for (let i = 0; i < lines.length; i += 1) {
    if (visible.has(i)) {
      if (hiddenRun > 0) {
        output.push({ type: 'separator', hiddenCount: hiddenRun });
        hiddenRun = 0;
      }
      output.push(lines[i]);
    } else {
      hiddenRun += 1;
    }
  }
  if (hiddenRun > 0) {
    output.push({ type: 'separator', hiddenCount: hiddenRun });
  }

  return output;
}

export function ShikiDiffViewer({
  path,
  language,
  originalText,
  currentText,
  status,
  baseLabel = 'Original',
  currentLabel = 'Current',
  compact = false,
}: ShikiDiffViewerProps) {
  const [viewScope, setViewScope] = React.useState<'full' | 'changes'>('full');

  const diffLines = React.useMemo(
    () => computeLineDiff(originalText, currentText),
    [originalText, currentText],
  );

  const { addedCount, removedCount } = React.useMemo(() => {
    let added = 0;
    let removed = 0;
    for (const l of diffLines) {
      if (l.type === 'added') added += 1;
      else if (l.type === 'removed') removed += 1;
    }
    return { addedCount: added, removedCount: removed };
  }, [diffLines]);

  const resolvedStatus =
    status ??
    (!originalText && currentText
      ? 'added'
      : originalText && !currentText
        ? 'removed'
        : addedCount > 0 || removedCount > 0
          ? 'modified'
          : 'unchanged');

  const [origTokens, setOrigTokens] = React.useState<HighlightResult | null>(null);
  const [currTokens, setCurrTokens] = React.useState<HighlightResult | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    Promise.all([
      originalText ? highlightCodeSafely(originalText, language) : Promise.resolve(null),
      currentText ? highlightCodeSafely(currentText, language) : Promise.resolve(null),
    ]).then(([origRes, currRes]) => {
      if (!cancelled) {
        setOrigTokens(origRes);
        setCurrTokens(currRes);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [originalText, currentText, language]);

  const renderedRows = React.useMemo(() => {
    if (viewScope === 'changes' && (addedCount > 0 || removedCount > 0)) {
      return filterToChangedHunks(diffLines);
    }
    return diffLines;
  }, [diffLines, viewScope, addedCount, removedCount]);

  const statusText =
    resolvedStatus === 'added'
      ? 'New file in fork'
      : resolvedStatus === 'removed'
        ? 'Removed from fork'
        : resolvedStatus === 'modified'
          ? 'Modified from original'
          : 'Unchanged from original';

  const statusColor =
    resolvedStatus === 'added'
      ? 'text-[#5dd59b]'
      : resolvedStatus === 'removed'
        ? 'text-[#ff8a94]'
        : resolvedStatus === 'modified'
          ? 'text-[#8fc6ff]'
          : 'text-[var(--code-muted)]';

  return (
    <div className="bg-[var(--code-surface)] text-[var(--code-ink)]">
      {/* Diff summary sub-header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--code-border)] bg-[var(--code-header)] px-3.5 py-2 text-xs">
        <div className="flex flex-wrap items-center gap-2 font-mono">
          <span className="font-medium text-[var(--code-ink)]">{path}</span>
          <span aria-hidden="true" className="text-[var(--code-muted)]">
            ·
          </span>
          <span className={cn('font-sans text-[11.5px] font-medium', statusColor)}>
            {statusText}
          </span>
          {(addedCount > 0 || removedCount > 0) && (
            <>
              <span aria-hidden="true" className="text-[var(--code-muted)]">
                ·
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] tabular-nums">
                <span className="inline-flex items-center text-[#5dd59b]">
                  <Plus className="h-3 w-3" aria-hidden="true" />
                  {addedCount}
                </span>
                <span className="inline-flex items-center text-[#ff8a94]">
                  <Minus className="h-3 w-3" aria-hidden="true" />
                  {removedCount}
                </span>
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-[11px] text-[var(--code-muted)]">
            {baseLabel} → {currentLabel}
          </span>
          {(addedCount > 0 || removedCount > 0) && (
            <div
              role="group"
              aria-label="Diff context filter"
              className="inline-flex items-center rounded-[5px] border border-[var(--hairline)] bg-[var(--code-surface)] p-0.5"
            >
              <button
                type="button"
                aria-pressed={viewScope === 'full'}
                onClick={() => setViewScope('full')}
                className={cn(
                  'rounded-[4px] px-2 py-0.5 text-[11px] transition-colors cursor-pointer',
                  viewScope === 'full'
                    ? 'bg-[var(--code-surface-elevated)] text-[#8fc6ff] font-medium'
                    : 'text-[var(--code-ink)] hover:text-[var(--ink)]',
                )}
              >
                Full file
              </button>
              <button
                type="button"
                aria-pressed={viewScope === 'changes'}
                onClick={() => setViewScope('changes')}
                className={cn(
                  'rounded-[4px] px-2 py-0.5 text-[11px] transition-colors cursor-pointer',
                  viewScope === 'changes'
                    ? 'bg-[var(--code-surface-elevated)] text-[#8fc6ff] font-medium'
                    : 'text-[var(--code-ink)] hover:text-[var(--ink)]',
                )}
              >
                Changes only
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Shiki-tokenized unified diff surface */}
      <div
        className={cn(
          'overflow-auto font-mono text-[13px] leading-[1.6]',
          compact ? 'max-h-[340px]' : 'min-h-[380px] max-h-[540px]',
        )}
      >
        {renderedRows.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-[var(--code-muted)]">
            (Empty file)
          </div>
        ) : (
          <table className="w-full border-collapse">
            <tbody>
              {renderedRows.map((row, rowIndex) => {
                if ('hiddenCount' in row) {
                  return (
                    <tr
                      key={`sep-${rowIndex}`}
                      className="border-y border-[var(--hairline)]/60 bg-[var(--code-surface-elevated)] text-[11px] text-[var(--code-muted)]"
                    >
                      <td colSpan={4} className="px-4 py-1 text-center font-sans">
                        ··· {row.hiddenCount} unchanged{' '}
                        {row.hiddenCount === 1 ? 'line' : 'lines'} hidden ···
                      </td>
                    </tr>
                  );
                }

                const tokens =
                  row.type === 'removed' && row.oldLineNumber
                    ? origTokens?.lines[row.oldLineNumber - 1]
                    : row.newLineNumber
                      ? currTokens?.lines[row.newLineNumber - 1]
                      : undefined;

                const isAdded = row.type === 'added';
                const isRemoved = row.type === 'removed';

                return (
                  <tr
                    key={`${row.type}-${row.oldLineNumber ?? 'x'}-${row.newLineNumber ?? 'y'}-${rowIndex}`}
                    className={cn(
                      isAdded && 'bg-[#17382a]',
                      isRemoved && 'bg-[#3a1f25]',
                    )}
                  >
                    {/* Old line number */}
                    <td
                      aria-hidden="true"
                      className={cn(
                        'w-10 select-none border-r border-[var(--hairline)]/50 px-2 text-right text-[11.5px] tabular-nums align-top',
                        isAdded
                          ? 'bg-[#153226] text-[#5dd59b]/60'
                          : isRemoved
                            ? 'bg-[#302024] text-[#ff8a94]/70'
                            : 'text-[var(--code-muted)]',
                      )}
                    >
                      {row.oldLineNumber ?? ''}
                    </td>

                    {/* New line number */}
                    <td
                      aria-hidden="true"
                      className={cn(
                        'w-10 select-none border-r border-[var(--hairline)]/70 px-2 text-right text-[11.5px] tabular-nums align-top',
                        isAdded
                          ? 'bg-[#153226] text-[#5dd59b]/80'
                          : isRemoved
                            ? 'bg-[#302024] text-[#ff8a94]/60'
                            : 'text-[var(--code-muted)]',
                      )}
                    >
                      {row.newLineNumber ?? ''}
                    </td>

                    {/* Change marker column */}
                    <td
                      aria-hidden="true"
                      className={cn(
                        'w-6 select-none pl-2 pr-1 text-center font-semibold align-top',
                        isAdded
                          ? 'border-l-2 border-l-[#5dd59b] text-[#5dd59b]'
                          : isRemoved
                            ? 'border-l-2 border-l-[#ff8a94] text-[#ff8a94]'
                            : 'border-l-2 border-l-transparent text-transparent',
                      )}
                    >
                      {isAdded ? '+' : isRemoved ? '-' : ' '}
                    </td>

                    {/* Syntax-colored line content (strictly React text nodes) */}
                    <td className="whitespace-pre pr-4 align-top">
                      {tokens && tokens.length > 0 ? (
                        tokens.map((tok, tokIdx) => (
                          <span
                            key={tokIdx}
                            style={tok.color ? { color: tok.color } : undefined}
                          >
                            {tok.content}
                          </span>
                        ))
                      ) : (
                        <span>{row.content || ' '}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
