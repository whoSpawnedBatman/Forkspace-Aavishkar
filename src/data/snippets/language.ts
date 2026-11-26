const EXTENSION_LANGUAGES: Readonly<Record<string, string>> = {
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  mjs: "javascript",
  cjs: "javascript",
  json: "json",
  md: "markdown",
  css: "css",
  html: "html",
  htm: "html",
  py: "python",
  go: "go",
  rs: "rust",
  sh: "bash",
  yml: "yaml",
  yaml: "yaml",
  sql: "sql",
};

export function languageFromPath(path: string): string | undefined {
  const fileName = path.split("/").at(-1) ?? "";
  const dot = fileName.lastIndexOf(".");
  if (dot < 1) return undefined;
  return EXTENSION_LANGUAGES[fileName.slice(dot + 1).toLowerCase()];
}
