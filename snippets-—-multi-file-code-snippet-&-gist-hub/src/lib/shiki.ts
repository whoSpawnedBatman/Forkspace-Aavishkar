import { createHighlighter, type Highlighter, type ThemedToken } from 'shiki';

const SUPPORTED_LANGS = [
  'typescript',
  'tsx',
  'javascript',
  'jsx',
  'json',
  'css',
  'html',
  'markdown',
  'yaml',
  'bash',
  'python',
  'sql',
  'dockerfile',
  'nginx',
  'go',
  'rust',
] as const;

type SupportedLang = (typeof SUPPORTED_LANGS)[number];

const THEME_NAME = 'github-dark-default';
// Documented frontend performance threshold: fallback to escaped plain text above 80 KB
export const SHIKI_MAX_BYTES = 80_000;

let highlighterPromise: Promise<Highlighter> | null = null;

function isSupportedLang(lang: string): lang is SupportedLang {
  return (SUPPORTED_LANGS as readonly string[]).includes(lang);
}

function getSharedHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: [THEME_NAME],
      langs: [...SUPPORTED_LANGS],
    }).catch((err) => {
      highlighterPromise = null;
      throw err;
    });
  }
  return highlighterPromise;
}

export interface HighlightResult {
  readonly highlighted: boolean;
  readonly languageLabel: string;
  readonly lines: ReadonlyArray<ReadonlyArray<{ content: string; color?: string }>>;
}

function plainTextLines(code: string): HighlightResult {
  const split = code.split(/\r?\n/);
  return {
    highlighted: false,
    languageLabel: 'Plain text',
    lines: split.map((line) => [{ content: line }]),
  };
}

export async function highlightCodeSafely(
  code: string,
  language?: string,
): Promise<HighlightResult> {
  const normalizedLang = (language ?? 'text').toLowerCase().trim();
  if (!code) {
    return {
      highlighted: false,
      languageLabel: normalizedLang === 'text' ? 'Plain text' : normalizedLang,
      lines: [[{ content: '' }]],
    };
  }

  if (code.length > SHIKI_MAX_BYTES || !isSupportedLang(normalizedLang)) {
    return plainTextLines(code);
  }

  try {
    const highlighter = await getSharedHighlighter();
    const { tokens } = highlighter.codeToTokens(code, {
      lang: normalizedLang,
      theme: THEME_NAME,
    });
    const safeLines = tokens.map((line: ThemedToken[]) =>
      line.map((token) => ({
        content: token.content,
        color: token.color,
      })),
    );
    return {
      highlighted: true,
      languageLabel: normalizedLang,
      lines: safeLines,
    };
  } catch {
    return plainTextLines(code);
  }
}
