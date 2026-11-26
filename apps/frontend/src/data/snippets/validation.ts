import type { FieldIssue, SnippetDraft, SnippetFile } from './domain';

const CONTROL_CHAR_REGEX = /[\u0000-\u001F\u007F]/;
const DRIVE_PREFIX_REGEX = /^[a-zA-Z]:/;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  ts: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'jsx',
  json: 'json',
  css: 'css',
  scss: 'css',
  html: 'html',
  htm: 'html',
  md: 'markdown',
  markdown: 'markdown',
  yml: 'yaml',
  yaml: 'yaml',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  py: 'python',
  sql: 'sql',
  dockerfile: 'dockerfile',
  conf: 'nginx',
  env: 'bash',
  toml: 'yaml',
  xml: 'html',
  svg: 'html',
  go: 'go',
  rs: 'rust',
};

export function detectLanguageFromPath(path: string): string {
  const normalized = path.trim().toLowerCase();
  const baseName = normalized.split('/').pop() ?? normalized;

  if (baseName === 'dockerfile' || baseName.startsWith('dockerfile.')) {
    return 'dockerfile';
  }
  if (baseName === '.env' || baseName.startsWith('.env.')) {
    return 'bash';
  }
  const dotIndex = baseName.lastIndexOf('.');
  if (dotIndex === -1 || dotIndex === baseName.length - 1) {
    return 'text';
  }
  const ext = baseName.slice(dotIndex + 1);
  return EXTENSION_LANGUAGE_MAP[ext] ?? 'text';
}

export function normalizePath(rawPath: string): string {
  return rawPath.trim().replace(/\\/g, '/');
}

export function detectLanguage(path: string, text: string): string {
  const named = detectLanguageFromPath(path);
  if (named !== 'text') return named;
  const sample = text.slice(0, 8000);
  if (/^\s*(?:<!doctype html|<html|<div|<script)\b/im.test(sample)) return 'html';
  if (/^\s*(?:def \w+\(|from \w+ import )/m.test(sample)) return 'python';
  if (/\b(?:interface \w+\s*\{|type \w+\s*=)/.test(sample)) return 'typescript';
  if (/\b(?:const|let|function)\s+\w+/.test(sample)) return 'javascript';
  if (/^\s*(?:SELECT .+ FROM|CREATE TABLE|INSERT INTO)\b/im.test(sample)) return 'sql';
  if (/^\s*FROM\s+\S+/m.test(sample)) return 'dockerfile';
  if (/^#!.*\b(?:bash|sh)\b/.test(sample)) return 'bash';
  if (/^\s*package \w+/m.test(sample) && /\bfunc\s/.test(sample)) return 'go';
  if (/\bfn\s+\w+\s*\(/.test(sample)) return 'rust';
  return 'text';
}

export function validateNormalizedPath(rawPath: string): string | null {
  const trimmed = rawPath.trim();
  if (!trimmed) {
    return 'Enter a relative file path (for example, src/main.ts).';
  }
  if (CONTROL_CHAR_REGEX.test(trimmed)) {
    return 'File path cannot contain control characters.';
  }
  const normalized = trimmed.replace(/\\/g, '/');
  if (normalized.startsWith('/')) {
    return 'Use a relative path without a leading slash.';
  }
  if (DRIVE_PREFIX_REGEX.test(normalized)) {
    return 'Drive-prefixed or absolute paths are not allowed.';
  }
  if (normalized.endsWith('/')) {
    return 'File path cannot end with a slash.';
  }
  const segments = normalized.split('/');
  for (const segment of segments) {
    if (segment === '') {
      return 'File path cannot contain empty path segments.';
    }
    if (segment === '.' || segment === '..') {
      return 'File path cannot contain "." or ".." segments.';
    }
  }
  if (normalized.length > 180) {
    return 'File path must be 180 characters or fewer.';
  }
  return null;
}

export function normalizeTag(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);
}

export function normalizeTags(rawTags: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of rawTags) {
    const clean = normalizeTag(raw);
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      result.push(clean);
    }
  }
  return result.slice(0, 10);
}

export function parseTagsInput(value: string): string[] {
  return normalizeTags(value.split(/[,\s]+/));
}

export interface ValidatedDraftResult {
  readonly ok: boolean;
  readonly issues: readonly FieldIssue[];
  readonly normalizedDraft?: SnippetDraft;
}

export function validateSnippetDraft(draft: SnippetDraft): ValidatedDraftResult {
  const issues: FieldIssue[] = [];
  const trimmedTitle = draft.title.trim();

  if (!trimmedTitle) {
    issues.push({
      field: 'title',
      message: 'Enter a snippet title before saving.',
    });
  } else if (trimmedTitle.length > 120) {
    issues.push({
      field: 'title',
      message: 'Title must be 120 characters or fewer.',
    });
  }

  if (!draft.files || draft.files.length === 0) {
    issues.push({
      field: 'files',
      message: 'Add at least one file to the snippet.',
    });
  }

  const seenPaths = new Set<string>();
  const normalizedFiles: SnippetFile[] = [];

  draft.files.forEach((file, index) => {
    const normalized = normalizePath(file.path);
    const pathError = validateNormalizedPath(file.path);

    if (pathError) {
      issues.push({
        field: 'files',
        path: normalized,
        fileIndex: index,
        message: pathError,
      });
    } else if (seenPaths.has(normalized)) {
      issues.push({
        field: 'files',
        path: normalized,
        fileIndex: index,
        message: `Duplicate path "${normalized}". Each file path must be unique.`,
      });
    } else {
      seenPaths.add(normalized);
    }

    normalizedFiles.push({
      path: normalized,
      language: detectLanguage(normalized, file.text),
      text: file.text,
    });
    if (new TextEncoder().encode(file.text).byteLength > MAX_FILE_BYTES) {
      issues.push({ field: 'files', path: normalized, fileIndex: index, message: 'File must be 5 MiB or smaller.' });
    }
  });

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    issues: [],
    normalizedDraft: {
      title: trimmedTitle,
      description: draft.description?.trim() || undefined,
      visibility: draft.visibility,
      linkExpiry: draft.linkExpiry,
      tags: normalizeTags(draft.tags),
      files: normalizedFiles,
    },
  };
}
