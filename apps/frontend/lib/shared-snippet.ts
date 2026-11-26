export function sharedSnippetId() {
  const id = new URLSearchParams(window.location.search).get("snippet");
  return id && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id) ? id : null;
}

export function withSharedSnippet(path: string) {
  const id = sharedSnippetId();
  return id ? `${path}?snippet=${id}` : path;
}
