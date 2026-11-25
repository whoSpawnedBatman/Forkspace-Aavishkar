import { supabase } from "./supabase";

export const apiOrigin = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY === "local-demo"
  ? "/api"
  : process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type SnippetFile = { path: string; content: string };
export type SnippetInput = {
  title: string;
  tags: string[];
  visibility: "public" | "unlisted" | "private";
  files: SnippetFile[];
};
export type SnippetSummary = SnippetInput & {
  id: string;
  file_count: number;
  created_at: string;
  updated_at?: string;
  parent_snippet_id?: string | null;
};
export type ForkGraph = {
  nodes: { id: string; title: string }[];
  edges: { parent_id: string; child_id: string }[];
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const headers = new Headers(init?.headers);
  if (init?.body) headers.set("Content-Type", "application/json");
  if (data.session) headers.set("Authorization", `Bearer ${data.session.access_token}`);
  const response = await fetch(`${apiOrigin}${path}`, { ...init, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Request failed (${response.status}).`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  list(scope: "mine" | "public" | "shared", tag = "") {
    const query = new URLSearchParams({ scope });
    if (tag.trim()) query.set("tag", tag.trim().toLowerCase());
    return request<{ items: SnippetSummary[] }>(`/snippets?${query}`);
  },
  read(id: string) {
    return request<SnippetSummary>(`/snippets/${id}`);
  },
  save(input: SnippetInput, id?: string) {
    return request<{ id: string }>(id ? `/snippets/${id}` : "/snippets", {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(input),
    });
  },
  fork(id: string) {
    return request<{ id: string }>(`/snippets/${id}/fork`, { method: "POST" });
  },
  graph(id: string) {
    return request<ForkGraph>(`/snippets/${id}/graph`);
  },
  grantAccess(id: string, email: string) {
    return request<{ email: string; access: "viewer" }>(`/snippets/${id}/access`, {
      method: "PUT",
      body: JSON.stringify({ email }),
    });
  },
};
