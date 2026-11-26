import {
  AlertCircle,
  Check,
  ChevronDown,
  Code2,
  Copy,
  ExternalLink,
  Eye,
  GitFork,
  Link2,
  Lock,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import * as React from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/src/components/ui/alert-dialog';
import { Button } from '@/src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/src/components/ui/dialog';
import {
  isSnippetAdapterError,
  type FieldIssue,
  type Snippet,
  type SnippetDraft,
  type LinkExpiry,
  type Visibility,
} from '@/src/data/snippets/domain';
import {
  detectLanguageFromPath,
  normalizeTag,
  validateSnippetDraft,
} from '@/src/data/snippets/validation';
import { useSnippetsContext } from '@/src/features/snippets/context';
import { GrantAccess } from '@/src/features/snippets/GrantAccess';
import { apiOrigin } from '@/src/data/snippets/live/liveAdapter';
import { ExplanationPanel } from '@/src/features/snippets/explanation/ExplanationPanel';
import {
  useCreateSnippet,
  useDeleteSnippet,
  useForkSnippet,
  useToggleStar,
  useUpdateSnippet,
} from '@/src/features/snippets/queries';
import { EmbedDialog } from '@/src/features/snippets/reader/EmbedDialog';
import { ShikiDiffViewer } from '@/src/features/snippets/reader/ShikiDiffViewer';
import { ForkGraphHistory } from '@/src/features/snippets/workbench/ForkGraphHistory';
import {
  INSTANT_TRANSITION,
  SPRING_SEGMENT,
  SPRING_TAB,
  TRANSITION_FAST,
} from '@/src/lib/motion';
import { computeFilesDiff } from '@/src/lib/diff';
import { highlightCodeSafely, type HighlightResult } from '@/src/lib/shiki';
import { cn, copyTextToClipboard, formatRelativeTime } from '@/src/lib/utils';
import type { MonacoDraftFile } from '@/src/features/snippets/composer/MonacoCodeEditor';

const LazyMonacoCodeEditor = React.lazy(
  () => import('@/src/features/snippets/composer/MonacoCodeEditor'),
);

class EditorErrorBoundary extends React.Component<
  { onError: () => void; children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { onError: () => void; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(): void {
    this.props.onError();
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

interface DraftFileState extends MonacoDraftFile {
  id: string;
}

interface SnippetWorkbenchProps {
  mode: 'create' | 'detail';
  snippet?: Snippet;
  initialView?: 'edit' | 'highlighted';
}

function makeFileId(): string {
  return `f-${Math.random().toString(36).slice(2, 10)}`;
}

function buildInitialFiles(snippet?: Snippet): DraftFileState[] {
  if (snippet && snippet.files.length > 0) {
    return snippet.files.map((file) => ({
      id: makeFileId(),
      path: file.path,
      language: file.language || detectLanguageFromPath(file.path),
      text: file.text,
    }));
  }
  return [{ id: makeFileId(), path: 'file.txt', language: 'plaintext', text: '' }];
}

const VISIBILITY_OPTIONS: ReadonlyArray<{
  value: Visibility;
  label: string;
  summary: string;
}> = [
  {
    value: 'public',
    label: 'Public — Listed in Discover & embeddable',
    summary: 'Visible in Discover, searchable by tag, and embeddable.',
  },
  {
    value: 'unlisted',
    label: 'Unlisted — Anyone with the link',
    summary: 'Hidden from Discover; accessible by link and embeddable.',
  },
  {
    value: 'private',
    label: 'Private — Owner only',
    summary: 'Only you can view or edit; anonymous embeds are blocked.',
  },
];

function EmbeddedShikiSurface({
  path,
  language,
  code,
}: {
  path: string;
  language?: string;
  code: string;
}) {
  const [highlight, setHighlight] = React.useState<HighlightResult>(() => ({
    highlighted: false,
    languageLabel: language && language !== 'text' ? language : 'Plain text',
    lines: code.split(/\r?\n/).map((line) => [{ content: line }]),
  }));

  React.useEffect(() => {
    let cancelled = false;
    setHighlight({
      highlighted: false,
      languageLabel: language && language !== 'text' ? language : 'Plain text',
      lines: code.split(/\r?\n/).map((line) => [{ content: line }]),
    });
    highlightCodeSafely(code, language).then((res) => {
      if (!cancelled) setHighlight(res);
    });
    return () => {
      cancelled = true;
    };
  }, [code, language, path]);

  return (
    <div className="max-h-[540px] min-h-[380px] overflow-auto bg-[var(--code-surface)]">
      <div className="flex min-w-full font-mono text-[13px] leading-[1.6]">
        <div
          aria-hidden="true"
          className="select-none border-r border-[var(--hairline)]/80 bg-[var(--code-surface)] px-3.5 py-4 text-right text-xs leading-[1.6] text-[var(--code-muted)] tabular-nums shrink-0"
        >
          {highlight.lines.map((_, idx) => (
            <div key={idx} className="h-[20.8px]">
              {idx + 1}
            </div>
          ))}
        </div>

        <pre
          tabIndex={0}
          aria-label={`Highlighted source code for ${path}`}
          className="m-0 flex-1 px-4 py-4 font-mono text-[13px] leading-[1.6] text-[var(--code-ink)] focus:outline-none"
        >
          <code>
            {code.length === 0 ? (
              <span className="italic text-[var(--muted-text)]">(Empty file)</span>
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
  );
}

export function SnippetWorkbench({
  mode,
  snippet,
  initialView,
}: SnippetWorkbenchProps) {
  const { viewer, announce } = useSnippetsContext();
  const prefersReducedMotion = useReducedMotion();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const createMutation = useCreateSnippet();
  const updateMutation = useUpdateSnippet(snippet?.id ?? '');
  const deleteMutation = useDeleteSnippet();
  const forkMutation = useForkSnippet();
  const starMutation = useToggleStar();

  const canEdit = mode === 'create' ? viewer.role === 'user' : Boolean(snippet?.canEdit);
  const canDelete = mode === 'detail' && Boolean(snippet?.canDelete);

  const [title, setTitle] = React.useState(snippet?.title ?? '');
  const [description, setDescription] = React.useState(snippet?.description ?? '');
  const [visibility, setVisibility] = React.useState<Visibility>(snippet?.visibility ?? 'private');
  const [linkExpiry, setLinkExpiry] = React.useState<LinkExpiry>('forever');
  const [tags, setTags] = React.useState<string[]>(() =>
    snippet ? [...snippet.tags] : [],
  );
  const [tagDraft, setTagDraft] = React.useState('');
  const [files, setFiles] = React.useState<DraftFileState[]>(() => buildInitialFiles(snippet));
  const [activeFileId, setActiveFileId] = React.useState<string>('');

  const [viewMode, setViewMode] = React.useState<'edit' | 'highlighted'>(() => {
    if (mode === 'create') return 'edit';
    if (initialView) return initialView;
    return snippet?.canEdit ? 'edit' : 'highlighted';
  });

  const [usePlainTextarea, setUsePlainTextarea] = React.useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 640 : false,
  );
  const [monacoFailed, setMonacoFailed] = React.useState(false);

  const [explainOpen, setExplainOpen] = React.useState(
    () => mode === 'detail' && searchParams.get('ai') === '1',
  );
  const [diffOpen, setDiffOpen] = React.useState(false);
  const [lineageOpen, setLineageOpen] = React.useState(false);
  const [propertiesOpen, setPropertiesOpen] = React.useState(mode === 'create');
  const [moreOpen, setMoreOpen] = React.useState(false);
  const [embedOpen, setEmbedOpen] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [discardDialogOpen, setDiscardDialogOpen] = React.useState(false);
  const [pendingRemoveFileId, setPendingRemoveFileId] = React.useState<string | null>(null);

  const [fieldIssues, setFieldIssues] = React.useState<readonly FieldIssue[]>([]);
  const [feedback, setFeedback] = React.useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);
  const [copiedCode, setCopiedCode] = React.useState(false);
  const [copiedAccessLink, setCopiedAccessLink] = React.useState(false);
  const [isDirty, setIsDirty] = React.useState(false);

  const pathInputRef = React.useRef<HTMLInputElement>(null);
  const aiParam = searchParams.get('ai');

  React.useEffect(() => {
    if (mode !== 'detail') return;
    if (aiParam === '1') {
      setExplainOpen(true);
      setDiffOpen(false);
      setLineageOpen(false);
    } else if (aiParam === null) {
      setExplainOpen(false);
    }
  }, [aiParam, mode]);

  const showPanel = (panel: 'explain' | 'diff' | 'lineage') => {
    setExplainOpen(panel === 'explain');
    setDiffOpen(panel === 'diff');
    setLineageOpen(panel === 'lineage');
    setMoreOpen(false);
  };

  const comparison = React.useMemo(() => {
    if (!snippet?.forkOriginFiles) return null;
    const currentFiles = files.map((file) => ({
      path: file.path,
      language: file.language,
      text: file.text,
    }));
    return computeFilesDiff(snippet.forkOriginFiles, currentFiles);
  }, [files, snippet]);

  const hasLineage = Boolean(
    snippet &&
      (snippet.forkedFrom ||
        snippet.publicForks.length > 0 ||
        snippet.forkGraph.length > 1 ||
        snippet.history.length > 1),
  );

  // Re-initialize form state whenever snippet identity or updatedAt changes
  const snippetIdentityKey = mode === 'create' ? 'new' : `${snippet?.id}:${snippet?.updatedAt}`;
  React.useEffect(() => {
    const nextFiles = buildInitialFiles(snippet);
    setTitle(snippet?.title ?? '');
    setDescription(snippet?.description ?? '');
    setVisibility(snippet?.visibility ?? 'private');
    setLinkExpiry('forever');
    setTags(snippet ? [...snippet.tags] : []);
    setTagDraft('');
    setFiles(nextFiles);

    const requestedPath = searchParams.get('file');
    const matched = requestedPath ? nextFiles.find((f) => f.path === requestedPath) : null;
    setActiveFileId(matched ? matched.id : nextFiles[0]?.id ?? '');

    setViewMode(
      mode === 'create'
        ? 'edit'
        : initialView ?? (snippet?.canEdit ? 'edit' : 'highlighted'),
    );
    setExplainOpen(false);
    setFieldIssues([]);
    setFeedback(null);
    setIsDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snippetIdentityKey, mode, snippet?.canEdit]);

  // Keep activeFileId valid
  const activeFile = React.useMemo(
    () => files.find((f) => f.id === activeFileId) ?? files[0],
    [files, activeFileId],
  );
  const activeFileIndex = files.findIndex((f) => f.id === activeFile?.id);

  // Guard against accidental page unload while dirty (F09)
  React.useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const showToast = React.useCallback((tone: 'success' | 'error', message: string) => {
    setFeedback({ tone, message });
    announce(message);
  }, [announce]);

  const addTagFromDraft = (raw: string) => {
    const pieces = raw
      .split(/[,\s]+/)
      .map((p) => normalizeTag(p))
      .filter(Boolean);
    if (pieces.length === 0) return;
    setTags((prev) => {
      const next = [...prev];
      for (const piece of pieces) {
        if (!next.includes(piece) && next.length < 10) {
          next.push(piece);
        }
      }
      return next;
    });
    setTagDraft('');
    setIsDirty(true);
  };

  const removeTag = (tagToRemove: string) => {
    setTags((prev) => prev.filter((t) => t !== tagToRemove));
    setIsDirty(true);
  };

  const handleAddFile = () => {
    const existingNames = new Set(files.map((f) => f.path.toLowerCase()));
    let num = files.length + 1;
    let candidate = `file-${num}.txt`;
    while (existingNames.has(candidate)) {
      num += 1;
      candidate = `file-${num}.txt`;
    }
    const created: DraftFileState = {
      id: makeFileId(),
      path: candidate,
      language: detectLanguageFromPath(candidate),
      text: '',
    };
    setFiles((prev) => [...prev, created]);
    setActiveFileId(created.id);
    setViewMode('edit');
    setIsDirty(true);
    window.requestAnimationFrame(() => {
      pathInputRef.current?.focus();
      pathInputRef.current?.select();
    });
  };

  const executeRemoveFile = (fileId: string) => {
    setFiles((prev) => {
      if (prev.length <= 1) return prev;
      const idx = prev.findIndex((f) => f.id === fileId);
      const next = prev.filter((f) => f.id !== fileId);
      if (activeFile?.id === fileId) {
        const fallback = next[Math.max(0, idx - 1)] ?? next[0];
        if (fallback) setActiveFileId(fallback.id);
      }
      return next;
    });
    setPendingRemoveFileId(null);
    setIsDirty(true);
    setFieldIssues([]);
  };

  const requestRemoveFile = (fileId: string) => {
    if (files.length <= 1) return;
    const target = files.find((f) => f.id === fileId);
    if (!target) return;
    if (target.text.trim().length > 0) {
      setPendingRemoveFileId(fileId);
    } else {
      executeRemoveFile(fileId);
    }
  };

  const updateFilePath = (fileId: string, nextPath: string) => {
    setFiles((prev) =>
      prev.map((file) =>
        file.id === fileId
          ? { ...file, path: nextPath, language: detectLanguageFromPath(nextPath) }
          : file,
      ),
    );
    setIsDirty(true);
  };

  const updateFileText = React.useCallback((fileId: string, nextText: string) => {
    setFiles((prev) =>
      prev.map((file) => (file.id === fileId ? { ...file, text: nextText } : file)),
    );
    setIsDirty(true);
  }, []);

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const handleSave = async () => {
    if (isSaving) return;
    setFeedback(null);

    // Commit any pending tag text typed in the inline input
    let finalTags = [...tags];
    if (tagDraft.trim()) {
      for (const piece of tagDraft.split(/[,\s]+/)) {
        const clean = normalizeTag(piece);
        if (clean && !finalTags.includes(clean) && finalTags.length < 10) {
          finalTags.push(clean);
        }
      }
      setTags(finalTags);
      setTagDraft('');
    }

    const draft: SnippetDraft = {
      title,
      description,
      visibility,
      linkExpiry,
      tags: finalTags,
      files: files.map((f) => ({
        path: f.path,
        language: f.language,
        text: f.text,
      })),
    };

    const validation = validateSnippetDraft(draft);
    if (!validation.ok || !validation.normalizedDraft) {
      setFieldIssues(validation.issues);
      const firstFileIssue = validation.issues.find((i) => i.fileIndex !== undefined);
      if (firstFileIssue && firstFileIssue.fileIndex !== undefined && files[firstFileIssue.fileIndex]) {
        setActiveFileId(files[firstFileIssue.fileIndex].id);
        setViewMode('edit');
      }
      showToast('error', validation.issues[0]?.message ?? 'Fix validation issues before saving.');
      return;
    }

    setFieldIssues([]);

    try {
      if (mode === 'create') {
        const receipt = await createMutation.mutateAsync(validation.normalizedDraft);
        setIsDirty(false);
        announce(`Created snippet "${validation.normalizedDraft.title}".`);
        const nextParams = new URLSearchParams(searchParams);
        if (!nextParams.get('scope')) nextParams.set('scope', 'mine');
        navigate(`/snippets/${encodeURIComponent(receipt.id)}?${nextParams.toString()}`, {
          replace: true,
        });
      } else if (snippet) {
        await updateMutation.mutateAsync(validation.normalizedDraft);
        setIsDirty(false);
        showToast('success', 'Changes saved.');
      }
    } catch (err) {
      const msg = isSnippetAdapterError(err)
        ? err.failure.message ?? 'Could not save snippet.'
        : 'Could not save snippet.';
      if (isSnippetAdapterError(err) && err.failure.fieldIssues) {
        setFieldIssues(err.failure.fieldIssues);
      }
      showToast('error', msg);
    }
  };

  const handleSaveRef = React.useRef(handleSave);
  handleSaveRef.current = handleSave;

  // IDE keyboard shortcut: Cmd/Ctrl + S saves the active snippet
  React.useEffect(() => {
    if (!canEdit) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void handleSaveRef.current();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canEdit]);

  const handleDiscardChanges = () => {
    const restored = buildInitialFiles(snippet);
    setTitle(snippet?.title ?? '');
    setDescription(snippet?.description ?? '');
    setVisibility(snippet?.visibility ?? 'public');
    setTags(snippet ? [...snippet.tags] : []);
    setTagDraft('');
    setFiles(restored);
    setActiveFileId(restored[0]?.id ?? '');
    setFieldIssues([]);
    setIsDirty(false);
    setDiscardDialogOpen(false);
    showToast('success', 'Unsaved changes discarded.');
  };

  const releaseEditorFocus = () => {
    (document.activeElement as HTMLElement | null)?.blur();
  };

  const handleCopyAccessLink = async () => {
    if (!snippet) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const link = snippet.canEmbed
      ? new URL(`${apiOrigin}/embed/${encodeURIComponent(snippet.id)}`, origin).href
      : `${origin}/snippets/${encodeURIComponent(snippet.id)}`;
    const ok = await copyTextToClipboard(link);
    if (ok) {
      setCopiedAccessLink(true);
      showToast(
        'success',
        snippet.canEmbed ? 'Access & embed link copied.' : 'Access link copied.',
      );
      window.setTimeout(() => setCopiedAccessLink(false), 2000);
    } else {
      showToast('error', 'Clipboard access was blocked by the browser.');
    }
  };

  const handleCopyActiveCode = async () => {
    if (!activeFile) return;
    const ok = await copyTextToClipboard(activeFile.text);
    if (ok) {
      setCopiedCode(true);
      announce(`Copied ${activeFile.path} to clipboard.`);
      window.setTimeout(() => setCopiedCode(false), 1800);
    }
  };

  const handleFork = async () => {
    if (!snippet) return;
    if (viewer.role === 'guest') {
      navigate('/login?next=' + encodeURIComponent(window.location.pathname + window.location.search));
      return;
    }
    try {
      const receipt = await forkMutation.mutateAsync(snippet.id);
      announce(`Forked "${snippet.title}" into your workspace.`);
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set('scope', 'mine');
      navigate(`/snippets/${encodeURIComponent(receipt.id)}?${nextParams.toString()}`);
    } catch (err) {
      const msg = isSnippetAdapterError(err)
        ? err.failure.message ?? 'Could not fork snippet.'
        : 'Could not fork snippet.';
      showToast('error', msg);
    }
  };

  const handleDelete = async () => {
    if (!snippet) return;
    try {
      await deleteMutation.mutateAsync(snippet.id);
      setDeleteDialogOpen(false);
      setIsDirty(false);
      announce(`Deleted "${snippet.title}".`);
      const nextParams = new URLSearchParams(searchParams);
      navigate(`/?${nextParams.toString()}`, { replace: true });
    } catch (err) {
      setDeleteDialogOpen(false);
      const msg = isSnippetAdapterError(err)
        ? err.failure.message ?? 'Could not delete snippet.'
        : 'Could not delete snippet.';
      showToast('error', msg);
    }
  };

  const handleToggleStar = () => {
    if (!snippet) return;
    if (viewer.role === 'guest') {
      navigate('/login?next=' + encodeURIComponent(window.location.pathname + window.location.search));
      return;
    }
    starMutation.mutate(snippet.id, { onError: (error) => showToast('error', error.message) });
  };

  const handleSelectTagInReadMode = (tag: string) => {
    const nextParams = new URLSearchParams();
    nextParams.set('scope', 'discover');
    nextParams.set('tag', tag);
    navigate(`/snippets/${encodeURIComponent(snippet?.id ?? '')}?${nextParams.toString()}`);
  };

  const titleIssue = fieldIssues.find((i) => i.field === 'title');
  const activeFileIssue = fieldIssues.find(
    (i) => i.field === 'files' && i.fileIndex === activeFileIndex,
  );

  const activeLineCount = activeFile ? activeFile.text.split(/\r?\n/).length : 0;
  const activeCharCount = activeFile ? activeFile.text.length : 0;
  const rawUrl =
    mode === 'detail' && snippet && activeFile
      ? `/raw/${encodeURIComponent(snippet.id)}?file=${encodeURIComponent(activeFile.path)}`
      : undefined;

  const pendingRemoveFile = pendingRemoveFileId
    ? files.find((f) => f.id === pendingRemoveFileId)
    : null;

  return (
    <div className="mx-auto w-full max-w-[1080px] px-4 py-6 sm:px-8 sm:py-8">
      {/* Guest creation guard when landing directly on /snippets/new while signed out */}
      {mode === 'create' && viewer.role === 'guest' ? (
        <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--paper)] p-6">
          <div className="flex items-start gap-3">
            <Lock className="mt-0.5 h-5 w-5 shrink-0 text-[var(--action-bright)]" aria-hidden="true" />
            <div>
              <h1 className="text-lg font-semibold text-[var(--ink)]">
                Sign in to create snippets
              </h1>
              <p className="mt-1 text-sm text-[var(--secondary-text)]">
                You are currently browsing as Guest. Sign in with your email
                account to publish multi-file snippets.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild variant="primary" size="sm">
                  <Link to="/login">Sign in with email</Link>
                </Button>
                <Button asChild variant="secondary" size="sm">
                  <Link to="/">Back to workspace</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <motion.div
          key={mode === 'create' ? 'create-workbench' : snippet?.id ?? 'detail-workbench'}
          initial={prefersReducedMotion ? false : { opacity: 0.72, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={prefersReducedMotion ? INSTANT_TRANSITION : TRANSITION_FAST}
          className="space-y-5"
        >
          {/* Top Document Title & IDE Action Toolbar */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em]">
                <span
                  className={cn(
                    canEdit ? 'text-[var(--success-ink)]' : 'text-[var(--action-bright)]',
                  )}
                >
                  {mode === 'create'
                    ? 'New snippet'
                    : canEdit
                      ? viewMode === 'edit'
                        ? 'Editing'
                        : 'Highlighted preview'
                      : 'Read-only'}
                </span>
                {mode === 'detail' && snippet && (
                  <>
                    <span aria-hidden="true" className="text-[var(--muted-text)]">
                      ·
                    </span>
                    <span className="normal-case font-normal tracking-normal text-[var(--muted-text)]">
                      Updated {formatRelativeTime(snippet.updatedAt)}
                    </span>
                  </>
                )}
              </div>

              {canEdit ? (
                <div className="mt-1.5">
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      setIsDirty(true);
                    }}
                    placeholder="Untitled multi-file snippet"
                    aria-label="Snippet title"
                    aria-invalid={Boolean(titleIssue)}
                    className={cn(
                      'w-full bg-transparent text-2xl sm:text-[26px] font-bold tracking-tight text-[var(--ink)] placeholder:text-[var(--muted-text)] focus:outline-none border-b border-transparent pb-0.5 transition-colors',
                      titleIssue
                        ? 'border-[var(--error-ink)]'
                        : 'focus:border-[var(--action)]',
                    )}
                  />
                  {titleIssue && (
                    <p role="alert" className="mt-1 text-xs text-[var(--error-ink)]">
                      {titleIssue.message}
                    </p>
                  )}
                </div>
              ) : (
                <h1 className="mt-1.5 text-2xl sm:text-[26px] font-bold tracking-tight text-[var(--ink)]">
                  {snippet?.title}
                </h1>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              {mode === 'detail' && snippet && (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={handleToggleStar}
                    disabled={starMutation.isPending}
                    aria-pressed={snippet.viewerHasStarred}
                    aria-label={`${snippet.viewerHasStarred ? 'Remove star from' : 'Star'} snippet, ${snippet.starCount} stars`}
                    className="h-9 w-9 rounded-full text-xs tabular-nums"
                  >
                    <motion.span
                      key={snippet.viewerHasStarred ? 'starred' : 'unstarred'}
                      initial={prefersReducedMotion ? false : { scale: 0.72 }}
                      animate={{ scale: [0.72, 1.12, 1] }}
                      transition={prefersReducedMotion ? INSTANT_TRANSITION : { duration: 0.2 }}
                      className="inline-flex"
                    >
                      <Star
                        className={cn(
                          'h-4 w-4',
                          snippet.viewerHasStarred &&
                            'fill-[var(--action)] text-[var(--action)]',
                        )}
                        aria-hidden="true"
                      />
                    </motion.span>
                  </Button>

                  {(!canEdit || snippet.canFork) && (
                    <Button
                      type="button"
                      variant={canEdit ? 'ghost' : 'primary'}
                      size="sm"
                      onClick={handleFork}
                      disabled={forkMutation.isPending}
                      className="h-9 rounded-full px-3 text-xs"
                    >
                      <GitFork className="h-3.5 w-3.5" aria-hidden="true" />
                      {forkMutation.isPending
                        ? 'Forking…'
                        : viewer.role === 'guest'
                          ? 'Sign in to fork'
                          : 'Fork'}
                    </Button>
                  )}
                </>
              )}

              {canEdit && (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={isSaving}
                  onClick={handleSave}
                  title="Save changes (Ctrl/Cmd+S)"
                  className="h-9 rounded-full px-4 text-xs"
                >
                  <Save className="h-3.5 w-3.5" aria-hidden="true" />
                  {isSaving ? 'Saving…' : mode === 'create' ? 'Create snippet' : 'Save'}
                </Button>
              )}

              {mode === 'detail' && snippet && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setMoreOpen(true)}
                  aria-label="More snippet actions"
                  className="h-9 w-9 rounded-full"
                >
                  <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                </Button>
              )}
            </div>
          </div>

          <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
            <DialogContent className="max-w-sm p-5">
              <DialogTitle>Quick actions</DialogTitle>
              <DialogDescription>
                Everything you need for this snippet, without the toolbar noise.
              </DialogDescription>
              <div className="mt-4 grid gap-1">
                <button
                  type="button"
                  onClick={() => {
                    handleCopyAccessLink();
                    setMoreOpen(false);
                  }}
                  className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-xs text-[var(--ink)] hover:bg-[var(--paper-hover)]"
                >
                  <Link2 className="h-4 w-4 text-[var(--secondary-text)]" aria-hidden="true" />
                  {copiedAccessLink ? 'Link copied' : 'Copy access link'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmbedOpen(true);
                    setMoreOpen(false);
                  }}
                  className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-xs text-[var(--ink)] hover:bg-[var(--paper-hover)]"
                >
                  <Code2 className="h-4 w-4 text-[var(--secondary-text)]" aria-hidden="true" />
                  Get embed code
                </button>
                <button
                  type="button"
                  onClick={() => showPanel('explain')}
                  className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-xs text-[var(--ink)] hover:bg-[var(--paper-hover)]"
                >
                  <Sparkles className="h-4 w-4 text-[var(--secondary-text)]" aria-hidden="true" />
                  Explain this snippet
                </button>
                {hasLineage && (
                  <button
                    type="button"
                    onClick={() => showPanel('lineage')}
                    className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-xs text-[var(--ink)] hover:bg-[var(--paper-hover)]"
                  >
                    <GitFork className="h-4 w-4 text-[var(--secondary-text)]" aria-hidden="true" />
                    Fork graph & history
                  </button>
                )}
                {snippet?.forkOriginFiles && (
                  <button
                    type="button"
                    onClick={() => showPanel('diff')}
                    className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-xs text-[var(--ink)] hover:bg-[var(--paper-hover)]"
                  >
                    <Eye className="h-4 w-4 text-[var(--secondary-text)]" aria-hidden="true" />
                    Compare with parent
                  </button>
                )}
                {canEdit && isDirty && (
                  <button
                    type="button"
                    onClick={() => {
                      setDiscardDialogOpen(true);
                      setMoreOpen(false);
                    }}
                    className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-xs text-[var(--ink)] hover:bg-[var(--paper-hover)]"
                  >
                    <RotateCcw className="h-4 w-4 text-[var(--secondary-text)]" aria-hidden="true" />
                    Discard changes
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteDialogOpen(true);
                      setMoreOpen(false);
                    }}
                    className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-xs text-[var(--error-ink)] hover:bg-[var(--error-surface)]"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Delete snippet
                  </button>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {mode === 'detail' && snippet && (
            <button
              type="button"
              onClick={() => setPropertiesOpen((open) => !open)}
              aria-expanded={propertiesOpen}
              className="inline-flex items-center gap-1.5 rounded-full px-1 py-1 text-xs text-[var(--secondary-text)] hover:text-[var(--ink)]"
            >
              Details
              <ChevronDown
                className={cn(
                  'h-3.5 w-3.5 transition-transform',
                  propertiesOpen && 'rotate-180',
                )}
                aria-hidden="true"
              />
            </button>
          )}

          {propertiesOpen && snippet?.canEdit && snippet.visibility === 'private' && <GrantAccess snippetId={snippet.id} />}
          {propertiesOpen && (
          <section
            aria-label="Snippet properties"
            className="rounded-[10px] border border-[var(--hairline)] bg-[var(--sidebar)]/60 divide-y divide-[var(--hairline)]/80 text-xs"
          >
            {/* Access Row */}
            <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] items-center gap-1.5 sm:gap-4 px-3.5 py-2.5">
              <span className="text-[var(--muted-text)] font-medium">Access</span>
              <div className="flex flex-wrap items-center justify-between gap-2">
                {canEdit ? (
                  <div className="flex items-center gap-2 text-[var(--success-ink)]">
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span className="font-medium">Owner access</span>
                    <span className="text-[var(--secondary-text)]">
                      — Edit files, control visibility, and save changes.
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2 text-[var(--secondary-text)]">
                    <Eye className="h-3.5 w-3.5 shrink-0 text-[var(--action-bright)]" aria-hidden="true" />
                    <span>
                      Read-only · Owned by{' '}
                      <strong className="font-medium text-[var(--ink)]">
                        {snippet?.ownerName}
                      </strong>{' '}
                      ({snippet?.ownerHandle})
                    </span>
                    <button
                      type="button"
                      onClick={handleFork}
                      className="text-[var(--action-bright)] hover:underline font-medium cursor-pointer"
                    >
                      Fork to edit
                    </button>
                  </div>
                )}

                {mode === 'detail' && snippet && (
                  <span className="font-mono text-[11px] text-[var(--muted-text)] capitalize">
                    {visibility}
                  </span>
                )}
              </div>
            </div>

            {/* Visibility Row */}
            <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] items-center gap-1.5 sm:gap-4 px-3.5 py-2.5">
              <label htmlFor="workbench-visibility" className="text-[var(--muted-text)] font-medium">
                Visibility
              </label>
              <div>
                {canEdit ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <select
                      id="workbench-visibility"
                      value={visibility}
                      onChange={(e) => {
                        setVisibility(e.target.value as Visibility);
                        setIsDirty(true);
                      }}
                      className="h-7 rounded-[6px] border border-[var(--control-border)] bg-[var(--code-surface)] px-2.5 text-xs text-[var(--code-ink)] focus-visible:border-[var(--action)] focus-visible:outline-none cursor-pointer"
                    >
                      {VISIBILITY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <span className="text-[11.5px] text-[var(--muted-text)]">
                      {VISIBILITY_OPTIONS.find((o) => o.value === visibility)?.summary}
                    </span>
                    {visibility !== 'public' && (
                      <select
                        aria-label="Link expiry"
                        value={linkExpiry}
                        onChange={(e) => { setLinkExpiry(e.target.value as LinkExpiry); setIsDirty(true); }}
                        className="h-7 rounded-[6px] border border-[var(--control-border)] bg-[var(--code-surface)] px-2.5 text-xs text-[var(--code-ink)]"
                      >
                        <option value="1h">Link expires in 1 hour</option>
                        <option value="1d">Link expires in 1 day</option>
                        <option value="7d">Link expires in 7 days</option>
                        <option value="forever">Never expires</option>
                      </select>
                    )}
                  </div>
                ) : (
                  <span className="text-[var(--ink)] capitalize">
                    {snippet?.visibility}{' '}
                    <span className="text-[var(--muted-text)] normal-case">
                      — {VISIBILITY_OPTIONS.find((o) => o.value === snippet?.visibility)?.summary}
                    </span>
                  </span>
                )}
              </div>
            </div>

            {/* Tags Row */}
            <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] items-center gap-1.5 sm:gap-4 px-3.5 py-2.5">
              <label htmlFor="workbench-tags-input" className="text-[var(--muted-text)] font-medium">
                Tags
              </label>
              <div className="flex flex-wrap items-center gap-1.5">
                <AnimatePresence initial={false}>
                  {tags.map((tag) =>
                    canEdit ? (
                      <motion.span
                        key={tag}
                        initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.88 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
                        transition={prefersReducedMotion ? INSTANT_TRANSITION : TRANSITION_FAST}
                        className="inline-flex items-center gap-1 rounded-[5px] border border-[var(--hairline)] bg-[var(--code-surface)] px-2 py-0.5 font-mono text-[11px] text-[var(--action-bright)]"
                      >
                        #{tag}
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          aria-label={`Remove tag ${tag}`}
                          className="text-[var(--muted-text)] hover:text-[var(--ink)] cursor-pointer"
                        >
                          <X className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </motion.span>
                    ) : (
                      <motion.button
                        key={tag}
                        type="button"
                        initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={prefersReducedMotion ? INSTANT_TRANSITION : TRANSITION_FAST}
                        onClick={() => handleSelectTagInReadMode(tag)}
                        className="rounded-[5px] border border-[var(--hairline)] bg-[var(--code-surface)] px-2 py-0.5 font-mono text-[11px] text-[var(--action-bright)] hover:border-[var(--action)] cursor-pointer"
                      >
                        #{tag}
                      </motion.button>
                    ),
                  )}
                </AnimatePresence>

                {canEdit && (
                  <input
                    id="workbench-tags-input"
                    type="text"
                    value={tagDraft}
                    onChange={(e) => setTagDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        addTagFromDraft(tagDraft);
                      } else if (e.key === 'Backspace' && !tagDraft && tags.length > 0) {
                        removeTag(tags[tags.length - 1]);
                      }
                    }}
                    onBlur={() => {
                      if (tagDraft.trim()) addTagFromDraft(tagDraft);
                    }}
                    placeholder="Add tag (press Enter)…"
                    className="h-6 min-w-[140px] flex-1 bg-transparent font-mono text-[11.5px] text-[var(--ink)] placeholder:text-[var(--muted-text)] focus:outline-none"
                  />
                )}

                {!canEdit && tags.length === 0 && (
                  <span className="text-[var(--muted-text)]">No tags</span>
                )}
              </div>
            </div>

            {/* Optional Description / Summary Row */}
            {(canEdit || description) && (
              <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] items-center gap-1.5 sm:gap-4 px-3.5 py-2.5">
                <label htmlFor="workbench-summary" className="text-[var(--muted-text)] font-medium">
                  Summary
                </label>
                {canEdit ? (
                  <input
                    id="workbench-summary"
                    type="text"
                    value={description}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      setIsDirty(true);
                    }}
                    placeholder="Optional short note explaining what these files do…"
                    className="w-full bg-transparent text-xs text-[var(--ink)] placeholder:text-[var(--muted-text)] focus:outline-none"
                  />
                ) : (
                  <p className="text-xs text-[var(--secondary-text)]">{description}</p>
                )}
              </div>
            )}

            {/* Fork Lineage Row (only shown when relevant) */}
            {mode === 'detail' &&
              snippet &&
              (snippet.forkedFrom || snippet.publicForks.length > 0) && (
                <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] items-center gap-1.5 sm:gap-4 px-3.5 py-2.5">
                  <span className="text-[var(--muted-text)] font-medium">Lineage</span>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--secondary-text)]">
                    {snippet.forkedFrom && (
                      <span className="inline-flex items-center gap-1.5">
                        <GitFork className="h-3.5 w-3.5 text-[var(--action-bright)]" aria-hidden="true" />
                        Forked from{' '}
                        <Link
                          to={`/snippets/${encodeURIComponent(snippet.forkedFrom.id)}`}
                          className="font-medium text-[var(--action-bright)] hover:underline"
                        >
                          {snippet.forkedFrom.title}
                        </Link>{' '}
                        by {snippet.forkedFrom.ownerName}
                      </span>
                    )}
                    {snippet.publicForks.length > 0 && (
                      <span className="inline-flex flex-wrap items-center gap-1.5">
                        <span className="tabular-nums">
                          {snippet.publicForks.length}{' '}
                          {snippet.publicForks.length === 1 ? 'fork' : 'forks'}:
                        </span>
                        {snippet.publicForks.slice(0, 3).map((child) => (
                          <Link
                            key={child.id}
                            to={`/snippets/${encodeURIComponent(child.id)}`}
                            className="font-mono text-[11px] text-[var(--action-bright)] hover:underline"
                          >
                            {child.ownerName}
                          </Link>
                        ))}
                      </span>
                    )}
                  </div>
                </div>
              )}
          </section>
          )}

          {/* Inline Notion AI Explanation Panel */}
          {mode === 'detail' && snippet && (
            <ExplanationPanel
              snippetId={snippet.id}
              open={explainOpen}
              onClose={() => setExplainOpen(false)}
              onSelectFile={(path) => {
                const match = files.find((f) => f.path === path);
                if (match) setActiveFileId(match.id);
              }}
            />
          )}

          {mode === 'detail' && snippet?.forkOriginFiles && diffOpen && (
            <section
              aria-label="Fork comparison"
              className="rounded-[10px] border border-[var(--hairline)] bg-[var(--paper)]"
            >
              <div className="flex items-center justify-between gap-3 border-b border-[var(--hairline)] px-4 py-3">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-[var(--ink)]">Compare with parent</h2>
                  <p className="mt-0.5 text-xs text-[var(--muted-text)]">
                    {comparison?.changedFilesCount ?? 0} changed files · {comparison?.totalAdded ?? 0} added ·{' '}
                    {comparison?.totalRemoved ?? 0} removed
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDiffOpen(false)}
                  aria-label="Close fork comparison"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] text-[var(--secondary-text)] hover:bg-[var(--canvas)] hover:text-[var(--ink)] cursor-pointer"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <div className="space-y-3 p-3 sm:p-4">
                {comparison && comparison.files.some((file) => file.status !== 'unchanged') ? (
                  comparison.files
                    .filter((file) => file.status !== 'unchanged')
                    .map((file) => (
                      <ShikiDiffViewer
                        key={file.path}
                        path={file.path}
                        language={file.language}
                        originalText={file.originalText}
                        currentText={file.currentText}
                        status={file.status}
                        baseLabel="Parent"
                        currentLabel="This fork"
                        compact
                      />
                    ))
                ) : (
                  <p className="px-1 py-6 text-center text-xs text-[var(--muted-text)]">
                    No differences from the parent snapshot.
                  </p>
                )}
              </div>
            </section>
          )}

          {mode === 'detail' && snippet && hasLineage && lineageOpen && (
            <ForkGraphHistory
              snippet={snippet}
              onFork={handleFork}
              isForking={forkMutation.isPending}
              onOpenDiffView={
                snippet.forkOriginFiles
                  ? () => {
                      showPanel('diff');
                      announce('Showing fork comparison.');
                    }
                  : undefined
              }
            />
          )}

          {/* IDE Multi-File Tabbed Code Workbench */}
          <section
            aria-label="Multi-file code workbench"
            className="overflow-hidden rounded-[10px] border border-[var(--hairline)] bg-[var(--code-surface)]"
          >
            {/* IDE Tab Bar */}
            <div className="flex flex-wrap items-stretch justify-between gap-2 border-b border-[var(--hairline)] bg-[var(--code-surface-elevated)]">
              <div
                role="tablist"
                aria-label="Snippet files"
                className="flex min-w-0 flex-1 items-stretch overflow-x-auto"
              >
                {files.map((file, idx) => {
                  const isActive = file.id === activeFile?.id;
                  const hasIssue = fieldIssues.some(
                    (i) => i.field === 'files' && i.fileIndex === idx,
                  );
                  return (
                    <div
                      key={file.id}
                      className={cn(
                        'group relative flex items-center border-r border-[var(--hairline)]/80 transition-colors shrink-0',
                        isActive
                          ? 'bg-[var(--code-surface)] text-[var(--code-ink)]'
                          : 'bg-transparent text-[var(--secondary-text)] hover:bg-[var(--code-surface-elevated)] hover:text-[var(--ink)]',
                      )}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="ide-active-tab-bar"
                          transition={prefersReducedMotion ? INSTANT_TRANSITION : SPRING_TAB}
                          className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-[var(--action)]"
                        />
                      )}
                      <button
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => setActiveFileId(file.id)}
                        className="flex items-center gap-1.5 px-3 py-2 font-mono text-xs cursor-pointer whitespace-nowrap"
                      >
                        <span className={cn(hasIssue && 'text-[var(--error-ink)]')}>
                          {file.path.trim() || `untitled-${idx + 1}`}
                        </span>
                      </button>
                      {canEdit && viewMode === 'edit' && files.length > 1 && (
                        <button
                          type="button"
                          onClick={() => requestRemoveFile(file.id)}
                          aria-label={`Remove ${file.path}`}
                          className="mr-1.5 rounded p-0.5 text-[var(--muted-text)] opacity-60 hover:bg-[var(--code-surface-elevated)] hover:text-[var(--ink)] group-hover:opacity-100 cursor-pointer"
                        >
                          <X className="h-3 w-3" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  );
                })}

                {canEdit && viewMode === 'edit' && (
                  <button
                    type="button"
                    onClick={handleAddFile}
                    aria-label="Add file tab"
                    title="Add file"
                    className="flex items-center justify-center px-3 py-2 text-[var(--secondary-text)] hover:bg-[var(--code-surface-elevated)] hover:text-[var(--ink)] cursor-pointer shrink-0"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>

              {/* Right IDE Tab Controls: Sliding Edit | Highlighted + Copy + Raw */}
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 shrink-0">
                {canEdit && (
                  <div
                    role="group"
                    aria-label="Code view mode"
                    className="inline-flex items-center rounded-[6px] border border-[var(--hairline)] bg-[var(--code-surface)] p-0.5"
                  >
                    <button
                      type="button"
                      aria-pressed={viewMode === 'edit'}
                      onClick={() => setViewMode('edit')}
                      className={cn(
                        'relative inline-flex items-center gap-1 rounded-[4px] px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer',
                        viewMode === 'edit'
                          ? 'text-[var(--action-bright)]'
                          : 'text-[var(--secondary-text)] hover:text-[var(--ink)]',
                      )}
                    >
                      {viewMode === 'edit' && (
                        <motion.span
                          layoutId="workbench-view-pill"
                          transition={prefersReducedMotion ? INSTANT_TRANSITION : SPRING_SEGMENT}
                          className="absolute inset-0 rounded-[4px] bg-[var(--selected-tint)]"
                        />
                      )}
                      <Pencil className="relative z-10 h-3 w-3" aria-hidden="true" />
                      <span className="relative z-10">Edit</span>
                    </button>
                    <button
                      type="button"
                      aria-pressed={viewMode === 'highlighted'}
                      onClick={() => setViewMode('highlighted')}
                      className={cn(
                        'relative inline-flex items-center gap-1 rounded-[4px] px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer',
                        viewMode === 'highlighted'
                          ? 'text-[var(--action-bright)]'
                          : 'text-[var(--secondary-text)] hover:text-[var(--ink)]',
                      )}
                    >
                      {viewMode === 'highlighted' && (
                        <motion.span
                          layoutId="workbench-view-pill"
                          transition={prefersReducedMotion ? INSTANT_TRANSITION : SPRING_SEGMENT}
                          className="absolute inset-0 rounded-[4px] bg-[var(--selected-tint)]"
                        />
                      )}
                      <Eye className="relative z-10 h-3 w-3" aria-hidden="true" />
                      <span className="relative z-10">Highlighted</span>
                    </button>
                  </div>
                )}

                <Button
                  type="button"
                  variant="code"
                  size="sm"
                  onClick={handleCopyActiveCode}
                  className="h-7 px-2 text-[11px]"
                >
                  {copiedCode ? (
                    <>
                      <Check className="h-3 w-3 text-[var(--success-ink)]" aria-hidden="true" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" aria-hidden="true" />
                      Copy
                    </>
                  )}
                </Button>

                {rawUrl && (
                  <Button asChild variant="code" size="sm" className="h-7 px-2 text-[11px]">
                    <Link to={rawUrl}>
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      Raw
                    </Link>
                  </Button>
                )}
              </div>
            </div>

            {/* Active File Path & Editor Controls Sub-Bar */}
            {activeFile && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--hairline)]/80 bg-[var(--code-header)] px-3.5 py-2">
                {canEdit && viewMode === 'edit' ? (
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <input
                      ref={pathInputRef}
                      type="text"
                      value={activeFile.path}
                      onChange={(e) => updateFilePath(activeFile.id, e.target.value)}
                      placeholder="src/index.ts"
                      aria-label="Active file path"
                      aria-invalid={Boolean(activeFileIssue)}
                      className={cn(
                        'h-7 min-w-[160px] flex-1 max-w-[360px] rounded-[5px] border bg-[var(--code-surface)] px-2.5 font-mono text-xs text-[var(--code-ink)] focus:outline-none',
                        activeFileIssue
                          ? 'border-[var(--error-ink)]'
                          : 'border-[var(--hairline)] focus:border-[var(--action)]',
                      )}
                    />
                    <span className="font-mono text-[11px] uppercase tracking-wide text-[var(--muted-text)]">
                      {activeFile.language || 'text'}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className="text-[var(--code-ink)]">{activeFile.path}</span>
                    <span aria-hidden="true" className="text-[var(--muted-text)]">
                      ·
                    </span>
                    <span className="uppercase text-[11px] text-[var(--muted-text)]">
                      {activeFile.language || 'text'}
                    </span>
                  </div>
                )}

                {canEdit && viewMode === 'edit' && (
                  <div className="flex items-center gap-2 text-[11px] text-[var(--muted-text)]">
                    <span className="hidden md:inline">
                      Press <kbd className="font-mono text-[var(--secondary-text)]">Esc</kbd> then{' '}
                      <kbd className="font-mono text-[var(--secondary-text)]">Tab</kbd> to leave editor
                    </span>
                    <button
                      type="button"
                      onClick={() => setUsePlainTextarea((v) => !v)}
                      className="rounded border border-[var(--hairline)] bg-[var(--code-surface)] px-2 py-0.5 font-mono text-[11px] text-[var(--code-muted)] hover:text-[var(--code-ink)] cursor-pointer"
                    >
                      {usePlainTextarea || monacoFailed ? 'Use IDE editor' : 'Plain text'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeFileIssue && (
              <div
                role="alert"
                className="flex items-center gap-1.5 border-b border-[var(--error-border)] bg-[var(--error-surface)] px-3.5 py-2 text-xs text-[var(--error-ink)]"
              >
                <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {activeFileIssue.message}
              </div>
            )}

            {/* Code Surface: Monaco / Plain Textarea / Shiki Highlighted */}
            {activeFile &&
              (canEdit && viewMode === 'edit' ? (
                usePlainTextarea || monacoFailed ? (
                  <textarea
                    value={activeFile.text}
                    onChange={(e) => updateFileText(activeFile.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') releaseEditorFocus();
                    }}
                    spellCheck={false}
                    aria-label={`Source code for ${activeFile.path}`}
                    className="block min-h-[400px] w-full resize-y bg-[var(--code-surface)] p-4 font-mono text-[13.5px] leading-[1.6] text-[var(--code-ink)] focus:outline-none"
                  />
                ) : (
                  <EditorErrorBoundary onError={() => setMonacoFailed(true)}>
                    <React.Suspense
                      fallback={
                        <div className="flex h-[420px] items-center justify-center bg-[var(--code-surface)] font-mono text-xs text-[var(--muted-text)]">
                          Loading IDE editor…
                        </div>
                      }
                    >
                      <LazyMonacoCodeEditor
                        files={files}
                        activeFileId={activeFile.id}
                        onChange={updateFileText}
                        onLoadError={() => setMonacoFailed(true)}
                        onEscape={releaseEditorFocus}
                      />
                    </React.Suspense>
                  </EditorErrorBoundary>
                )
              ) : (
                <EmbeddedShikiSurface
                  path={activeFile.path}
                  language={activeFile.language}
                  code={activeFile.text}
                />
              ))}

            {/* Real IDE Footer Status Bar (zero fake telemetry) */}
            {activeFile && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--hairline)] bg-[var(--code-surface-elevated)] px-3.5 py-1.5 font-mono text-[11px] text-[var(--muted-text)]">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 tabular-nums">
                  <span className="text-[var(--secondary-text)]">{activeFile.path}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {activeLineCount} {activeLineCount === 1 ? 'line' : 'lines'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{activeCharCount} chars</span>
                  <span aria-hidden="true">·</span>
                  <span>UTF-8</span>
                  <span aria-hidden="true">·</span>
                  <span className="uppercase">{activeFile.language || 'text'}</span>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      isDirty ? 'text-[var(--action-bright)]' : 'text-[var(--muted-text)]',
                    )}
                  >
                    {canEdit
                      ? isDirty
                        ? 'Unsaved changes'
                        : mode === 'create'
                          ? 'Draft'
                          : 'Saved to Snipbase'
                      : 'Read-only'}
                  </span>

                  {canEdit && viewMode === 'edit' && files.length > 1 && (
                    <button
                      type="button"
                      onClick={() => requestRemoveFile(activeFile.id)}
                      className="font-sans text-[11.5px] font-medium text-[var(--error-ink)] hover:underline cursor-pointer"
                    >
                      Remove current file
                    </button>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* Real Inline Feedback Strip with smooth entrance/exit */}
          <AnimatePresence initial={false}>
            {feedback && (
              <motion.div
                key={`${feedback.tone}-${feedback.message}`}
                role={feedback.tone === 'error' ? 'alert' : 'status'}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                transition={prefersReducedMotion ? INSTANT_TRANSITION : TRANSITION_FAST}
                className={cn(
                  'flex items-center justify-between gap-3 rounded-[8px] border px-3.5 py-2.5 text-xs',
                  feedback.tone === 'success'
                    ? 'border-[var(--success-border)] bg-[var(--success-surface)] text-[var(--success-ink)]'
                    : 'border-[var(--error-border)] bg-[var(--error-surface)] text-[var(--error-ink)]',
                )}
              >
                <div className="flex items-center gap-2">
                  {feedback.tone === 'success' ? (
                    <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  ) : (
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  )}
                  <span>{feedback.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setFeedback(null)}
                  aria-label="Dismiss message"
                  className="opacity-70 hover:opacity-100 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Embed Dialog */}
      {mode === 'detail' && snippet && activeFile && (
        <EmbedDialog
          snippet={snippet}
          activeFilePath={activeFile.path}
          open={embedOpen}
          onOpenChange={setEmbedOpen}
          onCopied={(msg) => {
            showToast('success', msg);
          }}
        />
      )}

      {/* Confirm Remove Non-Empty File Dialog */}
      <AlertDialog
        open={Boolean(pendingRemoveFile)}
        onOpenChange={(open) => {
          if (!open) setPendingRemoveFileId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove file?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-mono text-[var(--ink)]">{pendingRemoveFile?.path}</span>{' '}
              contains unsaved code. Removing this tab will delete its contents from this draft.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep file</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[var(--error-ink)] text-white hover:bg-[#b31222]"
              onClick={() => {
                if (pendingRemoveFile) executeRemoveFile(pendingRemoveFile.id);
              }}
            >
              Remove file
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Discard Unsaved Changes Dialog */}
      <AlertDialog open={discardDialogOpen} onOpenChange={setDiscardDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Reverts the title, visibility, tags, and all file edits back to the last saved
              saved version.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={handleDiscardChanges}>
              Discard changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Delete Snippet Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete snippet?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes{' '}
              <span className="font-medium text-[var(--ink)]">{snippet?.title}</span> from
              the server. Existing forks created by other users remain intact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[var(--error-ink)] text-white hover:bg-[#b31222]"
              onClick={handleDelete}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete snippet'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
