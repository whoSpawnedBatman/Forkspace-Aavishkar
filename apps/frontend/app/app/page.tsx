"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { Brand } from "../brand";
import { api, apiOrigin, type ForkGraph, type SnippetFile, type SnippetInput, type SnippetSummary } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { sharedSnippetId, withSharedSnippet } from "../../lib/shared-snippet";

const starterFiles: SnippetFile[] = [
  { path: "index.html", content: "<main id=\"app\"></main>\n<script src=\"app.js\"></script>" },
  { path: "app.js", content: "document.querySelector('#app').textContent = 'Hello, Snipbase!';" },
  { path: "styles.css", content: "body { font-family: system-ui; }" },
];

export default function WorkspacePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [scope, setScope] = useState<"mine" | "public" | "shared">("mine");
  const [tagSearch, setTagSearch] = useState("");
  const [items, setItems] = useState<SnippetSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editable, setEditable] = useState(true);
  const [title, setTitle] = useState("Three-file web demo");
  const [tags, setTags] = useState("demo, javascript");
  const [visibility, setVisibility] = useState<SnippetInput["visibility"]>("public");
  const [files, setFiles] = useState<SnippetFile[]>(starterFiles);
  const [activeFile, setActiveFile] = useState(0);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [savedVisibility, setSavedVisibility] = useState<SnippetInput["visibility"]>("private");
  const [graph, setGraph] = useState<ForkGraph | null>(null);
  const [starInfo, setStarInfo] = useState<{ star_count: number; starred: boolean } | null>(null);
  const [shareEmail, setShareEmail] = useState("");
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiAnswer, setAiAnswer] = useState<{ answer: string; sources: string[] } | null>(null);
  const latestSearch = useRef(0);

  const refresh = useCallback(async (nextScope: "mine" | "public" | "shared", tag: string) => {
    const request = ++latestSearch.current;
    try {
      setError("");
      const result = await api.list(nextScope, tag);
      if (request === latestSearch.current) setItems(result.items);
    } catch (caught) {
      if (request === latestSearch.current) setError(caught instanceof Error ? caught.message : "Could not load snippets.");
    }
  }, []);

  const openSnippet = useCallback(async (id: string, canEdit: boolean) => {
    try {
      setBusy(true);
      setError("");
      const snippet = await api.read(id);
      setSelectedId(snippet.id);
      setEditable(canEdit);
      setTitle(snippet.title);
      setTags(snippet.tags.join(", "));
      setVisibility(snippet.visibility);
      setSavedVisibility(snippet.visibility);
      setGraph(snippet.visibility === "public" ? await api.graph(snippet.id) : null);
      setStarInfo(await api.starState(snippet.id).catch(() => null));
      setFiles(snippet.files);
      setAiAnswer(null);
      setActiveFile(0);
      setNotice(canEdit ? "Snippet reopened and ready to edit." : "Public snippet opened in read-only mode.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not open snippet.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      if (!data.user) {
        router.replace(withSharedSnippet("/login"));
        return;
      }
      setUser(data.user);
      const shared = sharedSnippetId();
      const initialScope = shared ? "public" : "mine";
      setScope(initialScope);
      refresh(initialScope, "");
      if (shared) openSnippet(shared, false);
    });
    return () => { active = false; };
  }, [openSnippet, refresh, router]);

  function newSnippet() {
    setSelectedId(null);
    setEditable(true);
    setTitle("Three-file web demo");
    setTags("demo, javascript");
    setVisibility("public");
    setFiles(starterFiles);
    setGraph(null);
    setActiveFile(0);
    setNotice("New three-file snippet ready.");
    setError("");
  }

  async function save() {
    try {
      setBusy(true);
      setError("");
      const input: SnippetInput = {
        title: title.trim(),
        tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        visibility,
        files,
      };
      const result = await api.save(input, editable ? selectedId ?? undefined : undefined);
      setSelectedId(result.id);
      setEditable(true);
      setScope("mine");
      setTagSearch("");
      setSavedVisibility(input.visibility);
      setGraph(input.visibility === "public" ? await api.graph(result.id) : null);
      setNotice("Snippet saved.");
      await refresh("mine", "");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save snippet.");
    } finally {
      setBusy(false);
    }
  }

  async function fork() {
    if (!selectedId) return;
    try {
      setBusy(true);
      setError("");
      const result = await api.fork(selectedId);
      setScope("mine");
      setTagSearch("");
      await openSnippet(result.id, true);
      window.history.replaceState(null, "", "/app");
      setNotice("Fork created as a private copy. Edit it, then save or publish it.");
      await refresh("mine", "");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not fork snippet.");
    } finally {
      setBusy(false);
    }
  }

  async function copyEmbed() {
    if (!selectedId) return;
    const shareOrigin = window.location.origin;
    const link = savedVisibility !== "public"
      ? `${shareOrigin}/app?snippet=${selectedId}`
      : new URL(`${apiOrigin}/embed/${selectedId}`, shareOrigin).href;
    try {
      await navigator.clipboard.writeText(link);
      setNotice(savedVisibility === "public" ? "Embed link copied." : "Access link copied.");
    } catch {
      setNotice(`Copy this embed link: ${link}`);
    }
  }

  async function grantAccess() {
    if (!selectedId || !shareEmail.trim()) return;
    try {
      setBusy(true);
      const result = await api.grantAccess(selectedId, shareEmail.trim());
      setShareEmail("");
      setNotice(`Viewer access granted to ${result.email}.`);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not grant access.");
    } finally {
      setBusy(false);
    }
  }

  async function askAi() {
    if (!selectedId || !aiQuestion.trim()) return;
    try {
      setBusy(true); setError("");
      setAiAnswer(await api.ask(selectedId, aiQuestion.trim()));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not ask the snippet assistant.");
    } finally { setBusy(false); }
  }

  function updateFile(patch: Partial<SnippetFile>) {
    setFiles((current) => current.map((file, index) => index === activeFile ? { ...file, ...patch } : file));
  }

  if (!user) return <main className="workspace-loading">Loading workspace…</main>;

  return (
    <main className="workspace-shell">
      <header className="workspace-header">
        <Brand />
        <div className="workspace-user">
          <span>{user.user_metadata.username || user.email}</span>
          <button onClick={async () => { await supabase.auth.signOut(); router.replace("/"); }}>Sign out</button>
        </div>
      </header>

      <section className="demo-strip">
        <strong>Demo path</strong>
        <span>1 Create a public snippet</span><span>2 Copy embed link</span><span>3 Open as a second user</span><span>4 Fork, edit & publish</span><span>5 Search by tag</span>
      </section>

      <div className="workspace-grid">
        <aside className="library-panel">
          <div className="panel-title"><div><span className="eyebrow">LIBRARY</span><h2>Snippets</h2></div><button className="small-button primary" onClick={newSnippet}>+ New</button></div>
          <div className="scope-switch">
            {(["mine", "shared", "public"] as const).map((value) => <button key={value} className={scope === value ? "active" : ""} onClick={() => { setScope(value); refresh(value, tagSearch); }}>{value === "mine" ? "Mine" : value === "shared" ? "Shared" : "Discover"}</button>)}
          </div>
          <form className="tag-search" onSubmit={(event) => { event.preventDefault(); refresh(scope, tagSearch); }}>
            <input aria-label="Search by tag" placeholder="Search tag, e.g. demo" value={tagSearch} onChange={(event) => setTagSearch(event.target.value)} />
            <button>Search</button>
          </form>
          <div className="snippet-list">
            {items.length === 0 && <p className="empty-state">No snippets found.</p>}
            {items.map((item) => (
              <button key={item.id} className={`snippet-row ${selectedId === item.id ? "selected" : ""}`} onClick={() => openSnippet(item.id, scope === "mine")}>
                <strong>{item.title}</strong>
                <span>{item.file_count} files · {item.visibility}</span>
                <small>{item.tags.map((tag) => `#${tag}`).join(" ")}</small>
              </button>
            ))}
          </div>
        </aside>

        <section className="editor-panel">
          <div className="editor-toolbar">
            <div><span className="eyebrow">{selectedId ? (editable ? "EDITING" : "VIEWING") : "NEW SNIPPET"}</span><h2>{title || "Untitled snippet"}</h2></div>
            <div className="toolbar-actions">
              {selectedId && starInfo && <button className="small-button" onClick={async () => { try { setBusy(true); if (starInfo.starred) { await api.unstar(selectedId); } else { await api.star(selectedId); } setStarInfo(await api.starState(selectedId)); } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not update star."); } finally { setBusy(false); } }} disabled={busy}>{starInfo.starred ? "★" : "☆"} {starInfo.star_count}</button>}
              {graph && <a className="small-button highlight-link" href="#fork-graph">Fork graph ({graph.nodes.length})</a>}
              {selectedId && <button className="small-button" onClick={copyEmbed}>{savedVisibility === "public" ? "Copy embed link" : "Copy access link"}</button>}
              {selectedId && savedVisibility !== "private" && <a className="small-button highlight-link" href={`${apiOrigin}/embed/${selectedId}`} target="_blank" rel="noreferrer">Highlighted view</a>}
              {selectedId && !editable && <button className="small-button primary" onClick={fork} disabled={busy}>Fork snippet</button>}
              {selectedId && editable && <button className="small-button" onClick={async () => { try { setBusy(true); setError(""); await api.delete(selectedId); newSnippet(); await refresh(scope, ""); setNotice("Snippet deleted."); } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not delete snippet."); } finally { setBusy(false); } }} disabled={busy}>Delete</button>}
              {editable && <button className="small-button primary" onClick={save} disabled={busy}>{busy ? "Saving…" : selectedId ? "Save changes" : "Save snippet"}</button>}
            </div>
          </div>

          <div className={`access-bar ${editable ? "owner" : "viewer"}`}>
            <div>
              <strong>{editable ? "Owner access" : "Viewer access"}</strong>
              <span>{editable ? "Edit files, control visibility, and save changes." : "Read this public snippet or fork an editable copy you own."}</span>
            </div>
            <span className={`visibility-badge ${selectedId ? savedVisibility : visibility}`}>{selectedId ? savedVisibility : visibility}</span>
          </div>

          <div className="snippet-meta">
            <label>Title<input value={title} onChange={(event) => setTitle(event.target.value)} disabled={!editable} maxLength={120} /></label>
            <label>Tags<input value={tags} onChange={(event) => setTags(event.target.value)} disabled={!editable} placeholder="demo, javascript" /></label>
            <label>Visibility<select value={visibility} onChange={(event) => setVisibility(event.target.value as SnippetInput["visibility"])} disabled={!editable}><option value="public">Public — discoverable</option><option value="unlisted">Unlisted — anyone with link</option><option value="private">Private — invited viewers</option></select></label>
          </div>
          {selectedId && editable && savedVisibility === "private" && (
            <form className="access-grant" onSubmit={(event) => { event.preventDefault(); grantAccess(); }}>
              <div><strong>Give viewer access</strong><span>Only this signed-in person can open the access link.</span></div>
              <input type="email" aria-label="Viewer email" placeholder="person@example.com" value={shareEmail} onChange={(event) => setShareEmail(event.target.value)} required />
              <button className="small-button primary" disabled={busy}>Grant access</button>
            </form>
          )}

          <div className="file-tabs">
            {files.map((file, index) => <button key={`${file.path}-${index}`} className={activeFile === index ? "active" : ""} onClick={() => setActiveFile(index)}>{file.path || `file-${index + 1}`}</button>)}
            {editable && files.length < 20 && <button onClick={() => { setFiles([...files, { path: `file-${files.length + 1}.txt`, content: "" }]); setActiveFile(files.length); }}>+</button>}
          </div>
          {selectedId && <section className="access-grant" aria-labelledby="assistant-title">
            <div><strong id="assistant-title">Ask the snippet assistant</strong><span>Retrieves the most relevant code before answering.</span></div>
            <input aria-label="Question about this snippet" placeholder="How does this work?" value={aiQuestion} onChange={(event) => setAiQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); askAi(); } }} />
            <button type="button" className="small-button primary" onClick={askAi} disabled={busy || !aiQuestion.trim()}>Ask</button>
            {aiAnswer && <div style={{ gridColumn: "1 / -1", background: "#f8fafc", borderRadius: "10px", padding: "12px", whiteSpace: "pre-wrap" }}><strong>Answer</strong><p>{aiAnswer.answer}</p><small>Sources: {aiAnswer.sources.join(", ") || "none"}</small></div>}
          </section>}
          <div className="code-editor">
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input aria-label="File path" style={{ flex: 1 }} value={files[activeFile]?.path ?? ""} onChange={(event) => updateFile({ path: event.target.value })} disabled={!editable} />
              <span style={{ fontSize: "12px", fontWeight: 600, color: "#475569", background: "#f1f5f9", padding: "4px 10px", borderRadius: "999px", whiteSpace: "nowrap" }}>
                {(() => {
                  const ext = (files[activeFile]?.path ?? "").split(".").pop()?.toLowerCase() ?? "";
                  const map: Record<string, string> = { html: "HTML", htm: "HTML", js: "JavaScript", jsx: "JSX", ts: "TypeScript", tsx: "TSX", css: "CSS", scss: "SCSS", py: "Python", json: "JSON", md: "Markdown", sql: "SQL", sh: "Shell", yml: "YAML", yaml: "YAML", go: "Go", rs: "Rust", java: "Java", c: "C", cpp: "C++", txt: "Plain Text" };
                  return map[ext] ?? (ext ? ext.toUpperCase() : "Plain Text");
                })()}
              </span>
            </div>
            <textarea aria-label="File content" value={files[activeFile]?.content ?? ""} onChange={(event) => updateFile({ content: event.target.value })} disabled={!editable} spellCheck={false} />
          </div>
          {editable && files.length > 1 && <button className="remove-file" onClick={() => { setFiles(files.filter((_, index) => index !== activeFile)); setActiveFile(0); }}>Remove current file</button>}
          {graph && (() => {
            const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
            const childrenMap = new Map<string, string[]>();
            const hasParent = new Set<string>();
            for (const edge of graph.edges) {
              hasParent.add(edge.child_id);
              const list = childrenMap.get(edge.parent_id) ?? [];
              list.push(edge.child_id);
              childrenMap.set(edge.parent_id, list);
            }
            const roots = graph.nodes.filter((n) => !hasParent.has(n.id));
            const levels: { id: string; title: string; parentId?: string }[][] = [];
            let queue = roots.map((r) => ({ id: r.id, title: r.title, parentId: undefined as string | undefined }));
            const visited = new Set<string>();
            while (queue.length > 0) {
              levels.push(queue);
              const next: typeof queue = [];
              for (const item of queue) {
                if (visited.has(item.id)) continue;
                visited.add(item.id);
                for (const cid of childrenMap.get(item.id) ?? []) {
                  const cn = nodeMap.get(cid);
                  if (cn && !visited.has(cid)) next.push({ id: cn.id, title: cn.title, parentId: item.id });
                }
              }
              queue = next;
            }
            return (
              <section className="fork-graph" id="fork-graph" aria-labelledby="fork-graph-title">
                <div><h3 id="fork-graph-title">Fork graph</h3><span>{graph.nodes.length} public version{graph.nodes.length === 1 ? "" : "s"} · {graph.edges.length} link{graph.edges.length === 1 ? "" : "s"}</span></div>
                <div style={{ display: "flex", flexDirection: "column", gap: "16px", overflowX: "auto", padding: "8px 0" }}>
                  {levels.map((level, depth) => (
                    <div key={depth} style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center", paddingLeft: `${depth * 24}px` }}>
                      {depth > 0 && <span style={{ color: "#94a3b8", fontSize: "18px", userSelect: "none" }}>↳</span>}
                      {level.map((node) => {
                        const parentTitle = node.parentId ? nodeMap.get(node.parentId)?.title : null;
                        return (
                          <button
                            type="button"
                            key={node.id}
                            onClick={() => openSnippet(node.id, false)}
                            className={`graph-node ${node.id === selectedId ? "current" : ""}`}
                            style={{ textAlign: "left", cursor: "pointer" }}
                            title={parentTitle ? `Forked from ${parentTitle}` : "Original snippet"}
                          >
                            <span>{depth === 0 ? "Original" : `Fork · L${depth}`}</span>
                            <strong>{node.title}</strong>
                            <small>{node.id.slice(0, 8)}{parentTitle ? ` ← ${parentTitle}` : ""}</small>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </section>
            );
          })()}
          {notice && <p className="workspace-notice" role="status">{notice}</p>}
          {error && <p className="workspace-error" role="alert">{error}</p>}
        </section>
      </div>
    </main>
  );
}
