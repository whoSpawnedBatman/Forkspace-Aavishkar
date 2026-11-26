import { AdapterError, type SnippetAdapter } from "@/data/snippets/domain";

export type SnippetsMode = "demo" | "live";

export function getMode(): SnippetsMode {
  return process.env.NEXT_PUBLIC_SNIPPETS_MODE === "live" ? "live" : "demo";
}

let demoAdapter: Promise<SnippetAdapter> | null = null;

export async function getAdapter(): Promise<SnippetAdapter> {
  if (getMode() === "live") {
    throw new AdapterError({
      code: "unavailable",
      message:
        "Live mode is not configured. The approved contract and integration settings are required before this build can read or save snippets.",
    });
  }

  if (!demoAdapter) {
    demoAdapter = import("@/data/snippets/demo/adapter").then((module) =>
      module.createDemoAdapter(),
    );
  }

  return demoAdapter;
}
