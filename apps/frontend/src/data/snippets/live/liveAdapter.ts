import { supabase } from '@/lib/supabase';
import { detectLanguageFromPath } from '../validation';
import { SnippetAdapterError, type FieldIssue, type Snippet, type SnippetSummary, type SnippetAdapter, type SnippetDraft, type Viewer } from '../domain';

export const apiOrigin = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY === 'local-demo'
  ? '/api' : (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000').replace(/\/$/, '');
export async function request<T>(path: string, init: RequestInit = {}, anonymous = false): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set('Content-Type', 'application/json');
  if (!anonymous) {
    const { data } = await supabase.auth.getSession();
    if (data.session) headers.set('Authorization', 'Bearer ' + data.session.access_token);
  }
  let response: Response;
  try { response = await fetch(apiOrigin + path, { ...init, headers }); }
  catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new SnippetAdapterError({ code: init.method === 'POST' ? 'save-unconfirmed' : 'unavailable', message: 'Could not reach the server. Check your connection and retry.' });
  }
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    const code = data?.error?.code === 'malicious_code' ? 'security' : response.status === 404 ? 'missing' : response.status === 401 ? 'unauthenticated' : response.status === 403 ? 'forbidden' : response.status === 422 ? 'invalid' : 'unavailable';
    const details = data?.error?.details as { field: string; message: string }[] | undefined;
    const fieldIssues = details?.flatMap<FieldIssue>(issue => {
      const [field, index] = issue.field.split('.');
      if (field !== 'title' && field !== 'files' && field !== 'tags') return [];
      return [{ field, fileIndex: field === 'files' && /^\d+$/.test(index) ? Number(index) : undefined, message: issue.message }];
    });
    throw new SnippetAdapterError({ code, message: details?.map(issue => issue.message).join(' ') || data?.error?.message || 'The server could not complete this request.', fieldIssues });
  }
  return data as T;
}
type Wire = {
  id: string; title: string; description?: string; tags: string[]; visibility: Snippet['visibility']; owner_name?: string; link_expires_at?: string | null;
  owner_id: string; file_count: number; created_at: string; updated_at: string;
  parent_snippet_id?: string; files?: { path: string; content: string }[];
  file_paths: string[]; star_count: number; starred: boolean;
};
type Stars = { star_count: number; starred: boolean };
type Graph = { nodes: { id: string; title: string }[]; edges: { parent_id: string; child_id: string }[] };
function summary(row: Wire, viewer: Viewer): SnippetSummary {
  return { id: row.id, title: row.title, description: row.description, visibility: row.visibility, linkExpiresAt: row.link_expires_at,
    tags: row.tags, fileCount: row.file_count, filePaths: row.file_paths,
    primaryLanguages: [...new Set(row.file_paths.map(detectLanguageFromPath))],
    ownerId: row.owner_id, ownerName: row.owner_id === viewer.id ? viewer.name : (row.owner_name || 'Developer'),
    ownerHandle: '', forkCount: 0, starCount: row.star_count, viewerHasStarred: row.starred,
    createdAt: row.created_at, updatedAt: row.updated_at };
}
function payload(draft: SnippetDraft) {
  return { title: draft.title, description: draft.description ?? '', tags: draft.tags, visibility: draft.visibility, link_expiry: draft.linkExpiry,
    files: draft.files.map(f => ({ path: f.path, content: f.text })) };
}
export const liveSnippetAdapter: SnippetAdapter = {
  mode: 'live',
  async list(viewer, input) {
    const query = new URLSearchParams({ scope: input?.scope === 'discover' || !input?.scope ? 'public' : input.scope, limit: '100' });
    if (input?.query) query.set('q', input.query);
    if (input?.tag) query.set('tag', input.tag);
    const data = await request<{ items: Wire[] }>('/snippets?' + query, { signal: input?.signal });
    const items = data.items.map(row => summary(row, viewer));
    const tags = new Map<string, number>();
    items.forEach(item => item.tags.forEach(tag => tags.set(tag, (tags.get(tag) ?? 0) + 1)));
    return { items, availableTags: [...tags].map(([tag, count]) => ({ tag, count })) };
  },
  async read(id, viewer, input) {
    const anonymous = input?.asAnonymous ?? false;
    const options = { signal: input?.signal };
    const row = await request<Wire>('/snippets/' + id, options, anonymous);
    const stars = await request<Stars>('/snippets/' + id + '/star', options, anonymous);
    const graph = row.visibility === 'public' ? await request<Graph>('/snippets/' + id + '/graph', options, anonymous) : { nodes: [], edges: [] };
    const parent = row.parent_snippet_id ? await request<Wire>('/snippets/' + row.parent_snippet_id, options, anonymous).catch(() => undefined) : undefined;
    const owns = !anonymous && viewer.role === 'user' && row.owner_id === viewer.id;
    return { ...summary(row, viewer),
      starCount: stars.star_count, viewerHasStarred: stars.starred,
      files: (row.files ?? []).map(f => ({ path: f.path, text: f.content, language: detectLanguageFromPath(f.path) })),
      forkedFrom: parent ? { id: parent.id, title: parent.title, ownerName: parent.owner_id === viewer.id ? viewer.name : (parent.owner_name || 'Developer') } : undefined,
      forkOriginFiles: parent?.files?.map(f => ({ path: f.path, text: f.content, language: detectLanguageFromPath(f.path) })),
      forkCount: graph.edges.filter(e => e.parent_id === id).length,
      history: [], publicForks: [],
      forkGraph: graph.nodes.map(node => ({
        id: node.id, title: node.title, ownerId: '', ownerName: '', ownerHandle: '', visibility: 'public' as const,
        parentId: graph.edges.find(edge => edge.child_id === node.id)?.parent_id,
        depth: 0, createdAt: '', updatedAt: '', fileCount: 0, addedLines: 0, removedLines: 0, changedFilesCount: 0,
        isCurrent: node.id === id, isAccessible: true,
      })),
      canEdit: owns, canDelete: owns, canFork: !anonymous && viewer.role === 'user', canEmbed: row.visibility !== 'private',
    };
  },
  create: (draft) => request('/snippets', { method: 'POST', body: JSON.stringify(payload(draft)) }),
  update: (id, draft) => request('/snippets/' + id, { method: 'PUT', body: JSON.stringify(payload(draft)) }),
  remove: async (id) => { await request('/snippets/' + id, { method: 'DELETE' }); },
  fork: (id) => request('/snippets/' + id + '/fork', { method: 'POST' }),
  async toggleStar(id) {
    const before = await request<Stars>('/snippets/' + id + '/star');
    await request('/snippets/' + id + '/star', { method: before.starred ? 'DELETE' : 'PUT' });
    const after = await request<Stars>('/snippets/' + id + '/star');
    return { starCount: after.star_count, viewerHasStarred: after.starred };
  },
  async explain(id, _viewer, input) {
    const result = await request<{ answer: string; sources: string[] }>('/snippets/' + id + '/ask',
      { method: 'POST', signal: input?.signal, body: JSON.stringify({ question: 'Explain how the files in this snippet work together.' }) });
    return { snippetId: id, source: 'live', label: 'Snippet explanation', summary: result.answer,
      fileBreakdown: [], considerations: result.sources.map(source => 'Source: ' + source), generatedAt: new Date().toISOString() };
  },
};
