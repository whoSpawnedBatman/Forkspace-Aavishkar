import type { FieldIssue, SnippetDraft, SnippetFile } from "@/data/snippets/domain";

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const DRIVE_PREFIX = /^[a-z]:/i;

export type NormalizedDraft = {
  title: string;
  files: readonly SnippetFile[];
};

export type ValidationResult = {
  issues: readonly FieldIssue[];
  value?: NormalizedDraft;
};

export function normalizePath(rawPath: string): string | null {
  if (CONTROL_CHARACTERS.test(rawPath)) return null;

  const trimmed = rawPath.trim();
  if (!trimmed) return null;

  const withSlashes = trimmed.replace(/\\/g, "/");
  if (withSlashes.startsWith("/") || DRIVE_PREFIX.test(withSlashes)) return null;

  const segments = withSlashes.split("/");
  if (segments.some((segment) => !segment.trim() || segment === "." || segment === "..")) {
    return null;
  }

  return segments.join("/");
}

export function validateDraft(draft: SnippetDraft): ValidationResult {
  const issues: FieldIssue[] = [];
  const title = draft.title.trim();

  if (!title) {
    issues.push({ field: "title", message: "Add a title for this snippet." });
  }

  if (draft.files.length === 0) {
    issues.push({ field: "files", message: "Add at least one file." });
  }

  const normalizedFiles: SnippetFile[] = [];
  const seen = new Set<string>();

  for (const file of draft.files) {
    const normalized = normalizePath(file.path);
    if (!normalized) {
      issues.push({
        field: "files",
        path: file.path,
        message:
          "Use a relative path with named segments, such as src/main.ts. No leading slash, drive prefix, empty segment, or control character.",
      });
      continue;
    }

    if (seen.has(normalized)) {
      issues.push({
        field: "files",
        path: normalized,
        message: "Each file needs a different path after normalization.",
      });
      continue;
    }

    seen.add(normalized);
    normalizedFiles.push({ ...file, path: normalized });
  }

  if (issues.length > 0) return { issues };

  return {
    issues,
    value: { title, files: normalizedFiles },
  };
}
