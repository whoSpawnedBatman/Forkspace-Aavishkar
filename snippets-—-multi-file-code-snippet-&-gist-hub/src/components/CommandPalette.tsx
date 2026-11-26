import { Command } from 'cmdk';
import {
  ArrowRight,
  Code2,
  FileCode2,
  Hash,
  Link2,
  LogIn,
  PanelTop,
  Plus,
  Search,
  Sparkles,
  UserRound,
} from 'lucide-react';
import * as React from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useSnippetsContext } from '@/src/features/snippets/context';
import { useSnippetDetail, useSnippetsList } from '@/src/features/snippets/queries';
import type { LibraryScope } from '@/src/data/snippets/domain';
import { copyTextToClipboard } from '@/src/lib/utils';

export const OPEN_COMMAND_PALETTE_EVENT = 'snipbase:open-command-palette';

const VALID_SCOPES: ReadonlyArray<LibraryScope> = ['mine', 'shared', 'discover', 'starred'];

function parseScope(raw: string | null, isGuest: boolean): LibraryScope {
  if (raw && (VALID_SCOPES as readonly string[]).includes(raw)) return raw as LibraryScope;
  return isGuest ? 'discover' : 'mine';
}

const itemClass =
  'flex cursor-pointer items-center gap-3 rounded-[7px] px-2.5 py-2 text-xs text-[var(--secondary-text)] outline-none transition-colors data-[selected=true]:bg-[var(--selected-tint)] data-[selected=true]:text-[var(--ink)]';

function commandFilter(value: string, search: string, keywords?: string[]): number {
  const query = search.trim().toLowerCase();
  if (!query) return 1;
  const haystack = `${value} ${keywords?.join(' ') ?? ''}`.toLowerCase();
  const words = query.split(/\s+/).filter(Boolean);
  if (!words.every((word) => haystack.includes(word))) return 0;
  return haystack.includes(query) ? 1.5 : 1;
}

export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const {
    viewer,
    accounts,
    setViewerById,
    signOut,
    markDemoStep,
    announce,
  } = useSnippetsContext();

  const currentSearch = new URLSearchParams(location.search);
  const scope = parseScope(currentSearch.get('scope'), viewer.role === 'guest');
  const listQuery = useSnippetsList({ scope, query: '', tag: '' });
  const items = listQuery.data?.items ?? [];
  const tags = listQuery.data?.availableTags ?? [];

  const match = location.pathname.match(/^\/snippets\/([^/]+?)(?:\/edit)?\/?$/);
  const currentId = match && match[1] !== 'new' ? decodeURIComponent(match[1]) : undefined;
  const detailQuery = useSnippetDetail(currentId, { enabled: Boolean(currentId) });
  const snippet = detailQuery.data;

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpen);
    };
  }, []);

  const run = (action: () => void) => {
    setOpen(false);
    window.requestAnimationFrame(action);
  };

  const go = (path: string) => run(() => navigate(path));

  const copyEmbedLink = () => {
    if (!snippet) return;
    const link = `${window.location.origin}/embed/${encodeURIComponent(snippet.id)}`;
    void copyTextToClipboard(link).then((ok) => {
      if (!ok) {
        announce('Could not copy the embed link.');
        return;
      }
      markDemoStep('copiedEmbed');
      announce('Embed link copied to clipboard.');
    });
  };

  const toggleView = () => {
    if (!snippet) return;
    const editing = location.pathname.endsWith('/edit');
    const next = editing
      ? `/snippets/${encodeURIComponent(snippet.id)}`
      : `/snippets/${encodeURIComponent(snippet.id)}/edit`;
    const params = new URLSearchParams(location.search);
    params.delete('file');
    const suffix = params.toString();
    go(`${next}${suffix ? `?${suffix}` : ''}`);
  };

  const toggleExplanation = () => {
    if (!snippet) return;
    const params = new URLSearchParams(location.search);
    if (params.get('ai') === '1') params.delete('ai');
    else params.set('ai', '1');
    const suffix = params.toString();
    go(`${location.pathname}${suffix ? `?${suffix}` : ''}`);
  };

  const openSandbox = () => {
    const params = new URLSearchParams();
    if (snippet) params.set('snippet', snippet.id);
    const suffix = params.toString();
    go(`/sandbox${suffix ? `?${suffix}` : ''}`);
  };

  const filterByTag = (tag: string) => {
    const params = new URLSearchParams();
    params.set('scope', 'discover');
    params.set('tag', tag);
    markDemoStep('searchedTag');
    go(`/snippets?${params.toString()}`);
  };

  const switchAccount = (id: string) => {
    run(() => {
      setViewerById(id);
      navigate('/');
    });
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Global command menu"
      filter={commandFilter}
      loop
      overlayClassName="fixed inset-0 z-[70] bg-[var(--overlay)] backdrop-blur-[3px] animate-overlay-in"
      contentClassName="fixed left-1/2 top-[16%] z-[70] w-[calc(100%-2rem)] max-w-[600px] -translate-x-1/2 overflow-hidden rounded-[16px] border border-[var(--hairline)] bg-[var(--paper)] [box-shadow:var(--shadow)] animate-command-in focus:outline-none"
    >
      <div className="flex items-center gap-2 border-b border-[var(--hairline)] px-3.5">
        <Search className="h-4 w-4 shrink-0 text-[var(--muted-text)]" aria-hidden="true" />
        <Command.Input
          autoFocus
          placeholder="Search snippets, tags, or actions…"
          aria-label="Search commands"
          className="h-12 w-full bg-transparent text-sm text-[var(--ink)] outline-none placeholder:text-[var(--muted-text)]"
        />
        <kbd className="shrink-0 rounded border border-[var(--hairline)] bg-[var(--sidebar)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--muted-text)]">
          Esc
        </kbd>
      </div>

      <Command.List className="max-h-[min(60vh,420px)] overflow-y-auto p-2">
        <Command.Empty className="px-3 py-8 text-center text-xs text-[var(--muted-text)]">
          No matching commands.
        </Command.Empty>

        {items.length > 0 && (
          <Command.Group
            heading={`Snippets · ${scope}`}
            className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-[var(--muted-text)]"
          >
            {items.slice(0, 12).map((item) => (
              <Command.Item
                key={item.id}
                value={`snippet ${item.title} ${item.tags.join(' ')} ${item.filePaths.join(' ')} ${item.description ?? ''}`}
                onSelect={() => go(`/snippets/${encodeURIComponent(item.id)}`)}
                className={itemClass}
              >
                <FileCode2 className="h-3.5 w-3.5 shrink-0 text-[var(--action-bright)]" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{item.title}</span>
                <span className="shrink-0 font-mono text-[10px] text-[var(--muted-text)]">
                  {item.fileCount} files
                </span>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        <Command.Group
          heading="Quick actions"
          className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-[var(--muted-text)]"
        >
          <Command.Item value="create new snippet" onSelect={() => go('/snippets/new')} className={itemClass}>
            <Plus className="h-3.5 w-3.5 shrink-0 text-[var(--action-bright)]" aria-hidden="true" />
            <span className="flex-1">Create new snippet</span>
            <span className="font-mono text-[10px] text-[var(--muted-text)]">New</span>
          </Command.Item>
          {snippet?.canEmbed && (
            <Command.Item value="copy embed link" onSelect={() => run(copyEmbedLink)} className={itemClass}>
              <Link2 className="h-3.5 w-3.5 shrink-0 text-[var(--action-bright)]" aria-hidden="true" />
              <span className="flex-1">Copy current embed link</span>
            </Command.Item>
          )}
          {snippet && (
            <Command.Item value="toggle edit highlighted view" onSelect={() => run(toggleView)} className={itemClass}>
              <Code2 className="h-3.5 w-3.5 shrink-0 text-[var(--action-bright)]" aria-hidden="true" />
              <span className="flex-1">
                {location.pathname.endsWith('/edit') ? 'Switch to highlighted view' : 'Switch to edit view'}
              </span>
            </Command.Item>
          )}
          {snippet && (
            <Command.Item value="toggle snipbase ai explanation" onSelect={() => run(toggleExplanation)} className={itemClass}>
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-[var(--action-bright)]" aria-hidden="true" />
              <span className="flex-1">
                {currentSearch.get('ai') === '1' ? 'Hide Snipbase AI explanation' : 'Show Snipbase AI explanation'}
              </span>
            </Command.Item>
          )}
          <Command.Item value="open embed sandbox" onSelect={() => run(openSandbox)} className={itemClass}>
            <PanelTop className="h-3.5 w-3.5 shrink-0 text-[var(--action-bright)]" aria-hidden="true" />
            <span className="flex-1">Open Embed Sandbox</span>
          </Command.Item>
        </Command.Group>

        {tags.length > 0 && (
          <Command.Group
            heading="Filter by tag"
            className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-[var(--muted-text)]"
          >
            {tags.slice(0, 8).map((tag) => (
              <Command.Item
                key={tag.tag}
                value={`tag ${tag.tag} discover`}
                onSelect={() => filterByTag(tag.tag)}
                className={itemClass}
              >
                <Hash className="h-3.5 w-3.5 shrink-0 text-[var(--action-bright)]" aria-hidden="true" />
                <span className="flex-1">#{tag.tag}</span>
                <span className="font-mono text-[10px] text-[var(--muted-text)]">{tag.count}</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        <Command.Group
          heading="Switch account"
          className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-[var(--muted-text)]"
        >
          {accounts.map((account) => (
            <Command.Item
              key={account.id}
              value={`account switch ${account.name} ${account.email} ${account.handle}`}
              onSelect={() => switchAccount(account.id)}
              className={itemClass}
            >
              <UserRound className="h-3.5 w-3.5 shrink-0 text-[var(--action-bright)]" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{account.label}</span>
              {account.id === viewer.id && (
                <span className="font-mono text-[10px] text-[var(--action-bright)]">current</span>
              )}
            </Command.Item>
          ))}
          <Command.Item value="sign in login page" onSelect={() => go('/login')} className={itemClass}>
            <LogIn className="h-3.5 w-3.5 shrink-0 text-[var(--action-bright)]" aria-hidden="true" />
            <span className="flex-1">Open sign in page</span>
            <ArrowRight className="h-3 w-3 text-[var(--muted-text)]" aria-hidden="true" />
          </Command.Item>
          {viewer.role === 'user' && (
            <Command.Item
              value="sign out"
              onSelect={() =>
                run(() => {
                  signOut();
                  navigate('/');
                })
              }
              className={itemClass}
            >
              <LogIn className="h-3.5 w-3.5 shrink-0 rotate-180 text-[var(--action-bright)]" aria-hidden="true" />
              <span className="flex-1">Sign out</span>
            </Command.Item>
          )}
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
