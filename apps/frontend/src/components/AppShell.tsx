import {
  Check,
  ChevronDown,
  ChevronUp,
  Code2,
  Compass,
  FolderGit2,
  Globe2,
  LogIn,
  LogOut,
  Menu,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Star,
  UserCheck,
  X,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import * as React from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { OPEN_COMMAND_PALETTE_EVENT } from '@/src/components/CommandPalette';
import { SnipbaseMark } from '@/src/components/SnipbaseMark';
import { Button } from '@/src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/src/components/ui/dialog';
import {
  type LibraryScope,
} from '@/src/data/snippets/domain';
import { useSnippetsContext } from '@/src/features/snippets/context';
import { useSnippetDetail, useSnippetsList } from '@/src/features/snippets/queries';
import {
  EASE_OUT_EXPO,
  INSTANT_TRANSITION,
  SPRING_LIST,
  SPRING_SEGMENT,
  TRANSITION_BASE,
  TRANSITION_FAST,
  TRANSITION_OVERLAY,
} from '@/src/lib/motion';
import { cn, copyTextToClipboard, formatRelativeTime } from '@/src/lib/utils';

const VALID_SCOPES: ReadonlyArray<LibraryScope> = ['mine', 'shared', 'discover', 'starred'];

function parseScope(raw: string | null, isGuest: boolean): LibraryScope {
  if (raw && (VALID_SCOPES as readonly string[]).includes(raw)) {
    return raw as LibraryScope;
  }
  return isGuest ? 'discover' : 'mine';
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const {
    adapter,
    viewer,
    signOut,
  } = useSnippetsContext();

  const prefersReducedMotion = useReducedMotion();
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams<{ snippetId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const isGuest = viewer.role === 'guest';
  const scope = parseScope(searchParams.get('scope'), isGuest);
  const activeTag = searchParams.get('tag') ?? '';
  const urlQuery = searchParams.get('q') ?? '';

  const [searchDraft, setSearchDraft] = React.useState(urlQuery);
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = React.useState(false);

  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const accountMenuRef = React.useRef<HTMLDivElement>(null);

  // Keep search input synchronized with URL query changes
  React.useEffect(() => {
    setSearchDraft(urlQuery);
  }, [urlQuery]);

  // Debounce search typing into URL query param
  React.useEffect(() => {
    const trimmed = searchDraft.trim();
    if (trimmed === urlQuery) return;
    const handle = window.setTimeout(() => {
      const next = new URLSearchParams(searchParams);
      if (trimmed) {
        next.set('q', trimmed);
      } else {
        next.delete('q');
      }
      setSearchParams(next, { replace: true });
    }, 180);
    return () => window.clearTimeout(handle);
  }, [searchDraft, urlQuery, searchParams, setSearchParams]);

  // Close workspace account menu on outside click or Escape
  React.useEffect(() => {
    if (!accountMenuOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setAccountMenuOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAccountMenuOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [accountMenuOpen]);

  const listQuery = useSnippetsList({
    scope,
    query: urlQuery,
    tag: activeTag,
  });

  const activeDetailQuery = useSnippetDetail(params.snippetId, {
    enabled: Boolean(params.snippetId),
  });

  const items = listQuery.data?.items ?? [];
  const availableTags = listQuery.data?.availableTags ?? [];

  const preservedQueryString = React.useMemo(() => {
    const next = new URLSearchParams();
    next.set('scope', scope);
    if (activeTag) next.set('tag', activeTag);
    if (urlQuery) next.set('q', urlQuery);
    return `?${next.toString()}`;
  }, [scope, activeTag, urlQuery]);

  const setScope = (nextScope: LibraryScope) => {
    const next = new URLSearchParams(searchParams);
    next.set('scope', nextScope);
    if (nextScope !== scope) {
      next.delete('tag');
    }
    setSearchParams(next, { replace: true });
  };

  const toggleTag = (tag: string) => {
    const next = new URLSearchParams(searchParams);
    if (activeTag === tag) {
      next.delete('tag');
    } else {
      next.set('tag', tag);
    }
    next.set('scope', scope);
    setSearchParams(next, { replace: true });
  };

  const clearFilters = () => {
    setSearchDraft('');
    const next = new URLSearchParams(searchParams);
    next.delete('q');
    next.delete('tag');
    setSearchParams(next, { replace: true });
  };

  const handleSignOut = async () => {
    await signOut();
    setAccountMenuOpen(false);
    navigate('/login');
  };

  // Breadcrumb calculation
  const activeSnippetFromList = items.find((item) => item.id === params.snippetId);
  const scopeLabel =
    scope === 'mine'
      ? 'Mine'
      : scope === 'shared'
        ? 'Shared'
        : scope === 'starred'
          ? 'Starred'
          : 'Discover';

  const currentCrumb = location.pathname.startsWith('/snippets/new')
    ? 'New snippet'
    : location.pathname.startsWith('/sandbox')
      ? 'Embed sandbox'
      : activeDetailQuery.data?.title ??
        activeSnippetFromList?.title ??
        (params.snippetId ? params.snippetId : 'Workspace');

  const renderRailContent = (surfaceId: 'desktop' | 'mobile') => (
    <div className="flex h-full flex-col bg-[var(--sidebar)] text-[var(--ink)]">
      {/* Notion-style Workspace Switcher + Primary New Action */}
      <div className="flex items-center justify-between gap-2 border-b border-[var(--hairline)] px-3 py-2.5">
        <div
          className="relative min-w-0 flex-1"
          ref={surfaceId === 'desktop' ? accountMenuRef : undefined}
        >
          <button
            type="button"
            onClick={() => setAccountMenuOpen((o) => !o)}
            aria-expanded={accountMenuOpen}
            aria-haspopup="menu"
            className="flex w-full items-center gap-2 rounded-[6px] px-1.5 py-1 text-left transition-colors hover:bg-[var(--hover)] cursor-pointer"
          >
            <SnipbaseMark className="h-5 w-5 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <span className="truncate text-[13px] font-semibold tracking-tight text-[var(--ink)]">
                  Snipbase
                </span>
                <motion.span
                  animate={{ rotate: accountMenuOpen ? 180 : 0 }}
                  transition={prefersReducedMotion ? INSTANT_TRANSITION : TRANSITION_FAST}
                  className="inline-flex shrink-0"
                >
                  <ChevronDown
                    className="h-3.5 w-3.5 text-[var(--muted-text)]"
                    aria-hidden="true"
                  />
                </motion.span>
              </div>
              <p className="truncate text-[11px] text-[var(--muted-text)]">
                {viewer.role === 'user' ? viewer.email : 'Guest · Read-only'}
              </p>
            </div>
          </button>

          <AnimatePresence>
            {accountMenuOpen && (
              <motion.div
                role="menu"
                initial={prefersReducedMotion ? false : { opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.97 }}
                transition={prefersReducedMotion ? INSTANT_TRANSITION : TRANSITION_FAST}
                style={{ transformOrigin: 'top left' }}
                className="absolute left-0 top-full z-40 mt-1.5 w-[252px] rounded-[12px] border border-[var(--hairline)] bg-[var(--paper)] p-1.5 [box-shadow:var(--shadow)]"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setAccountMenuOpen(false);
                    navigate('/login');
                  }}
                  className="flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-xs text-[var(--secondary-text)] hover:bg-[var(--hover)] hover:text-[var(--ink)] cursor-pointer"
                >
                  <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
                  Email sign-in / Create account
                </button>

                {viewer.role === 'user' && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-xs text-[var(--secondary-text)] hover:bg-[var(--hover)] hover:text-[var(--ink)] cursor-pointer"
                  >
                    <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                    Sign out
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <Button
          asChild
          variant="primary"
          size="sm"
          className="h-7 shrink-0 px-2.5 text-xs"
          onClick={() => setMobileNavOpen(false)}
        >
          <Link to={`/snippets/new${preservedQueryString}`}>
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            New
          </Link>
        </Button>
      </div>

      {/* Scope Segmented Switcher with sliding spring indicator */}
      <div className="px-3 pt-3 pb-2 space-y-2.5 border-b border-[var(--hairline)]">
        <div
          role="tablist"
          aria-label="Snippet library scope"
          className="grid grid-cols-3 rounded-[8px] bg-[var(--paper-hover)] p-0.5"
        >
          {(
            [
              { id: 'mine', label: 'Mine' },
              { id: 'shared', label: 'Shared' },
              { id: 'discover', label: 'Discover' },
            ] as const
          ).map((tab) => {
            const active = scope === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setScope(tab.id)}
                className={cn(
                  'relative rounded-[5px] py-1 text-xs font-medium transition-colors cursor-pointer',
                  active
                    ? 'text-[var(--action-bright)]'
                    : 'text-[var(--secondary-text)] hover:text-[var(--ink)]',
                )}
              >
                {active && (
                  <motion.span
                    layoutId={`${surfaceId}-scope-pill`}
                    transition={prefersReducedMotion ? INSTANT_TRANSITION : SPRING_SEGMENT}
                    className="absolute inset-0 rounded-[5px] bg-[var(--selected-tint)]"
                  />
                )}
                <span className="relative z-10">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Full-text & tag search */}
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted-text)]"
            aria-hidden="true"
          />
          <input
            ref={surfaceId === 'desktop' ? searchInputRef : undefined}
            type="search"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder="Search tags, titles, code…"
            aria-label="Search snippets by tag, title, or code"
            className="h-9 w-full rounded-[9px] border border-[var(--hairline)] bg-[var(--paper)] pl-9 pr-11 text-xs text-[var(--ink)] placeholder:text-[var(--muted-text)] transition-colors focus-visible:border-[var(--action)] focus-visible:outline-none"
          />
          {searchDraft ? (
            <button
              type="button"
              onClick={() => setSearchDraft('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted-text)] hover:text-[var(--ink)] cursor-pointer"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE_EVENT))}
              aria-label="Open command palette"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded border border-[var(--hairline)] bg-[var(--sidebar)] px-1 py-0.5 font-mono text-[10px] text-[var(--muted-text)] hover:border-[var(--control-border)] hover:text-[var(--ink)] cursor-pointer"
            >
              ⌘K
            </button>
          )}
        </div>

        {/* Clickable tag filter strip */}
        {availableTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1" aria-label="Filter by tag">
            {availableTags.slice(0, 4).map((entry) => {
              const selected = activeTag === entry.tag;
              return (
                <button
                  key={entry.tag}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleTag(entry.tag)}
                  className={cn(
                    'rounded-[5px] px-1.5 py-0.5 font-mono text-[11px] transition-all duration-150 active:scale-[0.96] cursor-pointer',
                    selected
                      ? 'bg-[var(--selected-tint)] text-[var(--action-bright)] font-medium'
                      : 'text-[var(--muted-text)] hover:bg-[var(--hover)] hover:text-[var(--ink)]',
                  )}
                >
                  #{entry.tag}
                </button>
              );
            })}
            {(activeTag || urlQuery) && (
              <button
                type="button"
                onClick={clearFilters}
                className="ml-auto text-[11px] text-[var(--action-bright)] hover:underline cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* Inline Scrollable Snippet List with shared sliding active indicator */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        <div className="mb-1.5 flex items-center justify-between px-1.5">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[var(--muted-text)]">
            {scope === 'starred' ? 'Starred snippets' : `${scopeLabel} snippets`}
          </span>
          <span className="font-mono text-[10.5px] text-[var(--muted-text)] tabular-nums">
            {items.length}
          </span>
        </div>

        {listQuery.isLoading ? (
          <div className="space-y-1.5 px-1.5 py-1" aria-busy="true">
            {[1, 2, 3].map((idx) => (
              <div
                key={idx}
                className="h-14 rounded-[7px] bg-[var(--skeleton)] animate-pulse"
              />
            ))}
          </div>
        ) : listQuery.isError ? (
          <div role="alert" className="p-3 text-xs space-y-2">
            <p>{listQuery.error instanceof Error ? listQuery.error.message : 'Could not load snippets.'}</p>
            <Button size="sm" variant="secondary" onClick={() => listQuery.refetch()}>Retry</Button>
          </div>
        ) : items.length === 0 ? (
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={prefersReducedMotion ? INSTANT_TRANSITION : TRANSITION_FAST}
            className="rounded-[8px] border border-[var(--hairline)] bg-[var(--code-surface)] p-3.5 text-center"
          >
            <p className="text-xs font-medium text-[var(--code-ink)]">
              {activeTag || urlQuery
                ? 'No matching snippets'
                : scope === 'mine' && isGuest
                  ? 'Sign in to view your snippets'
                  : 'No snippets in this view'}
            </p>
            <p className="mt-1 text-[11px] text-[var(--muted-text)]">
              {activeTag || urlQuery
                ? 'Try clearing the active tag or search query.'
                : scope === 'mine' && isGuest
                  ? 'Switch to Discover or sign in with an email account.'
                  : 'Create a multi-file snippet or explore Discover.'}
            </p>
            <div className="mt-2.5 flex justify-center gap-2">
              {activeTag || urlQuery ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={clearFilters}
                >
                  Reset search
                </Button>
              ) : scope === 'mine' && isGuest ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setScope('discover')}
                >
                  Browse Discover
                </Button>
              ) : (
                <Button asChild variant="secondary" size="sm" className="h-7 text-xs">
                  <Link to={`/snippets/new${preservedQueryString}`}>New snippet</Link>
                </Button>
              )}
            </div>
          </motion.div>
        ) : (
          <ul key={`${scope}-${activeTag}`} className="space-y-1">
            {items.map((item, idx) => {
              const isSelected = params.snippetId === item.id;
              return (
                <motion.li
                  key={item.id}
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={
                    prefersReducedMotion
                      ? INSTANT_TRANSITION
                      : {
                          duration: 0.14,
                          delay: Math.min(idx * 0.02, 0.12),
                          ease: EASE_OUT_EXPO,
                        }
                  }
                  className="relative"
                >
                  <Link
                    to={`/snippets/${encodeURIComponent(item.id)}${preservedQueryString}`}
                    onClick={() => setMobileNavOpen(false)}
                    className={cn(
                      'relative block rounded-[7px] px-2.5 py-2 transition-colors',
                      isSelected
                        ? 'text-[var(--ink)]'
                        : 'text-[var(--secondary-text)] hover:bg-[var(--hover)] hover:text-[var(--ink)]',
                    )}
                  >
                    {isSelected && (
                      <motion.span
                        layoutId={`${surfaceId}-active-snippet`}
                        transition={prefersReducedMotion ? INSTANT_TRANSITION : SPRING_LIST}
                        className="absolute inset-0 rounded-[7px] bg-[var(--selected-tint)]"
                      />
                    )}

                    <div className="relative z-10">
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className={cn(
                            'truncate text-[13px] font-medium leading-snug transition-colors',
                            isSelected ? 'text-[var(--action-bright)]' : 'text-[var(--ink)]',
                          )}
                        >
                          {item.title}
                        </span>
                        {item.starCount > 0 && (
                          <span className="inline-flex items-center gap-0.5 font-mono text-[10.5px] text-[var(--muted-text)] tabular-nums shrink-0 mt-0.5">
                            <Star
                              className={cn(
                                'h-2.5 w-2.5',
                                item.viewerHasStarred &&
                                  'fill-[var(--action-bright)] text-[var(--action-bright)]',
                              )}
                              aria-hidden="true"
                            />
                            {item.starCount}
                          </span>
                        )}
                      </div>

                      <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-[var(--muted-text)] tabular-nums">
                        <span className="truncate">
                          {item.fileCount} {item.fileCount === 1 ? 'file' : 'files'} · {item.visibility} ·{' '}
                          {formatRelativeTime(item.updatedAt)}
                        </span>
                        {item.tags.length > 0 && (
                          <span className="shrink-0 font-mono text-[10.5px]">#{item.tags[0]}</span>
                        )}
                      </div>

                      {item.matchContext && (
                        <p className="mt-1.5 truncate rounded bg-[var(--code-surface)] px-1.5 py-0.5 font-mono text-[10.5px] text-[var(--secondary-text)]">
                          {item.matchContext.filePath}:{item.matchContext.lineNumber}{' '}
                          {item.matchContext.linePreview}
                        </p>
                      )}
                    </div>
                  </Link>
                </motion.li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Bottom Workspace Utility Links */}
      <div className="border-t border-[var(--hairline)] px-2 py-2 space-y-0.5">
        <button
          type="button"
          onClick={() => {
            setScope(scope === 'starred' ? (isGuest ? 'discover' : 'mine') : 'starred');
          }}
          className={cn(
            'flex w-full items-center gap-2 rounded-[6px] px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer',
            scope === 'starred'
              ? 'bg-[var(--selected-tint)] text-[var(--action-bright)]'
              : 'text-[var(--secondary-text)] hover:bg-[var(--hover)] hover:text-[var(--ink)]',
          )}
        >
          <Star className="h-3.5 w-3.5" aria-hidden="true" />
          Starred
        </button>

        <Link
          to="/sandbox"
          onClick={() => setMobileNavOpen(false)}
          className={cn(
            'flex w-full items-center gap-2 rounded-[6px] px-2.5 py-1.5 text-xs font-medium transition-colors',
            location.pathname.startsWith('/sandbox')
              ? 'bg-[var(--selected-tint)] text-[var(--action-bright)]'
              : 'text-[var(--secondary-text)] hover:bg-[var(--hover)] hover:text-[var(--ink)]',
          )}
        >
          <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
          Embed Sandbox
        </Link>


        <p className="px-2.5 pt-1 text-[10.5px] text-[var(--muted-text)]">
          Connected to Snipbase
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <a href="#main-content" className="skip-link">
        Skip to workspace
      </a>

      {/* Desktop Left Workspace Rail */}
      <aside
        aria-label="Snipbase workspace library"
        className="hidden lg:block w-[276px] shrink-0 border-r border-[var(--hairline)] sticky top-0 h-screen"
      >
        {renderRailContent('desktop')}
      </aside>

      {/* Animated Mobile Slide-Over Drawer */}
      <AnimatePresence>
        {mobileNavOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={prefersReducedMotion ? INSTANT_TRANSITION : TRANSITION_OVERLAY}
              className="fixed inset-0 bg-black/70 backdrop-blur-[1px]"
              onClick={() => setMobileNavOpen(false)}
              aria-hidden="true"
            />
            <motion.aside
              aria-label="Snipbase workspace library"
              initial={prefersReducedMotion ? false : { x: -284 }}
              animate={{ x: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { x: -284 }}
              transition={prefersReducedMotion ? INSTANT_TRANSITION : TRANSITION_OVERLAY}
              className="relative z-10 flex h-full w-[284px] max-w-[85vw] flex-col border-r border-[var(--hairline)] bg-[var(--sidebar)] shadow-[8px_0_24px_rgba(0,0,0,0.06)]"
            >
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close library sidebar"
                className="absolute right-2 top-2.5 z-20 rounded-[6px] p-1.5 text-[var(--secondary-text)] hover:bg-[var(--hover)] hover:text-[var(--ink)]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
              {renderRailContent('mobile')}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Right Main Column: Top Breadcrumb + Collapsible Demo Path + Workbench */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Minimal Breadcrumb Bar */}
        <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center justify-between gap-3 border-b border-[var(--hairline)] bg-[var(--canvas)]/95 px-4 backdrop-blur-sm sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 lg:hidden"
              aria-label="Open library sidebar"
              onClick={() => setMobileNavOpen(true)}
            >
              <Menu className="h-4 w-4" aria-hidden="true" />
            </Button>

            <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-xs">
              <Link
                to="/"
                className="font-medium text-[var(--secondary-text)] hover:text-[var(--ink)] whitespace-nowrap"
              >
                Snipbase
              </Link>
              <span aria-hidden="true" className="text-[var(--muted-text)]">
                /
              </span>
              <span className="text-[var(--secondary-text)] whitespace-nowrap">{scopeLabel}</span>
              <span aria-hidden="true" className="text-[var(--muted-text)]">
                /
              </span>
              <motion.span
                key={currentCrumb}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 2 }}
                animate={{ opacity: 1, y: 0 }}
                transition={prefersReducedMotion ? INSTANT_TRANSITION : TRANSITION_FAST}
                className="truncate font-medium text-[var(--ink)]"
              >
                {currentCrumb}
              </motion.span>
            </nav>
          </div>

          <div className="flex items-center gap-3 shrink-0">

            {viewer.role === 'user' ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2.5 text-xs"
                onClick={handleSignOut}
              >
                Sign out
              </Button>
            ) : (
              <Button asChild variant="ghost" size="sm" className="h-8 px-2.5 text-xs">
                <Link to="/login">
                  <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
                  Sign in
                </Link>
              </Button>
            )}
          </div>
        </header>

        {/* Active Workspace Main Surface */}
        <main id="main-content" className="min-w-0 flex-1">
          {children}
        </main>
      </div>

    </div>
  );
}
