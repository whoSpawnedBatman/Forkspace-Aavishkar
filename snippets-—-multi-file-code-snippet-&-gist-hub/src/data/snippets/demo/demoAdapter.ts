import { computeFilesDiff } from '@/src/lib/diff';
import {
  SnippetAdapterError,
  type CreateReceipt,
  type ForkChildRef,
  type ForkGraphNode,
  type ListSnippetsInput,
  type ListSnippetsResult,
  type SearchMatchContext,
  type Snippet,
  type SnippetAdapter,
  type SnippetDraft,
  type SnippetExplanation,
  type SnippetRevision,
  type SnippetSummary,
  type Viewer,
} from '../domain';
import { detectLanguageFromPath, normalizeTag, validateSnippetDraft } from '../validation';
import type { StoredSnippetRecord } from './fixtures';
import { getDemoScenario, readDemoRecords, writeDemoRecords } from './storage';

const GUEST_VIEWER: Viewer = {
  id: 'guest',
  name: 'Guest',
  firstName: 'Guest',
  email: 'anonymous',
  initial: 'G',
  handle: 'anonymous',
  role: 'guest',
  label: 'Guest (Anonymous)',
};

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function canViewerReadRecord(record: StoredSnippetRecord, viewer: Viewer): boolean {
  if (record.visibility === 'public' || record.visibility === 'unlisted') {
    return true;
  }
  return viewer.role === 'user' && record.ownerId === viewer.id;
}

function canViewerListRecord(record: StoredSnippetRecord, viewer: Viewer): boolean {
  if (record.visibility === 'public') {
    return true;
  }
  return viewer.role === 'user' && record.ownerId === viewer.id;
}

function generateSnippetId(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24);
  const rand = Math.random().toString(36).slice(2, 7);
  return slug ? `${slug}-${rand}` : `snip-${rand}`;
}

function toSummary(
  record: StoredSnippetRecord,
  allRecords: StoredSnippetRecord[],
  viewer: Viewer,
  matchContext?: SearchMatchContext,
): SnippetSummary {
  const forkCount = allRecords.filter(
    (other) =>
      other.forkedFrom?.id === record.id &&
      (other.visibility === 'public' ||
        (viewer.role === 'user' && other.ownerId === viewer.id)),
  ).length;

  const languages = Array.from(
    new Set(
      record.files
        .map((file) => file.language || detectLanguageFromPath(file.path))
        .filter((lang) => lang && lang !== 'text'),
    ),
  ).slice(0, 3);

  return {
    id: record.id,
    title: record.title,
    description: record.description,
    visibility: record.visibility,
    tags: record.tags,
    fileCount: record.files.length,
    filePaths: record.files.map((f) => f.path),
    primaryLanguages: languages,
    ownerId: record.ownerId,
    ownerName: record.ownerName,
    ownerHandle: record.ownerHandle,
    forkedFrom: record.forkedFrom,
    forkCount,
    starCount: record.starredBy.length,
    viewerHasStarred: viewer.role === 'user' && record.starredBy.includes(viewer.id),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    matchContext,
  };
}

function buildForkGraph(
  current: StoredSnippetRecord,
  allRecords: StoredSnippetRecord[],
  viewer: Viewer,
): ForkGraphNode[] {
  const byId = new Map<string, StoredSnippetRecord>();
  for (const rec of allRecords) {
    byId.set(rec.id, rec);
  }

  // Walk upward to find the topmost available root ancestor
  let root = current;
  const visitedUp = new Set<string>([root.id]);
  while (root.forkedFrom && byId.has(root.forkedFrom.id) && !visitedUp.has(root.forkedFrom.id)) {
    root = byId.get(root.forkedFrom.id)!;
    visitedUp.add(root.id);
  }

  // Group children by parentId
  const childrenByParent = new Map<string, StoredSnippetRecord[]>();
  for (const rec of allRecords) {
    const pid = rec.forkedFrom?.id;
    if (!pid) continue;
    const list = childrenByParent.get(pid) ?? [];
    list.push(rec);
    childrenByParent.set(pid, list);
  }

  const nodes: ForkGraphNode[] = [];
  const visitedDown = new Set<string>();

  const traverse = (rec: StoredSnippetRecord, depth: number) => {
    if (visitedDown.has(rec.id)) return;
    visitedDown.add(rec.id);

    const accessible = canViewerReadRecord(rec, viewer);
    // Keep private forks by other users hidden unless it's the current node or an ancestor
    if (!accessible && rec.id !== current.id && !visitedUp.has(rec.id)) {
      return;
    }

    const parentRec = rec.forkedFrom ? byId.get(rec.forkedFrom.id) : undefined;
    const baseFiles = rec.forkOriginFiles ?? parentRec?.files;
    const diffStats =
      baseFiles && rec.forkedFrom
        ? computeFilesDiff(baseFiles, rec.files)
        : { totalAdded: 0, totalRemoved: 0, changedFilesCount: 0 };

    nodes.push({
      id: rec.id,
      title: accessible ? rec.title : 'Private snippet',
      ownerId: rec.ownerId,
      ownerName: rec.ownerName,
      ownerHandle: rec.ownerHandle,
      visibility: rec.visibility,
      parentId: rec.forkedFrom?.id,
      depth,
      createdAt: rec.createdAt,
      updatedAt: rec.updatedAt,
      fileCount: rec.files.length,
      addedLines: diffStats.totalAdded,
      removedLines: diffStats.totalRemoved,
      changedFilesCount: diffStats.changedFilesCount,
      isCurrent: rec.id === current.id,
      isAccessible: accessible,
    });

    const children = (childrenByParent.get(rec.id) ?? []).sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );
    for (const child of children) {
      traverse(child, depth + 1);
    }
  };

  traverse(root, 0);
  return nodes;
}

function resolveDefaultHistory(record: StoredSnippetRecord): SnippetRevision[] {
  if (record.history && record.history.length > 0) {
    return record.history;
  }
  const totalLines = record.files.reduce(
    (sum, f) => sum + (f.text ? f.text.split(/\r?\n/).length : 0),
    0,
  );
  return [
    {
      id: `rev-init-${record.id}`,
      type: record.forkedFrom ? 'forked' : 'created',
      summary: record.forkedFrom
        ? `Forked from ${record.forkedFrom.title} by ${record.forkedFrom.ownerName}`
        : `Created snippet with ${record.files.length} ${record.files.length === 1 ? 'file' : 'files'}`,
      actorId: record.ownerId,
      actorName: record.ownerName,
      actorHandle: record.ownerHandle,
      timestamp: record.createdAt,
      addedLines: record.forkedFrom ? 0 : totalLines,
      removedLines: 0,
      filesChanged: record.files.map((f) => f.path),
      parentId: record.forkedFrom?.id,
      parentTitle: record.forkedFrom?.title,
      snapshotFiles: record.files,
    },
  ];
}

function toFullSnippet(
  record: StoredSnippetRecord,
  allRecords: StoredSnippetRecord[],
  viewer: Viewer,
): Snippet {
  const summary = toSummary(record, allRecords, viewer);
  const publicForks: ForkChildRef[] = allRecords
    .filter(
      (other) =>
        other.forkedFrom?.id === record.id &&
        (other.visibility === 'public' ||
          (viewer.role === 'user' && other.ownerId === viewer.id)),
    )
    .map((fork) => ({
      id: fork.id,
      title: fork.title,
      ownerName: fork.ownerName,
      visibility: fork.visibility,
      updatedAt: fork.updatedAt,
    }));

  const isOwner = viewer.role === 'user' && record.ownerId === viewer.id;
  const parentRecord = record.forkedFrom
    ? allRecords.find((r) => r.id === record.forkedFrom?.id)
    : undefined;
  const rawOriginFiles = record.forkOriginFiles ?? parentRecord?.files;

  return {
    ...summary,
    files: record.files.map((file) => ({
      ...file,
      language: file.language || detectLanguageFromPath(file.path),
    })),
    forkOriginFiles: rawOriginFiles
      ? rawOriginFiles.map((file) => ({
          ...file,
          language: file.language || detectLanguageFromPath(file.path),
        }))
      : undefined,
    history: resolveDefaultHistory(record),
    forkGraph: buildForkGraph(record, allRecords, viewer),
    publicForks,
    canEdit: isOwner,
    canDelete: isOwner,
    canFork: viewer.role === 'user',
    canEmbed: record.visibility !== 'private',
  };
}

function findCodeMatch(record: StoredSnippetRecord, q: string): SearchMatchContext | undefined {
  for (const file of record.files) {
    const lines = file.text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      if (lines[i].toLowerCase().includes(q)) {
        return {
          filePath: file.path,
          lineNumber: i + 1,
          linePreview: lines[i].trim().slice(0, 110),
        };
      }
    }
  }
  return undefined;
}

function buildSampleExplanation(record: StoredSnippetRecord): SnippetExplanation {
  const fileBreakdown = record.files.map((file) => {
    const lang = file.language || detectLanguageFromPath(file.path);
    const lines = file.text.split(/\r?\n/);
    const nonEmptyCount = lines.filter((l) => l.trim().length > 0).length;
    const exportsFound = lines
      .map(
        (line) =>
          line.match(
            /export\s+(?:async\s+)?(?:function|const|class|interface|type)\s+([A-Za-z0-9_]+)/,
          )?.[1],
      )
      .filter((name): name is string => Boolean(name));

    const highlights: string[] = [];
    if (exportsFound.length > 0) {
      highlights.push(`Exports: ${exportsFound.slice(0, 4).join(', ')}`);
    }
    if (file.path.toLowerCase().endsWith('.md')) {
      highlights.push('Documents setup, usage, and integration notes.');
    } else if (file.path.toLowerCase().endsWith('.html')) {
      highlights.push('Declares document shell, asset links, and mount root.');
    } else if (file.path.toLowerCase().endsWith('.css')) {
      highlights.push('Defines visual theme tokens and base layout styling.');
    } else if (file.path.toLowerCase().includes('test')) {
      highlights.push('Asserts expected edge cases and runtime invariants.');
    } else if (
      file.path.toLowerCase().includes('docker') ||
      file.path.toLowerCase().includes('nginx')
    ) {
      highlights.push('Configures container build stages, routing, or security headers.');
    } else {
      highlights.push(`${nonEmptyCount} non-empty lines of ${lang} source.`);
    }

    const role = file.path.toLowerCase().endsWith('.md')
      ? 'Documentation'
      : file.path.toLowerCase().endsWith('.html')
        ? 'Entry markup'
        : file.path.toLowerCase().endsWith('.css')
          ? 'Stylesheet'
          : file.path.toLowerCase().includes('main') || file.path.toLowerCase().includes('app')
            ? 'Application entry'
            : `${lang.charAt(0).toUpperCase() + lang.slice(1)} module`;

    return { path: file.path, role, highlights };
  });

  const languages = Array.from(
    new Set(record.files.map((f) => f.language || detectLanguageFromPath(f.path))),
  );

  const summary = record.description
    ? `${record.description} Organized across ${record.files.length} files (${languages.join(', ')}) so each responsibility remains clear when shared or forked.`
    : `A ${record.files.length}-file ${record.visibility} snippet authored by ${record.ownerName} combining ${languages.join(', ')}.`;

  const considerations: string[] = [
    record.visibility === 'private'
      ? 'Private visibility: strictly owner-only. Anonymous reads and iframe embeds are blocked.'
      : record.visibility === 'unlisted'
        ? 'Unlisted visibility: shareable via direct access link and iframe embeds, hidden from public Discover tag search.'
        : 'Public visibility: indexed in Discover tag search, embeddable via iframe, and forkable by any signed-in developer.',
    record.forkedFrom
      ? `Forked from "${record.forkedFrom.title}" by ${record.forkedFrom.ownerName}; edits never mutate the parent.`
      : 'Forking creates an independent copy with a new ID while keeping this original intact.',
    'Code rendering uses tokenized text nodes (zero raw HTML execution) to prevent XSS.',
  ];

  return {
    snippetId: record.id,
    source: 'sample',
    label: 'Sample explanation',
    summary,
    fileBreakdown,
    considerations,
    generatedAt: new Date().toISOString(),
  };
}

export const demoSnippetAdapter: SnippetAdapter = {
  mode: 'demo',

  async list(viewer: Viewer, input?: ListSnippetsInput): Promise<ListSnippetsResult> {
    const scenario = getDemoScenario();
    if (scenario === 'slow-read') {
      await sleep(1000, input?.signal);
    } else {
      await sleep(50, input?.signal);
    }

    if (scenario === 'empty') {
      return { items: [], availableTags: [] };
    }

    const records = readDemoRecords();
    const scope = input?.scope ?? 'discover';
    const cleanTag = input?.tag ? normalizeTag(input.tag) : '';
    const cleanQuery = input?.query?.trim().toLowerCase() ?? '';

    const scopeCandidates = records.filter((rec) => {
      if (scope === 'mine') {
        return viewer.role === 'user' && rec.ownerId === viewer.id;
      }
      if (scope === 'shared') {
        if (!canViewerReadRecord(rec, viewer)) return false;
        // Shared tab surfaces unlisted/embed-ready snippets, forks, or other authors' public snippets
        if (viewer.role === 'user') {
          return (
            rec.visibility === 'unlisted' ||
            Boolean(rec.forkedFrom) ||
            (rec.ownerId !== viewer.id && rec.visibility === 'public')
          );
        }
        return rec.visibility === 'public';
      }
      if (scope === 'starred') {
        return (
          viewer.role === 'user' &&
          canViewerListRecord(rec, viewer) &&
          rec.starredBy.includes(viewer.id)
        );
      }
      // Discover: strictly Public snippets (plus user's own public snippets)
      return rec.visibility === 'public';
    });

    const tagCounts = new Map<string, number>();
    for (const rec of scopeCandidates) {
      for (const tag of rec.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
    }
    const availableTags = Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));

    const matched: SnippetSummary[] = [];
    for (const rec of scopeCandidates) {
      if (cleanTag && !rec.tags.includes(cleanTag)) {
        continue;
      }

      let matchContext: SearchMatchContext | undefined;
      if (cleanQuery) {
        const titleHit = rec.title.toLowerCase().includes(cleanQuery);
        const descHit = rec.description?.toLowerCase().includes(cleanQuery) ?? false;
        const tagHit = rec.tags.some((t) => t.includes(cleanQuery.replace(/^#/, '')));
        const ownerHit =
          rec.ownerName.toLowerCase().includes(cleanQuery) ||
          rec.ownerHandle.toLowerCase().includes(cleanQuery);
        const pathHit = rec.files.some((f) => f.path.toLowerCase().includes(cleanQuery));
        const contentMatch = findCodeMatch(rec, cleanQuery);

        if (!titleHit && !descHit && !tagHit && !ownerHit && !pathHit && !contentMatch) {
          continue;
        }
        matchContext = contentMatch;
      }

      matched.push(toSummary(rec, records, viewer, matchContext));
    }

    matched.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return { items: matched, availableTags };
  },

  async read(
    id: string,
    viewer: Viewer,
    input?: { signal?: AbortSignal; asAnonymous?: boolean },
  ): Promise<Snippet> {
    const scenario = getDemoScenario();
    if (scenario === 'slow-read') {
      await sleep(900, input?.signal);
    } else {
      await sleep(40, input?.signal);
    }

    const effectiveViewer = input?.asAnonymous ? GUEST_VIEWER : viewer;
    const records = readDemoRecords();
    const record = records.find((rec) => rec.id === id);

    if (!record) {
      throw new SnippetAdapterError({
        code: 'missing',
        message: 'This snippet does not exist in the current browser demo store.',
      });
    }

    if (!canViewerReadRecord(record, effectiveViewer)) {
      if (effectiveViewer.role === 'guest') {
        throw new SnippetAdapterError({
          code: 'unauthenticated',
          message:
            'This snippet is Private. Sign in as its owner to inspect it—anonymous viewers cannot access private snippets.',
        });
      }
      throw new SnippetAdapterError({
        code: 'forbidden',
        message: `This snippet is Private and belongs to ${record.ownerName}. Switch to ${record.ownerName} to inspect it.`,
      });
    }

    return toFullSnippet(record, records, effectiveViewer);
  },

  async create(draft: SnippetDraft, viewer: Viewer): Promise<CreateReceipt> {
    await sleep(180);

    if (viewer.role !== 'user') {
      throw new SnippetAdapterError({
        code: 'unauthenticated',
        message: 'Sign in with an email or demo account to create a snippet.',
      });
    }

    const validation = validateSnippetDraft(draft);
    if (!validation.ok || !validation.normalizedDraft) {
      throw new SnippetAdapterError({
        code: 'invalid',
        message: 'Fix the highlighted fields before saving.',
        fieldIssues: validation.issues,
      });
    }

    if (getDemoScenario() === 'save-error') {
      throw new SnippetAdapterError({
        code: 'unavailable',
        message:
          'Simulated save failure active (Demo Controls). Your draft is preserved and nothing was saved.',
      });
    }

    const records = readDemoRecords();
    const now = new Date().toISOString();
    const id = generateSnippetId(validation.normalizedDraft.title);

    const createdFiles = validation.normalizedDraft.files.map((f) => ({ ...f }));
    const initialLines = createdFiles.reduce(
      (sum, f) => sum + (f.text ? f.text.split(/\r?\n/).length : 0),
      0,
    );

    const nextRecord: StoredSnippetRecord = {
      id,
      title: validation.normalizedDraft.title,
      description: validation.normalizedDraft.description,
      visibility: validation.normalizedDraft.visibility,
      tags: [...validation.normalizedDraft.tags],
      ownerId: viewer.id,
      ownerName: viewer.name,
      ownerHandle: viewer.handle,
      starredBy: [],
      files: createdFiles,
      history: [
        {
          id: `rev-${Date.now().toString(36)}`,
          type: 'created',
          summary: `Created snippet with ${createdFiles.length} ${createdFiles.length === 1 ? 'file' : 'files'}`,
          actorId: viewer.id,
          actorName: viewer.name,
          actorHandle: viewer.handle,
          timestamp: now,
          addedLines: initialLines,
          removedLines: 0,
          filesChanged: createdFiles.map((f) => f.path),
          snapshotFiles: createdFiles.map((f) => ({ ...f })),
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    const nextRecords = [nextRecord, ...records];
    writeDemoRecords(nextRecords);

    return {
      id,
      snippet: toFullSnippet(nextRecord, nextRecords, viewer),
    };
  },

  async update(id: string, draft: SnippetDraft, viewer: Viewer): Promise<CreateReceipt> {
    await sleep(180);

    if (viewer.role !== 'user') {
      throw new SnippetAdapterError({
        code: 'unauthenticated',
        message: 'Sign in to edit snippets.',
      });
    }

    const validation = validateSnippetDraft(draft);
    if (!validation.ok || !validation.normalizedDraft) {
      throw new SnippetAdapterError({
        code: 'invalid',
        message: 'Fix the highlighted fields before saving.',
        fieldIssues: validation.issues,
      });
    }

    if (getDemoScenario() === 'save-error') {
      throw new SnippetAdapterError({
        code: 'unavailable',
        message:
          'Simulated save failure active (Demo Controls). Your edits remain in the editor.',
      });
    }

    const records = readDemoRecords();
    const index = records.findIndex((rec) => rec.id === id);
    if (index === -1) {
      throw new SnippetAdapterError({
        code: 'missing',
        message: 'This snippet could not be found.',
      });
    }

    const existing = records[index];
    if (existing.ownerId !== viewer.id) {
      throw new SnippetAdapterError({
        code: 'forbidden',
        message: `Only ${existing.ownerName} can edit this snippet. Fork it first to create your own editable copy.`,
      });
    }

    const nextFiles = validation.normalizedDraft.files.map((f) => ({ ...f }));
    const diffVsPrev = computeFilesDiff(existing.files, nextFiles);
    const changedPaths = diffVsPrev.files
      .filter((f) => f.status !== 'unchanged')
      .map((f) => f.path);
    const visibilityChanged = existing.visibility !== validation.normalizedDraft.visibility;
    const now = new Date().toISOString();

    const revisionSummary =
      changedPaths.length > 0
        ? `Updated ${changedPaths.slice(0, 3).join(', ')}${changedPaths.length > 3 ? ` +${changedPaths.length - 3} more` : ''}`
        : visibilityChanged
          ? `Changed visibility from ${existing.visibility} to ${validation.normalizedDraft.visibility}`
          : 'Updated snippet metadata';

    const nextRevision: SnippetRevision = {
      id: `rev-${Date.now().toString(36)}`,
      type: changedPaths.length === 0 && visibilityChanged ? 'visibility' : 'edited',
      summary: revisionSummary,
      actorId: viewer.id,
      actorName: viewer.name,
      actorHandle: viewer.handle,
      timestamp: now,
      addedLines: diffVsPrev.totalAdded,
      removedLines: diffVsPrev.totalRemoved,
      filesChanged: changedPaths,
      snapshotFiles: nextFiles.map((f) => ({ ...f })),
    };

    const updated: StoredSnippetRecord = {
      ...existing,
      title: validation.normalizedDraft.title,
      description: validation.normalizedDraft.description,
      visibility: validation.normalizedDraft.visibility,
      tags: [...validation.normalizedDraft.tags],
      files: nextFiles,
      history: [nextRevision, ...resolveDefaultHistory(existing)],
      updatedAt: now,
    };

    const nextRecords = [...records];
    nextRecords[index] = updated;
    writeDemoRecords(nextRecords);

    return {
      id: updated.id,
      snippet: toFullSnippet(updated, nextRecords, viewer),
    };
  },

  async remove(id: string, viewer: Viewer): Promise<void> {
    await sleep(140);

    if (viewer.role !== 'user') {
      throw new SnippetAdapterError({
        code: 'unauthenticated',
        message: 'Sign in to delete snippets.',
      });
    }

    const records = readDemoRecords();
    const target = records.find((rec) => rec.id === id);
    if (!target) {
      throw new SnippetAdapterError({
        code: 'missing',
        message: 'Snippet not found.',
      });
    }
    if (target.ownerId !== viewer.id) {
      throw new SnippetAdapterError({
        code: 'forbidden',
        message: `Only ${target.ownerName} can delete this snippet.`,
      });
    }

    const nextRecords = records.filter((rec) => rec.id !== id);
    writeDemoRecords(nextRecords);
  },

  async fork(id: string, viewer: Viewer): Promise<CreateReceipt> {
    await sleep(180);

    if (viewer.role !== 'user') {
      throw new SnippetAdapterError({
        code: 'unauthenticated',
        message: 'Sign in or switch to a demo account to fork this snippet.',
      });
    }

    if (getDemoScenario() === 'save-error') {
      throw new SnippetAdapterError({
        code: 'unavailable',
        message: 'Simulated save failure active (Demo Controls). No fork was created.',
      });
    }

    const records = readDemoRecords();
    const parent = records.find((rec) => rec.id === id);
    if (!parent) {
      throw new SnippetAdapterError({
        code: 'missing',
        message: 'Source snippet not found.',
      });
    }

    if (!canViewerReadRecord(parent, viewer)) {
      throw new SnippetAdapterError({
        code: 'forbidden',
        message: 'Cannot fork a private snippet owned by another account.',
      });
    }

    const now = new Date().toISOString();
    const forkId = generateSnippetId(`${parent.title}-fork`);

    const clonedFiles = parent.files.map((f) => ({ ...f }));
    const forkedRecord: StoredSnippetRecord = {
      id: forkId,
      title: parent.title,
      description: parent.description,
      visibility: parent.visibility === 'private' ? 'private' : 'public',
      tags: [...parent.tags],
      ownerId: viewer.id,
      ownerName: viewer.name,
      ownerHandle: viewer.handle,
      forkedFrom: {
        id: parent.id,
        title: parent.title,
        ownerName: parent.ownerName,
      },
      forkOriginFiles: parent.files.map((f) => ({ ...f })),
      history: [
        {
          id: `rev-${Date.now().toString(36)}`,
          type: 'forked',
          summary: `Forked from ${parent.title} by ${parent.ownerName}`,
          actorId: viewer.id,
          actorName: viewer.name,
          actorHandle: viewer.handle,
          timestamp: now,
          addedLines: 0,
          removedLines: 0,
          filesChanged: [],
          parentId: parent.id,
          parentTitle: parent.title,
          snapshotFiles: clonedFiles.map((f) => ({ ...f })),
        },
      ],
      starredBy: [],
      files: clonedFiles,
      createdAt: now,
      updatedAt: now,
    };

    const nextRecords = [forkedRecord, ...records];
    writeDemoRecords(nextRecords);

    return {
      id: forkId,
      snippet: toFullSnippet(forkedRecord, nextRecords, viewer),
    };
  },

  async toggleStar(
    id: string,
    viewer: Viewer,
  ): Promise<{ starCount: number; viewerHasStarred: boolean }> {
    await sleep(70);

    if (viewer.role !== 'user') {
      throw new SnippetAdapterError({
        code: 'unauthenticated',
        message: 'Sign in or switch to a demo account to star snippets.',
      });
    }

    const records = readDemoRecords();
    const index = records.findIndex((rec) => rec.id === id);
    if (index === -1) {
      throw new SnippetAdapterError({ code: 'missing', message: 'Snippet not found.' });
    }

    const existing = records[index];
    if (!canViewerReadRecord(existing, viewer)) {
      throw new SnippetAdapterError({
        code: 'forbidden',
        message: 'You cannot star a private snippet owned by another account.',
      });
    }

    const alreadyStarred = existing.starredBy.includes(viewer.id);
    const nextStarredBy = alreadyStarred
      ? existing.starredBy.filter((uid) => uid !== viewer.id)
      : [...existing.starredBy, viewer.id];

    const nextRecords = [...records];
    nextRecords[index] = { ...existing, starredBy: nextStarredBy };
    writeDemoRecords(nextRecords);

    return {
      starCount: nextStarredBy.length,
      viewerHasStarred: !alreadyStarred,
    };
  },

  async explain(
    id: string,
    viewer: Viewer,
    input?: { signal?: AbortSignal },
  ): Promise<SnippetExplanation> {
    await sleep(550, input?.signal);

    const records = readDemoRecords();
    const record = records.find((rec) => rec.id === id);
    if (!record) {
      throw new SnippetAdapterError({ code: 'missing', message: 'Snippet not found.' });
    }
    if (!canViewerReadRecord(record, viewer)) {
      throw new SnippetAdapterError({
        code: 'forbidden',
        message: 'You do not have access to explain this snippet.',
      });
    }

    return buildSampleExplanation(record);
  },
};
