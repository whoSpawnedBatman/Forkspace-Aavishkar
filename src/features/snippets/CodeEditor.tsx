"use client";

import * as React from "react";
import dynamic from "next/dynamic";

const MonacoEditor = dynamic(
  () => import("@/features/snippets/MonacoEditorClient").then((module) => module.MonacoEditorClient),
  { ssr: false, loading: () => <div className="p-5 text-sm text-slate-400">Loading editor…</div> },
);

type Props = {
  fileId: string;
  path: string;
  language: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
};

type BoundaryState = { failed: boolean };

class MonacoBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  BoundaryState
> {
  override state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function subscribeToViewport(onChange: () => void) {
  const media = window.matchMedia("(max-width: 639px)");
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function getNarrowViewport() {
  return window.matchMedia("(max-width: 639px)").matches;
}

export function CodeEditor({ fileId, path, language, value, disabled, onChange }: Props) {
  const isNarrow = React.useSyncExternalStore(subscribeToViewport, getNarrowViewport, () => true);
  const [monacoOverride, setMonacoOverride] = React.useState<boolean | null>(null);
  const useMonaco = monacoOverride ?? !isNarrow;

  const textarea = (
    <textarea
      aria-label={`Code for ${path || "untitled file"}`}
      className="min-h-[320px] w-full resize-y bg-[#111c2f] p-5 font-mono text-[13px] leading-[1.65] text-slate-100 outline-none placeholder:text-slate-500 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-300 disabled:opacity-70 sm:min-h-[420px]"
      spellCheck={false}
      autoCapitalize="off"
      autoComplete="off"
      autoCorrect="off"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Write or paste code here…"
    />
  );

  return (
    <div>
      {useMonaco ? (
        <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-[#111c2f] px-4 py-2">
          <p className="text-xs text-slate-400">Monaco editor · Press Tab to enter the editor</p>
          <button
            type="button"
            className="min-h-9 rounded-md px-2 text-xs font-medium text-blue-200 hover:bg-white/10"
            onClick={() => setMonacoOverride(false)}
          >
            Use plain editor
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-[#111c2f] px-4 py-2">
          <p className="text-xs text-slate-400">
            {isNarrow ? "Plain editor · Touch friendly" : "Plain text editor"}
          </p>
          {!isNarrow ? (
            <button
              type="button"
              className="min-h-9 rounded-md px-2 text-xs font-medium text-blue-200 hover:bg-white/10"
              onClick={() => setMonacoOverride(true)}
            >
              Try Monaco editor
            </button>
          ) : null}
        </div>
      )}
      <div className="min-h-[320px] sm:min-h-[420px]">
        {useMonaco ? (
          <MonacoBoundary
            fallback={
              <div>
                <p role="status" className="bg-[#111c2f] px-4 py-2 text-xs text-amber-200">
                  Monaco couldn’t load. The plain editor is available below.
                </p>
                {textarea}
              </div>
            }
          >
            <MonacoEditor
              path={fileId}
              language={language}
              value={value}
              disabled={disabled}
              onChange={onChange}
            />
          </MonacoBoundary>
        ) : (
          textarea
        )}
      </div>
    </div>
  );
}
