"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowLeft, Copy, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { failureOf } from "@/data/snippets/domain";
import { languageFromPath } from "@/data/snippets/language";
import { CodeViewer } from "@/features/snippets/CodeViewer";
import { SnippetHeader } from "@/features/snippets/SnippetHeader";
import { useSnippet } from "@/features/snippets/queries";

export function SnippetReader({ snippetId }: { snippetId: string }) {
  const snippetQuery = useSnippet(snippetId);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [copyStatus, setCopyStatus] = React.useState("");
  const fileButtons = React.useRef(new Map<string, HTMLButtonElement>());
  const snippet = snippetQuery.data;
  const requestedFile = searchParams.get("file");
  const activeFile = snippet?.files.find((file) => file.path === requestedFile) ?? snippet?.files[0];
  const selectedFileIndex = activeFile ? snippet?.files.indexOf(activeFile) ?? -1 : -1;

  const selectFile = (filePath: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("file", filePath);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    setCopyStatus("");
  };

  const copyCode = async () => {
    if (!activeFile) return;
    try {
      await navigator.clipboard.writeText(activeFile.text);
      setCopyStatus("Copied code to clipboard.");
    } catch {
      setCopyStatus("Couldn’t copy. Select the code and copy it manually.");
    }
  };

  const handleFileKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!snippet || (event.key !== "ArrowDown" && event.key !== "ArrowUp")) return;
    event.preventDefault();
    const nextIndex =
      (index + (event.key === "ArrowDown" ? 1 : snippet.files.length - 1)) % snippet.files.length;
    const nextFile = snippet.files[nextIndex];
    if (!nextFile) return;
    selectFile(nextFile.path);
    fileButtons.current.get(nextFile.path)?.focus();
  };

  return (
    <div className="site-shell">
      <SnippetHeader />
      <main id="main-content" className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-8 sm:py-10">
        <Link
          href="/snippets"
          className="site-nav-link inline-flex min-h-10 items-center gap-2 rounded-md pr-2 text-sm font-medium"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Browse snippets
        </Link>

        {snippetQuery.isPending ? (
          <div
            role="status"
            className="site-panel site-muted mt-5 rounded-xl border p-6 text-sm"
          >
            Loading snippet…
          </div>
        ) : snippetQuery.isError ? (
          <section
            role="alert"
            className="site-panel mt-5 rounded-xl border p-6 sm:p-8"
          >
            <div className="flex items-start gap-3">
              <AlertCircle aria-hidden="true" className="site-accent mt-1 size-5 shrink-0" />
              <div>
                <h1 className="site-title text-xl font-semibold">
                  {failureOf(snippetQuery.error).code === "missing"
                    ? "Snippet not found"
                    : "Couldn’t load this snippet"}
                </h1>
                <p className="site-muted mt-2 text-sm leading-6">
                  {failureOf(snippetQuery.error).message ??
                    "This snippet may have been removed or isn’t available right now."}
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  {failureOf(snippetQuery.error).code !== "missing" ? (
                    <Button
                      variant="outline"
                      className="site-secondary border"
                      onClick={() => void snippetQuery.refetch()}
                      disabled={snippetQuery.isFetching}
                    >
                      <RefreshCw aria-hidden="true" />
                      {snippetQuery.isFetching ? "Trying again…" : "Retry"}
                    </Button>
                  ) : null}
                  <Button asChild className="site-primary border">
                    <Link href="/snippets">Back to snippets</Link>
                  </Button>
                </div>
              </div>
            </div>
          </section>
        ) : snippet && activeFile ? (
          <>
            <div className="mb-6 mt-5 flex flex-wrap items-end justify-between gap-4">
              <div className="min-w-0">
                <p className="site-accent font-mono text-[11px] font-semibold uppercase tracking-[0.16em]">
                  {"// Snippet"}
                </p>
                <h1 className="site-title mt-1 break-words text-3xl font-semibold tracking-[-0.03em]">
                  {snippet.title}
                </h1>
                <p className="site-muted mt-2 text-sm">
                  {snippet.files.length} {snippet.files.length === 1 ? "file" : "files"} in this example
                </p>
              </div>
              <Button
                variant="outline"
                className="site-secondary border"
                onClick={copyCode}
              >
                <Copy aria-hidden="true" />
                Copy code
              </Button>
            </div>

            <section
              aria-label="Snippet files and code"
              className="site-panel overflow-hidden rounded-xl border shadow-[0_16px_55px_rgba(0,0,0,0.28)]"
            >
              <div className="grid min-w-0 lg:grid-cols-[230px_minmax(0,1fr)]">
                <aside className="site-panel-soft site-divider border-b p-3 lg:border-b-0 lg:border-r">
                  <label htmlFor="reader-file-select" className="sr-only">
                    Choose a file
                  </label>
                  <select
                    id="reader-file-select"
                    className="site-input min-h-11 w-full rounded-md border px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#52d7e8] lg:hidden"
                    value={activeFile.path}
                    onChange={(event) => selectFile(event.target.value)}
                  >
                    {snippet.files.map((file) => (
                      <option key={file.path} value={file.path}>
                        {file.path}
                      </option>
                    ))}
                  </select>
                  <h2 className="site-muted hidden px-2 py-2 text-xs font-semibold uppercase tracking-wide lg:block">
                    Files
                  </h2>
                  <ul className="hidden space-y-1 lg:block">
                    {snippet.files.map((file, index) => {
                      const selected = file.path === activeFile.path;
                      return (
                        <li key={file.path}>
                          <button
                            ref={(element) => {
                              if (element) fileButtons.current.set(file.path, element);
                              else fileButtons.current.delete(file.path);
                            }}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => selectFile(file.path)}
                            onKeyDown={(event) => handleFileKeyDown(event, index)}
                            className={`min-h-11 w-full truncate rounded-md px-3 text-left font-mono text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700 ${
                              selected
                                ? "site-selected font-semibold"
                                : "site-row text-slate-300 hover:bg-slate-100"
                            }`}
                          >
                            {file.path}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </aside>
                <div className="min-w-0">
                  <div className="site-code-chrome flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
                    <p className="min-w-0 truncate font-mono text-sm text-slate-100">
                      {activeFile.path}
                    </p>
                    <span className="site-tag shrink-0 rounded-md border px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-wide">
                      {languageFromPath(activeFile.path) ?? "Plain text"}
                    </span>
                  </div>
                  <CodeViewer
                    key={activeFile.path}
                    path={activeFile.path}
                    language={languageFromPath(activeFile.path)}
                    text={activeFile.text}
                  />
                </div>
              </div>
            </section>
            <p role="status" aria-live="polite" className="site-muted mt-3 min-h-5 text-sm">
              {copyStatus}
            </p>
            <p className="sr-only">
              File {selectedFileIndex + 1} of {snippet.files.length}.
            </p>
          </>
        ) : null}
      </main>
    </div>
  );
}
