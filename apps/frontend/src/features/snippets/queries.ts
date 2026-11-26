import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { apiOrigin } from '@/src/data/snippets/live/liveAdapter';
import {
  isSnippetAdapterError,
  type LibraryScope,
  type SnippetDraft,
} from '@/src/data/snippets/domain';
import { useSnippetsContext } from './context';

export const snippetKeys = {
  all: (mode: string, viewerId: string) => ['snippets', mode, viewerId] as const,
  list: (mode: string, viewerId: string, scope: LibraryScope, tag: string, query: string) =>
    ['snippets', mode, viewerId, 'list', { scope, tag, query }] as const,
  detail: (mode: string, viewerId: string, id: string, asAnonymous = false) =>
    ['snippets', mode, viewerId, 'detail', id, { asAnonymous }] as const,
};

function shouldRetryRead(failureCount: number, error: unknown): boolean {
  if (failureCount >= 1) return false;
  if (isSnippetAdapterError(error)) {
    return error.failure.code === 'unknown';
  }
  return false;
}

export function useSnippetsList(params: {
  query: string;
  tag: string;
  scope: LibraryScope;
}) {
  const { adapter, viewer } = useSnippetsContext();
  return useQuery({
    queryKey: snippetKeys.list(adapter.mode, viewer.id, params.scope, params.tag, params.query),
    queryFn: ({ signal }) =>
      adapter.list(viewer, {
        query: params.query,
        tag: params.tag,
        scope: params.scope,
        signal,
      }),
    retry: shouldRetryRead,
    placeholderData: (previous) => previous,
  });
}

export function useSnippetDetail(
  id: string | undefined,
  options?: { asAnonymous?: boolean; enabled?: boolean },
) {
  const { adapter, viewer } = useSnippetsContext();
  const asAnonymous = options?.asAnonymous ?? false;
  const client = useQueryClient();
  const query = useQuery({
    queryKey: snippetKeys.detail(adapter.mode, viewer.id, id ?? '', asAnonymous),
    queryFn: ({ signal }) => adapter.read(id!, viewer, { signal, asAnonymous }),
    enabled: Boolean(id) && (options?.enabled ?? true),
    retry: shouldRetryRead,
  });
  const isPublic = query.data?.visibility === 'public';
  useEffect(() => {
    if (!id || !isPublic) return;
    let active = true;
    const events = new EventSource(apiOrigin + '/snippets/' + id + '/events');
    events.addEventListener('graph_changed', () => {
      if (active) client.invalidateQueries({ queryKey: snippetKeys.detail(adapter.mode, viewer.id, id, asAnonymous) });
    });
    events.addEventListener('unavailable', () => {
      events.close();
      if (active) client.invalidateQueries({ queryKey: snippetKeys.detail(adapter.mode, viewer.id, id, asAnonymous) });
    });
    return () => { active = false; events.close(); };
  }, [id, isPublic, adapter.mode, viewer.id, asAnonymous, client]);
  return query;
}

export function useCreateSnippet() {
  const { adapter, viewer } = useSnippetsContext();
  const queryClient = useQueryClient();

  return useMutation({
    retry: false,
    mutationFn: (draft: SnippetDraft) => adapter.create(draft, viewer),
    onSuccess: (receipt) => {
      queryClient.invalidateQueries({ queryKey: snippetKeys.all(adapter.mode, viewer.id) });
      if (receipt.snippet) {
        queryClient.setQueryData(
          snippetKeys.detail(adapter.mode, viewer.id, receipt.id, false),
          receipt.snippet,
        );
      }
    },
  });
}

export function useUpdateSnippet(id: string) {
  const { adapter, viewer } = useSnippetsContext();
  const queryClient = useQueryClient();

  return useMutation({
    retry: false,
    mutationFn: (draft: SnippetDraft) => adapter.update(id, draft, viewer),
    onSuccess: (receipt) => {
      queryClient.invalidateQueries({ queryKey: snippetKeys.all(adapter.mode, viewer.id) });
      if (receipt.snippet) {
        queryClient.setQueryData(
          snippetKeys.detail(adapter.mode, viewer.id, receipt.id, false),
          receipt.snippet,
        );
      }
    },
  });
}

export function useDeleteSnippet() {
  const { adapter, viewer } = useSnippetsContext();
  const queryClient = useQueryClient();

  return useMutation({
    retry: false,
    mutationFn: (id: string) => adapter.remove(id, viewer),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: snippetKeys.all(adapter.mode, viewer.id) });
    },
  });
}

export function useForkSnippet() {
  const { adapter, viewer } = useSnippetsContext();
  const queryClient = useQueryClient();

  return useMutation({
    retry: false,
    mutationFn: (sourceId: string) => adapter.fork(sourceId, viewer),
    onSuccess: (receipt) => {
      queryClient.invalidateQueries({ queryKey: snippetKeys.all(adapter.mode, viewer.id) });
      if (receipt.snippet) {
        queryClient.setQueryData(
          snippetKeys.detail(adapter.mode, viewer.id, receipt.id, false),
          receipt.snippet,
        );
      }
    },
  });
}

export function useToggleStar() {
  const { adapter, viewer } = useSnippetsContext();
  const queryClient = useQueryClient();

  return useMutation({
    retry: false,
    mutationFn: (id: string) => adapter.toggleStar(id, viewer),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: snippetKeys.all(adapter.mode, viewer.id) });
    },
  });
}
