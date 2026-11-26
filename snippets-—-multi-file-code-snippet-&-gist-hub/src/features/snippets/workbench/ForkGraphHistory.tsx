import {
  ChevronDown,
  ChevronRight,
  Clock,
  Eye,
  GitBranch,
  GitCommitHorizontal,
  GitFork,
  Globe2,
  Lock,
  Minus,
  Pencil,
  Plus,
  PlusCircle,
} from 'lucide-react';
import * as React from 'react';
import { Link, useSearchParams } from 'react-router';
import { Button } from '@/src/components/ui/button';
import type { ForkGraphNode, Snippet, SnippetRevision } from '@/src/data/snippets/domain';
import { ShikiDiffViewer } from '@/src/features/snippets/reader/ShikiDiffViewer';
import { computeFilesDiff } from '@/src/lib/diff';
import { cn, formatRelativeTime, formatShortDate } from '@/src/lib/utils';

interface ForkGraphHistoryProps {
  snippet: Snippet;
  onFork?: () => void;
  isForking?: boolean;
  onOpenDiffView?: () => void;
}

interface PositionedNode {
  node: ForkGraphNode;
  col: number;
  row: number;
  x: number;
  y: number;
}

const NODE_WIDTH = 248;
const NODE_HEIGHT = 104;
const COL_GAP = 64;
const ROW_GAP = 22;
const PAD_X = 20;
const PAD_Y = 20;

function layoutForkTree(nodes: readonly ForkGraphNode[]): {
  positioned: PositionedNode[];
  edges: Array<{
    from: PositionedNode;
    to: PositionedNode;
    onActivePath: boolean;
  }>;
  width: number;
  height: number;
} {
  if (nodes.length === 0) {
    return { positioned: [], edges: [], width: 320, height: 140 };
  }

  const byId = new Map<string, ForkGraphNode>();
  const childrenByParent = new Map<string, ForkGraphNode[]>();
  for (const n of nodes) {
    byId.set(n.id, n);
    if (n.parentId && nodes.some((p) => p.id === n.parentId)) {
      const list = childrenByParent.get(n.parentId) ?? [];
      list.push(n);
      childrenByParent.set(n.parentId, list);
    }
  }

  // Compute active ancestry chain from current node up to root
  const activeChain = new Set<string>();
  let cursor = nodes.find((n) => n.isCurrent);
  while (cursor) {
    activeChain.add(cursor.id);
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }

  const root = nodes.find((n) => n.depth === 0) ?? nodes[0];
  const positionedMap = new Map<string, PositionedNode>();
  let nextRow = 0;

  const assignPositions = (node: ForkGraphNode, col: number): number => {
    const children = childrenByParent.get(node.id) ?? [];
    let row: number;
    if (children.length === 0) {
      row = nextRow;
      nextRow += 1;
    } else {
      const childRows = children.map((child) => assignPositions(child, col + 1));
      row = (childRows[0] + childRows[childRows.length - 1]) / 2;
    }

    positionedMap.set(node.id, {
      node,
      col,
      row,
      x: PAD_X + col * (NODE_WIDTH + COL_GAP),
      y: PAD_Y + row * (NODE_HEIGHT + ROW_GAP),
    });
    return row;
  };

  assignPositions(root, 0);

  // Place any unvisited disconnected nodes cleanly below
  for (const n of nodes) {
    if (!positionedMap.has(n.id)) {
      const row = nextRow;
      nextRow += 1;
      positionedMap.set(n.id, {
        node: n,
        col: n.depth,
        row,
        x: PAD_X + n.depth * (NODE_WIDTH + COL_GAP),
        y: PAD_Y + row * (NODE_HEIGHT + ROW_GAP),
      });
    }
  }

  const positioned = Array.from(positionedMap.values());
  const edges: Array<{ from: PositionedNode; to: PositionedNode; onActivePath: boolean }> = [];

  for (const item of positioned) {
    if (item.node.parentId) {
      const parentPos = positionedMap.get(item.node.parentId);
      if (parentPos) {
        edges.push({
          from: parentPos,
          to: item,
          onActivePath: activeChain.has(parentPos.node.id) && activeChain.has(item.node.id),
        });
      }
    }
  }

  const maxCol = Math.max(...positioned.map((p) => p.col), 0);
  const maxRow = Math.max(...positioned.map((p) => p.row), 0);

  return {
    positioned,
    edges,
    width: Math.max(540, PAD_X * 2 + (maxCol + 1) * NODE_WIDTH + maxCol * COL_GAP),
    height: Math.max(150, PAD_Y * 2 + (maxRow + 1) * NODE_HEIGHT + maxRow * ROW_GAP),
  };
}

function RevisionTypeIcon({ type }: { type: SnippetRevision['type'] }) {
  switch (type) {
    case 'forked':
      return <GitFork className="h-3.5 w-3.5 text-[var(--action-bright)]" aria-hidden="true" />;
    case 'created':
      return <PlusCircle className="h-3.5 w-3.5 text-[var(--success-ink)]" aria-hidden="true" />;
    case 'visibility':
      return <Globe2 className="h-3.5 w-3.5 text-[var(--warning-ink)]" aria-hidden="true" />;
    default:
      return <Pencil className="h-3.5 w-3.5 text-[var(--action-bright)]" aria-hidden="true" />;
  }
}

export function ForkGraphHistory({
  snippet,
  onFork,
  isForking = false,
  onOpenDiffView,
}: ForkGraphHistoryProps) {
  const [activeTab, setActiveTab] = React.useState<'graph' | 'history'>('graph');
  const [expandedRevisionId, setExpandedRevisionId] = React.useState<string | null>(null);
  const [selectedDiffFileByRev, setSelectedDiffFileByRev] = React.useState<Record<string, string>>(
    {},
  );
  const [searchParams] = useSearchParams();

  const preservedQuery = React.useMemo(() => {
    const scope = searchParams.get('scope');
    return scope ? `?scope=${encodeURIComponent(scope)}` : '';
  }, [searchParams]);

  const graphLayout = React.useMemo(
    () => layoutForkTree(snippet.forkGraph),
    [snippet.forkGraph],
  );

  // Reset expanded revision when switching snippets
  React.useEffect(() => {
    setExpandedRevisionId(null);
  }, [snippet.id]);

  const forkCountInTree = Math.max(0, snippet.forkGraph.length - 1);

  return (
    <section
      aria-label="Fork graph and tracking history"
      className="overflow-hidden rounded-[10px] border border-[var(--hairline)] bg-[var(--sidebar)]/70"
    >
      {/* Header bar with Shiki/IDE segmented tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--hairline)] bg-[var(--code-surface-elevated)] px-3.5 py-2">
        <div
          role="tablist"
          aria-label="Lineage and revision panels"
          className="inline-flex items-center rounded-[6px] border border-[var(--hairline)] bg-[var(--code-surface)] p-0.5"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'graph'}
            onClick={() => setActiveTab('graph')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-[4px] px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer',
              activeTab === 'graph'
                ? 'bg-[var(--selected-tint)] text-[var(--action-bright)]'
                : 'text-[var(--secondary-text)] hover:text-[var(--ink)]',
            )}
          >
            <GitBranch className="h-3.5 w-3.5" aria-hidden="true" />
            Fork Graph
            <span className="font-mono text-[10.5px] opacity-80 tabular-nums">
              {snippet.forkGraph.length}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'history'}
            onClick={() => setActiveTab('history')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-[4px] px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer',
              activeTab === 'history'
                ? 'bg-[var(--selected-tint)] text-[var(--action-bright)]'
                : 'text-[var(--secondary-text)] hover:text-[var(--ink)]',
            )}
          >
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            Tracking History
            <span className="font-mono text-[10.5px] opacity-80 tabular-nums">
              {snippet.history.length}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {snippet.forkedFrom && onOpenDiffView && (
            <Button
              type="button"
              variant="code"
              size="sm"
              onClick={onOpenDiffView}
              className="h-7 px-2.5 text-[11px]"
            >
              <Eye className="h-3 w-3 text-[var(--action-bright)]" aria-hidden="true" />
              Compare vs original
            </Button>
          )}
          {onFork && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isForking}
              onClick={onFork}
              className="h-7 px-2.5 text-[11px]"
            >
              <GitFork className="h-3 w-3" aria-hidden="true" />
              {isForking ? 'Forking…' : 'Branch new fork'}
            </Button>
          )}
        </div>
      </div>

      {/* TAB 1: Interactive Visual Fork Graph */}
      {activeTab === 'graph' && (
        <div className="p-3.5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--secondary-text)]">
            <span>
              {forkCountInTree === 0
                ? 'Original root snippet — no forks created yet. Branch a fork to start a lineage tree.'
                : `${snippet.forkGraph.length} nodes across this fork lineage (${forkCountInTree} ${forkCountInTree === 1 ? 'fork' : 'forks'}). Click any node to open it.`}
            </span>
            <div className="flex items-center gap-3 text-[11px] font-mono text-[var(--muted-text)]">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[var(--action)]" aria-hidden="true" />
                Active path
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#c7c7cc]" aria-hidden="true" />
                Other branches
              </span>
            </div>
          </div>

          <div className="overflow-x-auto rounded-[10px] border border-[var(--hairline)] bg-[var(--paper)]">
            <div
              className="relative"
              style={{
                width: `${graphLayout.width}px`,
                height: `${graphLayout.height}px`,
              }}
            >
              {/* Crisp SVG Cubic-Bezier Branch Connectors */}
              <svg
                width={graphLayout.width}
                height={graphLayout.height}
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
              >
                {graphLayout.edges.map(({ from, to, onActivePath }) => {
                  const startX = from.x + NODE_WIDTH;
                  const startY = from.y + NODE_HEIGHT / 2;
                  const endX = to.x;
                  const endY = to.y + NODE_HEIGHT / 2;
                  const midX = startX + (endX - startX) * 0.52;
                  const d = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;

                  return (
                    <g key={`${from.node.id}-${to.node.id}`}>
                      <path
                        d={d}
                        fill="none"
                        stroke={onActivePath ? '#0071e3' : '#c7c7cc'}
                        strokeWidth={onActivePath ? 2 : 1.5}
                      />
                      <circle
                        cx={startX}
                        cy={startY}
                        r={3}
                        fill={onActivePath ? '#0071e3' : '#c7c7cc'}
                      />
                      <circle
                        cx={endX}
                        cy={endY}
                        r={3.5}
                        fill={onActivePath ? '#0071e3' : '#c7c7cc'}
                      />
                    </g>
                  );
                })}
              </svg>

              {/* Interactive Graph Nodes */}
              {graphLayout.positioned.map(({ node, x, y }) => {
                const isRoot = node.depth === 0;
                const hasCodeChanges = node.addedLines > 0 || node.removedLines > 0;

                const cardInner = (
                  <div
                    className={cn(
                      'flex h-full w-full flex-col justify-between rounded-[8px] border p-3 transition-colors',
                      node.isCurrent
                        ? 'border-[var(--action)] bg-[var(--selected-tint)] [box-shadow:inset_0_0_0_1px_rgba(0,113,227,0.22)]'
                        : node.isAccessible
                          ? 'border-[var(--hairline)] bg-[var(--sidebar)] hover:border-[var(--control-border)] hover:bg-[var(--paper)]'
                          : 'border-[var(--hairline)]/60 bg-[var(--paper-hover)] opacity-70',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 text-[10.5px] font-mono">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 font-medium',
                          node.isCurrent
                            ? 'text-[var(--action-bright)]'
                            : isRoot
                              ? 'text-[var(--success-ink)]'
                              : 'text-[var(--secondary-text)]',
                        )}
                      >
                        {isRoot ? (
                          <GitCommitHorizontal className="h-3 w-3" aria-hidden="true" />
                        ) : (
                          <GitFork className="h-3 w-3" aria-hidden="true" />
                        )}
                        {isRoot ? 'Origin' : `Fork · Gen ${node.depth}`}
                      </span>

                      {node.isCurrent ? (
                        <span className="rounded bg-[var(--action)]/25 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--action-bright)]">
                          Viewing
                        </span>
                      ) : !node.isAccessible ? (
                        <Lock className="h-3 w-3 text-[var(--muted-text)]" aria-hidden="true" />
                      ) : (
                        <span className="text-[var(--muted-text)] capitalize">
                          {node.visibility}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <p
                        className="truncate text-xs font-semibold text-[var(--ink)]"
                        title={node.title}
                      >
                        {node.title}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-[var(--muted-text)]">
                        {node.ownerHandle} · {node.fileCount}{' '}
                        {node.fileCount === 1 ? 'file' : 'files'} ·{' '}
                        {formatRelativeTime(node.updatedAt)}
                      </p>
                    </div>

                    <div className="flex items-center justify-between border-t border-[var(--hairline)]/70 pt-1.5 font-mono text-[10.5px] tabular-nums">
                      {isRoot ? (
                        <span className="text-[var(--muted-text)]">Base snapshot</span>
                      ) : hasCodeChanges ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="text-[var(--success-ink)]">+{node.addedLines}</span>
                          <span className="text-[var(--error-ink)]">-{node.removedLines}</span>
                          <span className="text-[var(--muted-text)]">
                            · {node.changedFilesCount}{' '}
                            {node.changedFilesCount === 1 ? 'file' : 'files'}
                          </span>
                        </span>
                      ) : (
                        <span className="text-[var(--muted-text)]">No edits from parent</span>
                      )}
                    </div>
                  </div>
                );

                return (
                  <div
                    key={node.id}
                    className="absolute"
                    style={{
                      left: `${x}px`,
                      top: `${y}px`,
                      width: `${NODE_WIDTH}px`,
                      height: `${NODE_HEIGHT}px`,
                    }}
                  >
                    {node.isAccessible && !node.isCurrent ? (
                      <Link
                        to={`/snippets/${encodeURIComponent(node.id)}${preservedQuery}`}
                        className="block h-full w-full rounded-[8px]"
                      >
                        {cardInner}
                      </Link>
                    ) : (
                      cardInner
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Tracking History Timeline with Inline Shiki Revision Diffs */}
      {activeTab === 'history' && (
        <div className="p-3.5">
          <ol className="relative space-y-3 border-l border-[var(--hairline)] ml-2.5 pl-5">
            {snippet.history.map((rev, idx) => {
              const previousRev = snippet.history[idx + 1];
              const isExpanded = expandedRevisionId === rev.id;

              const baseFilesForRev =
                previousRev?.snapshotFiles ??
                (rev.type === 'forked' ? snippet.forkOriginFiles ?? [] : []);
              const revDiff = computeFilesDiff(baseFilesForRev, rev.snapshotFiles);
              const changedFilesInRev = revDiff.files.filter((f) => f.status !== 'unchanged');
              const inspectableFiles =
                changedFilesInRev.length > 0 ? changedFilesInRev : revDiff.files;
              const selectedPath =
                selectedDiffFileByRev[rev.id] ?? inspectableFiles[0]?.path ?? '';
              const activeFileDiff =
                inspectableFiles.find((f) => f.path === selectedPath) ?? inspectableFiles[0];

              return (
                <li key={rev.id} className="relative">
                  {/* Timeline node indicator */}
                  <span
                    aria-hidden="true"
                    className="absolute -left-[29px] top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-[var(--hairline)] bg-[var(--code-surface)]"
                  >
                    <RevisionTypeIcon type={rev.type} />
                  </span>

                  <div className="rounded-[8px] border border-[var(--hairline)] bg-[var(--code-surface)]/90">
                    <div className="flex flex-wrap items-start justify-between gap-2 px-3.5 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-medium text-[var(--ink)]">
                            {rev.summary}
                          </span>
                          {(rev.addedLines > 0 || rev.removedLines > 0) && (
                            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] tabular-nums">
                              {rev.addedLines > 0 && (
                                <span className="inline-flex items-center text-[var(--success-ink)]">
                                  <Plus className="h-2.5 w-2.5" aria-hidden="true" />
                                  {rev.addedLines}
                                </span>
                              )}
                              {rev.removedLines > 0 && (
                                <span className="inline-flex items-center text-[var(--error-ink)]">
                                  <Minus className="h-2.5 w-2.5" aria-hidden="true" />
                                  {rev.removedLines}
                                </span>
                              )}
                            </span>
                          )}
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[var(--muted-text)]">
                          <span className="text-[var(--secondary-text)]">
                            {rev.actorName} ({rev.actorHandle})
                          </span>
                          <span aria-hidden="true">·</span>
                          <span title={rev.timestamp}>
                            {formatRelativeTime(rev.timestamp)} ({formatShortDate(rev.timestamp)})
                          </span>
                          {rev.parentId && rev.parentTitle && (
                            <>
                              <span aria-hidden="true">·</span>
                              <Link
                                to={`/snippets/${encodeURIComponent(rev.parentId)}${preservedQuery}`}
                                className="text-[var(--action-bright)] hover:underline"
                              >
                                from {rev.parentTitle}
                              </Link>
                            </>
                          )}
                        </div>

                        {rev.filesChanged.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1 font-mono text-[10.5px] text-[var(--secondary-text)]">
                            {rev.filesChanged.map((fp) => (
                              <span
                                key={fp}
                                className="rounded border border-[var(--hairline)] bg-[var(--sidebar)] px-1.5 py-0.5"
                              >
                                {fp}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {inspectableFiles.length > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedRevisionId(isExpanded ? null : rev.id)
                          }
                          aria-expanded={isExpanded}
                          className="inline-flex items-center gap-1 rounded-[5px] border border-[var(--hairline)] bg-[var(--sidebar)] px-2 py-1 text-[11px] font-medium text-[var(--secondary-text)] hover:border-[var(--control-border)] hover:text-[var(--ink)] cursor-pointer shrink-0"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                          {isExpanded ? 'Hide diff' : 'Inspect diff'}
                        </button>
                      )}
                    </div>

                    {/* Expanded Shiki Revision Diff */}
                    {isExpanded && activeFileDiff && (
                      <div className="border-t border-[var(--hairline)]">
                        {inspectableFiles.length > 1 && (
                          <div className="flex items-center gap-1 overflow-x-auto border-b border-[var(--hairline)] bg-[var(--code-surface-elevated)] px-2.5 py-1.5">
                            {inspectableFiles.map((f) => {
                              const selected = f.path === activeFileDiff.path;
                              return (
                                <button
                                  key={f.path}
                                  type="button"
                                  onClick={() =>
                                    setSelectedDiffFileByRev((prev) => ({
                                      ...prev,
                                      [rev.id]: f.path,
                                    }))
                                  }
                                  className={cn(
                                    'inline-flex items-center gap-1.5 rounded-[5px] px-2 py-0.5 font-mono text-[11px] transition-colors cursor-pointer whitespace-nowrap',
                                    selected
                                      ? 'bg-[var(--selected-tint)] text-[var(--action-bright)] font-medium'
                                      : 'text-[var(--secondary-text)] hover:text-[var(--ink)]',
                                  )}
                                >
                                  <span>{f.path}</span>
                                  {(f.addedCount > 0 || f.removedCount > 0) && (
                                    <span className="text-[10px] tabular-nums">
                                      <span className="text-[var(--success-ink)]">
                                        +{f.addedCount}
                                      </span>{' '}
                                      <span className="text-[var(--error-ink)]">
                                        -{f.removedCount}
                                      </span>
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        <ShikiDiffViewer
                          path={activeFileDiff.path}
                          language={activeFileDiff.language}
                          originalText={activeFileDiff.originalText}
                          currentText={activeFileDiff.currentText}
                          status={activeFileDiff.status}
                          baseLabel={previousRev ? 'Previous revision' : 'Base'}
                          currentLabel={rev.type === 'created' ? 'Initial commit' : 'This revision'}
                          compact
                        />
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </section>
  );
}
