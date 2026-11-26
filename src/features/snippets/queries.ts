"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getAdapter, getMode } from "@/data/snippets/adapter";
import type { CreateReceipt, SnippetDraft, Snippet, SnippetSummary } from "@/data/snippets/domain";

export const snippetKeys = {
  root: ["snippets", getMode()] as const,
  library: () => [...snippetKeys.root, "library"] as const,
  detail: (id: string) => [...snippetKeys.root, "detail", id] as const,
};

export function useSnippetList(enabled = true) {
  return useQuery<readonly SnippetSummary[]>({
    queryKey: snippetKeys.library(),
    queryFn: ({ signal }) => getAdapter().then((adapter) => adapter.list({ signal })),
    enabled,
  });
}

export function useSnippet(id: string) {
  return useQuery<Snippet>({
    queryKey: snippetKeys.detail(id),
    queryFn: ({ signal }) => getAdapter().then((adapter) => adapter.read(id, { signal })),
    enabled: Boolean(id),
  });
}

export function useCreateSnippet() {
  const queryClient = useQueryClient();

  return useMutation<CreateReceipt, Error, SnippetDraft>({
    mutationFn: (draft) => getAdapter().then((adapter) => adapter.create(draft)),
    onSuccess: async (receipt) => {
      await queryClient.invalidateQueries({ queryKey: snippetKeys.library() });
      if (receipt.snippet) {
        queryClient.setQueryData(snippetKeys.detail(receipt.id), receipt.snippet);
      }
    },
  });
}
