import type { Metadata } from "next";

import { SnippetComposer } from "@/features/snippets/SnippetComposer";

export const metadata: Metadata = {
  title: "Create a snippet",
};

export default function NewSnippetPage() {
  return <SnippetComposer />;
}
