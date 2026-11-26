import type { Metadata } from "next";
import { Suspense } from "react";

import { SnippetReader } from "@/features/snippets/SnippetReader";

export const metadata: Metadata = {
  title: "Read a snippet",
};

export default async function SnippetPage({
  params,
}: {
  params: Promise<{ snippetId: string }>;
}) {
  const { snippetId } = await params;

  return (
    <Suspense
      fallback={
        <main className="site-shell flex min-h-dvh items-center justify-center text-sm text-slate-400">
          Loading snippet…
        </main>
      }
    >
      <SnippetReader snippetId={snippetId} />
    </Suspense>
  );
}
