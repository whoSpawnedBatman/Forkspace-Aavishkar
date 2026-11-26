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
  let response: Response;
  try {
    response = await fetch(`${apiOrigin}${path}`, { ...init, headers });
  } catch {
    throw new Error("Cannot reach the backend server. It may be waking up — try again in 30 seconds.");
  }
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    if (text.startsWith("<!") || text.startsWith("<html")) {
      throw new Error("Backend returned an HTML error page instead of JSON. It may be starting up — try again shortly.");
    }
    try {
      const body = JSON.parse(text);
      throw new Error(body?.error?.message ?? `Request failed (${response.status}).`);
    } catch (e) {
      if (e instanceof Error && !e.message.startsWith("Unexpected")) throw e;
      throw new Error(`Request failed (${response.status}).`);
    }
  }
  const text = await response.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Backend returned an unexpected response. It may be starting up — try again shortly.");
  }
}

export const api = {
  list(scope: "mine" | "public" | "shared", searchText = "") {
    const query = new URLSearchParams({ scope });
    const trimmed = searchText.trim();
    if (trimmed.startsWith("#") && trimmed.length > 1) {
      query.set("tag", trimmed.slice(1).toLowerCase());
    } else if (trimmed) {
      query.set("q", trimmed);
    }
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
  delete(id: string) {
    return request<{ id: string; deleted: boolean }>(`/snippets/${id}`, { method: "DELETE" });
  },
  graph(id: string) {
    return request<ForkGraph>(`/snippets/${id}/graph`);
  },
  starState(id: string) {
    return request<{ star_count: number; starred: boolean }>(`/snippets/${id}/star`);
  },
  star(id: string) {
    return request<{ starred: boolean }>(`/snippets/${id}/star`, { method: "PUT" });
  },
  unstar(id: string) {
    return request<{ starred: boolean }>(`/snippets/${id}/star`, { method: "DELETE" });
  },
  grantAccess(id: string, email: string) {
    return request<{ email: string; access: "viewer" }>(`/snippets/${id}/access`, {
      method: "PUT",
      body: JSON.stringify({ email }),
    });
  },
  ask(id: string, question: string) {
    return request<{ answer: string; context?: string; sources: string[] }>(`/snippets/${id}/ask`, {
      method: "POST", body: JSON.stringify({ question }),
    });
  },
};
