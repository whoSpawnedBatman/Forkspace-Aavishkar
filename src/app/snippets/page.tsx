"use client";

import Link from "next/link";
import { AlertCircle, FileCode2, Plus, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { failureOf } from "@/data/snippets/domain";
import { SnippetHeader } from "@/features/snippets/SnippetHeader";
import { useSnippetList } from "@/features/snippets/queries";

export default function SnippetsPage() {
  const snippets = useSnippetList();
  const items = snippets.data ?? [];

  return (
    <div className="site-shell">
      <SnippetHeader />
      <main id="main-content" className="mx-auto w-full max-w-[1120px] px-4 py-10 sm:px-8 sm:py-14">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="site-accent font-mono text-[11px] font-semibold uppercase tracking-[0.16em]">
              {"// Your library"}
            </p>
            <h1 className="site-title mt-2 text-3xl font-semibold tracking-[-0.03em]">
              Snippets
            </h1>
            <p className="site-muted mt-2 max-w-[60ch] text-sm leading-6">
              Browse your saved multi-file examples.
            </p>
          </div>
          <Button asChild className="site-primary h-11 border px-4">
            <Link href="/snippets/new">
              <Plus aria-hidden="true" />
              Create snippet
            </Link>
          </Button>
        </div>

        <section aria-labelledby="snippet-list-heading" className="mt-8">
          <h2 id="snippet-list-heading" className="sr-only">
            Snippet library
          </h2>
          {snippets.isPending ? (
            <div
              role="status"
              className="site-panel rounded-xl border p-6 text-sm"
            >
              <span className="site-muted">
              Loading snippets…
              </span>
            </div>
          ) : snippets.isError ? (
            <div role="alert" className="site-error rounded-xl border p-6">
              <div className="flex items-start gap-3">
                <AlertCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
                <div>
                  <h3 className="font-semibold">Couldn’t load your snippets</h3>
                  <p className="mt-1 text-sm leading-6">
                    {failureOf(snippets.error).message ?? "Please try again."}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="site-secondary mt-4 border"
                    onClick={() => void snippets.refetch()}
                    disabled={snippets.isFetching}
                  >
                    <RefreshCw aria-hidden="true" />
                    {snippets.isFetching ? "Trying again…" : "Retry"}
                  </Button>
                </div>
              </div>
            </div>
          ) : items.length === 0 ? (
            <div className="site-panel rounded-xl border border-dashed px-6 py-14 text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-xl border border-[#3b3155] bg-[#211b31] text-[#c7a8ff]">
                <FileCode2 aria-hidden="true" className="size-5" />
              </div>
              <h3 className="site-title mt-4 text-lg font-semibold">No snippets yet</h3>
              <p className="site-muted mt-2 text-sm">
                Start with a title and add the files that make up your example.
              </p>
              <Button asChild className="site-primary mt-5 border">
                <Link href="/snippets/new">
                  <Plus aria-hidden="true" />
                  Create snippet
                </Link>
              </Button>
            </div>
          ) : (
            <ul className="site-panel divide-y overflow-hidden rounded-xl border">
              {items.map((snippet) => (
                <li key={snippet.id} className="site-divider border-b last:border-b-0">
                  <Link
                    href={`/snippets/${encodeURIComponent(snippet.id)}`}
                    className="site-row flex min-h-[76px] flex-wrap items-center justify-between gap-4 px-5 py-5 outline-none transition-colors sm:px-6"
                  >
                    <span className="flex min-w-0 items-center gap-4">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-[#37304d] bg-[#211b31] text-[#c7a8ff]">
                        <FileCode2 aria-hidden="true" className="size-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="site-title block truncate text-base font-semibold">
                          {snippet.title}
                        </span>
                        <span className="site-muted mt-1 block font-mono text-xs">
                          {snippet.fileCount} {snippet.fileCount === 1 ? "file" : "files"}
                        </span>
                      </span>
                    </span>
                    <span className="site-muted shrink-0 font-mono text-xs">
                      <span className="site-accent mr-2">↗</span>
                      Open
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
