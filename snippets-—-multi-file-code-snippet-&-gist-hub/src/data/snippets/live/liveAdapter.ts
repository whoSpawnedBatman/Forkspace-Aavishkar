import {
  SnippetAdapterError,
  type CreateReceipt,
  type ListSnippetsInput,
  type ListSnippetsResult,
  type Snippet,
  type SnippetAdapter,
  type SnippetDraft,
  type SnippetExplanation,
  type Viewer,
} from '../domain';

function unavailableLiveError(): SnippetAdapterError {
  return new SnippetAdapterError({
    code: 'unavailable',
    message:
      'Live backend mode is enabled, but the canonical OpenAPI endpoint configuration is not yet attached. Demo fallback is intentionally disabled in live mode.',
  });
}

/**
 * Placeholder live adapter slot for canonical openapi.yaml integration.
 * Demo storage and fixtures remain strictly unreachable when mode === 'live'.
 */
export const liveSnippetAdapter: SnippetAdapter = {
  mode: 'live',

  async list(_viewer: Viewer, _input?: ListSnippetsInput): Promise<ListSnippetsResult> {
    throw unavailableLiveError();
  },

  async read(
    _id: string,
    _viewer: Viewer,
    _input?: { signal?: AbortSignal; asAnonymous?: boolean },
  ): Promise<Snippet> {
    throw unavailableLiveError();
  },

  async create(_draft: SnippetDraft, _viewer: Viewer): Promise<CreateReceipt> {
    throw unavailableLiveError();
  },

  async update(_id: string, _draft: SnippetDraft, _viewer: Viewer): Promise<CreateReceipt> {
    throw unavailableLiveError();
  },

  async remove(_id: string, _viewer: Viewer): Promise<void> {
    throw unavailableLiveError();
  },

  async fork(_id: string, _viewer: Viewer): Promise<CreateReceipt> {
    throw unavailableLiveError();
  },

  async toggleStar(
    _id: string,
    _viewer: Viewer,
  ): Promise<{ starCount: number; viewerHasStarred: boolean }> {
    throw unavailableLiveError();
  },

  async explain(
    _id: string,
    _viewer: Viewer,
    _input?: { signal?: AbortSignal },
  ): Promise<SnippetExplanation> {
    throw unavailableLiveError();
  },
};
