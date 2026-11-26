export type Visibility = 'public' | 'unlisted' | 'private';

export type ViewerRole = 'user' | 'guest';

export interface Viewer {
  readonly id: string;
  readonly name: string;
  readonly firstName: string;
  readonly email: string;
  readonly initial: string;
  readonly handle: string;
  readonly role: ViewerRole;
  readonly label: string;
}

export interface SnippetFile {
  readonly path: string;
  readonly language?: string;
  readonly text: string;
}

export interface ForkParentRef {
  readonly id: string;
  readonly title: string;
  readonly ownerName: string;
}

export interface ForkChildRef {
  readonly id: string;
  readonly title: string;
  readonly ownerName: string;
  readonly visibility: Visibility;
  readonly updatedAt: string;
}

export interface SearchMatchContext {
  readonly filePath: string;
  readonly lineNumber: number;
  readonly linePreview: string;
}

export interface SnippetSummary {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly visibility: Visibility;
  readonly tags: readonly string[];
  readonly fileCount: number;
  readonly filePaths: readonly string[];
  readonly primaryLanguages: readonly string[];
  readonly ownerId: string;
  readonly ownerName: string;
  readonly ownerHandle: string;
  readonly forkedFrom?: ForkParentRef;
  readonly forkCount: number;
  readonly starCount: number;
  readonly viewerHasStarred: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly matchContext?: SearchMatchContext;
}

export interface SnippetRevision {
  readonly id: string;
  readonly type: 'created' | 'forked' | 'edited' | 'visibility';
  readonly summary: string;
  readonly actorId: string;
  readonly actorName: string;
  readonly actorHandle: string;
  readonly timestamp: string;
  readonly addedLines: number;
  readonly removedLines: number;
  readonly filesChanged: readonly string[];
  readonly parentId?: string;
  readonly parentTitle?: string;
  readonly snapshotFiles: readonly SnippetFile[];
}

export interface ForkGraphNode {
  readonly id: string;
  readonly title: string;
  readonly ownerId: string;
  readonly ownerName: string;
  readonly ownerHandle: string;
  readonly visibility: Visibility;
  readonly parentId?: string;
  readonly depth: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly fileCount: number;
  readonly addedLines: number;
  readonly removedLines: number;
  readonly changedFilesCount: number;
  readonly isCurrent: boolean;
  readonly isAccessible: boolean;
}

export interface Snippet extends SnippetSummary {
  readonly files: readonly SnippetFile[];
  readonly forkOriginFiles?: readonly SnippetFile[];
  readonly history: readonly SnippetRevision[];
  readonly forkGraph: readonly ForkGraphNode[];
  readonly publicForks: readonly ForkChildRef[];
  readonly canEdit: boolean;
  readonly canDelete: boolean;
  readonly canFork: boolean;
  readonly canEmbed: boolean;
}

export interface SnippetDraft {
  readonly title: string;
  readonly description?: string;
  readonly visibility: Visibility;
  readonly tags: readonly string[];
  readonly files: readonly SnippetFile[];
}

export interface CreateReceipt {
  readonly id: string;
  readonly snippet?: Snippet;
}

export interface SnippetExplanation {
  readonly snippetId: string;
  readonly source: 'live';
  readonly label: string;
  readonly summary: string;
  readonly fileBreakdown: ReadonlyArray<{
    readonly path: string;
    readonly role: string;
    readonly highlights: readonly string[];
  }>;
  readonly considerations: readonly string[];
  readonly generatedAt: string;
}

export type FailureCode =
  | 'missing'
  | 'unauthenticated'
  | 'forbidden'
  | 'invalid'
  | 'conflict'
  | 'unavailable'
  | 'unknown'
  | 'save-unconfirmed';

export interface FieldIssue {
  readonly field: 'title' | 'files' | 'tags';
  readonly path?: string;
  readonly fileIndex?: number;
  readonly message: string;
}

export interface Failure {
  readonly code: FailureCode;
  readonly message?: string;
  readonly fieldIssues?: readonly FieldIssue[];
}

export class SnippetAdapterError extends Error {
  readonly failure: Failure;

  constructor(failure: Failure) {
    super(failure.message ?? `Snippet operation failed (${failure.code})`);
    this.name = 'SnippetAdapterError';
    this.failure = failure;
  }
}

export function isSnippetAdapterError(error: unknown): error is SnippetAdapterError {
  return error instanceof SnippetAdapterError;
}

export type LibraryScope = 'mine' | 'shared' | 'discover' | 'starred';

export interface ListSnippetsInput {
  readonly query?: string;
  readonly tag?: string;
  readonly scope?: LibraryScope;
  readonly signal?: AbortSignal;
}

export interface ListSnippetsResult {
  readonly items: readonly SnippetSummary[];
  readonly availableTags: ReadonlyArray<{ readonly tag: string; readonly count: number }>;
}

export interface SnippetAdapter {
  readonly mode: 'live';
  list(viewer: Viewer, input?: ListSnippetsInput): Promise<ListSnippetsResult>;
  read(
    id: string,
    viewer: Viewer,
    input?: { signal?: AbortSignal; asAnonymous?: boolean },
  ): Promise<Snippet>;
  create(draft: SnippetDraft, viewer: Viewer): Promise<CreateReceipt>;
  update(id: string, draft: SnippetDraft, viewer: Viewer): Promise<CreateReceipt>;
  remove(id: string, viewer: Viewer): Promise<void>;
  fork(id: string, viewer: Viewer): Promise<CreateReceipt>;
  toggleStar(
    id: string,
    viewer: Viewer,
  ): Promise<{ starCount: number; viewerHasStarred: boolean }>;
  explain(
    id: string,
    viewer: Viewer,
    input?: { signal?: AbortSignal },
  ): Promise<SnippetExplanation>;
}
