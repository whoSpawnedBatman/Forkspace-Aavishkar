"use client";

import * as React from "react";

const SUPPORTED_LANGUAGES = [
  "typescript",
  "tsx",
  "javascript",
  "jsx",
  "json",
  "markdown",
  "css",
  "html",
  "python",
  "bash",
  "yaml",
  "sql",
] as const;

type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
type ShikiHighlighter = Awaited<ReturnType<typeof loadHighlighter>>;

let highlighterPromise: Promise<ShikiHighlighter> | undefined;

function isSupportedLanguage(language: string | undefined): language is SupportedLanguage {
  return SUPPORTED_LANGUAGES.some((supported) => supported === language);
}

async function loadHighlighter() {
  const { createHighlighter } = await import("shiki");
  return createHighlighter({
    themes: ["github-dark"],
    langs: [...SUPPORTED_LANGUAGES],
  });
}

function getHighlighter() {
  highlighterPromise ??= loadHighlighter();
  return highlighterPromise;
}

export function CodeViewer({
  path,
  language,
  text,
}: {
  path: string;
  language: string | undefined;
  text: string;
}) {
  const [highlightResult, setHighlightResult] = React.useState<{
    language: string;
    text: string;
    lines: React.ReactNode[][];
    failed: boolean;
  } | null>(null);
  const supported = isSupportedLanguage(language);
  const currentHighlight =
    highlightResult && highlightResult.language === language && highlightResult.text === text
      ? highlightResult
      : null;

  React.useEffect(() => {
    let active = true;
    if (supported && language) {
      void getHighlighter()
        .then((highlighter) =>
          highlighter.codeToTokens(text, { lang: language, theme: "github-dark" }),
        )
        .then((result) => {
          if (!active) return;
          setHighlightResult({
            language,
            text,
            failed: false,
            lines: result.tokens.map((line, lineIndex) =>
              line.map((token, tokenIndex) => (
                <span
                  key={`${lineIndex}-${tokenIndex}`}
                  style={token.color ? { color: token.color } : undefined}
                >
                  {token.content}
                </span>
              )),
            ),
          });
        })
        .catch(() => {
          if (active) setHighlightResult({ language, text, lines: [], failed: true });
        });
    }

    return () => {
      active = false;
    };
  }, [language, supported, text]);

  return (
    <div className="relative min-h-[360px] overflow-auto bg-[#111c2f] sm:min-h-[480px]">
      <pre
        aria-label={`Code for ${path}`}
        className="min-h-[360px] min-w-max p-5 font-mono text-[13px] leading-[1.65] text-slate-100 selection:bg-blue-500/40 sm:min-h-[480px] sm:p-6"
      >
        <code>
          {currentHighlight?.lines.length
            ? currentHighlight.lines.map((line, index) => (
                <React.Fragment key={index}>
                  {line}
                  {index < currentHighlight.lines.length - 1 ? "\n" : ""}
                </React.Fragment>
              ))
            : text}
        </code>
      </pre>
      {!supported || currentHighlight?.failed ? (
        <span className="absolute right-4 top-4 rounded-full border border-white/15 bg-[#1a2941] px-2.5 py-1 text-[11px] font-medium text-slate-300">
          Plain text
        </span>
      ) : null}
    </div>
  );
}
