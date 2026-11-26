import Link from "next/link";

import { Button } from "@/components/ui/button";
import { SnippetHeader } from "@/features/snippets/SnippetHeader";
import { getMode } from "@/data/snippets/adapter";
import { examplePreview } from "@/data/snippets/demo/fixtures";

export const metadata = {
  title: "Snip it — Multi-file snippets",
};

export default function HomePage() {
  const demoMode = getMode() === "demo";
  const preview = demoMode ? examplePreview() : null;
  const previewFile = preview?.files[0];

  return (
    <div className="site-shell">
      <SnippetHeader />
      <main
        id="main-content"
        className="mx-auto grid min-h-[calc(100dvh-73px)] w-full max-w-[1200px] items-center gap-12 px-4 py-14 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:py-16"
      >
        <section className="max-w-[540px]">
          <div className="flex flex-wrap items-center gap-3">
            <p className="site-accent font-mono text-[11px] font-semibold uppercase tracking-[0.16em]">
              Multi-file snippets
            </p>
            <span className="site-tag inline-flex rounded-md border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em]">
              Local demo
            </span>
          </div>
          <h1 className="site-title mt-7 font-sans text-[clamp(2.4rem,5vw,4rem)] font-semibold leading-[1.04] tracking-[-0.065em]">
            Keep your best
            <br />
            <span className="text-slate-400">code close.</span>
          </h1>
          <p className="site-muted mt-6 max-w-[48ch] text-base leading-7 sm:text-lg">
            Save the small pieces of code you reach for. Keep every file together, then find it
            when the next project needs it.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="site-primary h-12 border px-5">
              <Link href="/snippets/new">Create snippet</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="site-secondary h-12 border px-5"
            >
              <Link href="/snippets">Browse snippets</Link>
            </Button>
          </div>
        </section>

        {preview ? (
          <section
            aria-labelledby="example-heading"
            className="site-panel overflow-hidden rounded-xl border p-3 shadow-[0_28px_90px_rgba(0,0,0,0.38)] sm:p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-3">
              <div>
                <p className="site-accent font-mono text-[10px] font-semibold uppercase tracking-[0.16em]">
                  Example snippet · Demo data
                </p>
                <h2 id="example-heading" className="site-title mt-1 text-base font-semibold">
                  {preview.title}
                </h2>
              </div>
              <span className="site-muted rounded-md border border-[#2b3041] px-2.5 py-1 font-mono text-[11px]">
                {preview.files.length} files
              </span>
            </div>
            <div className="overflow-hidden rounded-lg border border-[#282d3c] bg-[#0b0e15]">
              <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
                <span aria-hidden="true" className="size-2.5 rounded-full bg-[#f26c73]" />
                <span aria-hidden="true" className="size-2.5 rounded-full bg-[#e8bd54]" />
                <span aria-hidden="true" className="size-2.5 rounded-full bg-[#5fc990]" />
                <span className="ml-3 font-mono text-[11px] text-slate-500">
                  {preview.title.toLowerCase().replaceAll(" ", "-")}
                </span>
              </div>
              <div className="flex min-w-max items-center gap-1 border-b border-white/10 px-2 pt-2">
                {preview.files.map((file, index) => (
                  <span
                    key={file.path}
                    className={`rounded-t-lg px-3 py-2 font-mono text-xs ${
                      index === 0
                        ? "border-b-2 border-[#a889f3] bg-[#171525] text-white"
                        : "text-slate-500"
                    }`}
                  >
                    {file.path}
                  </span>
                ))}
              </div>
              <pre className="max-h-[360px] min-h-[260px] overflow-auto p-5 font-mono text-[13px] leading-6 text-slate-200 sm:p-6">
                <code>{previewFile?.text}</code>
              </pre>
              <div className="site-code-chrome flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3 sm:px-6">
                <p className="site-muted font-mono text-[11px]">Every file, kept together.</p>
                <Link
                  href={`/snippets/${encodeURIComponent(preview.id)}`}
                  className="site-accent min-h-10 content-center rounded-md px-2 text-sm font-medium hover:text-white"
                >
                  Open example
                </Link>
              </div>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
