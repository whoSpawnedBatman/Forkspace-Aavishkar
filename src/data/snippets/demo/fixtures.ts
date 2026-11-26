import type { Snippet } from "@/data/snippets/domain";
import { languageFromPath } from "@/data/snippets/language";

const MAIN_TEXT = `import { formatLine, type Line } from "./format";

const lines: Line[] = [
  { label: "render", ms: 12.4 },
  { label: "hydrate", ms: 8.1 },
  { label: "idle", ms: 31.7 },
];

for (const line of lines) {
  console.log(formatLine(line));
}
`;

const FORMAT_TEXT = `export type Line = { label: string; ms: number };

export function formatLine({ label, ms }: Line): string {
  const rounded = ms.toFixed(1);
  return \`\${label.padEnd(10)} \${rounded}ms\`;
}
`;

const README_TEXT = `# Timed startup lines

A three-file example: a tiny formatter, its caller, and the note that ties them together.

Run with \`npx tsx src/main.ts\` if you have \`tsx\` installed.
`;

const RETRY_TEXT = `type Task<T> = () => Promise<T>;

export async function withRetry<T>(
  task: Task<T>,
  attempts = 3,
  delayMs = 200,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    }
  }

  throw lastError;
}
`;

const USERS_TEXT = `import { withRetry } from "./retry";

export type User = { id: string; name: string };

export function getUser(id: string): Promise<User> {
  return withRetry(async () => {
    const response = await fetch(\`/api/users/\${encodeURIComponent(id)}\`);
    if (!response.ok) throw new Error(\`Request failed: \${response.status}\`);
    return (await response.json()) as User;
  });
}
`;

export const SEED_SNIPPETS: readonly Snippet[] = [
  {
    id: "seed-timed-lines",
    title: "Timed startup lines",
    fileCount: 3,
    files: [
      { path: "src/main.ts", language: "typescript", text: MAIN_TEXT },
      { path: "src/format.ts", language: "typescript", text: FORMAT_TEXT },
      { path: "README.md", language: "markdown", text: README_TEXT },
    ],
  },
  {
    id: "seed-retry-fetch",
    title: "Retrying fetch helper",
    fileCount: 2,
    files: [
      { path: "api/retry.ts", language: "typescript", text: RETRY_TEXT },
      { path: "api/users.ts", language: "typescript", text: USERS_TEXT },
    ],
  },
];

export function cloneSeedSnippets(): Snippet[] {
  return SEED_SNIPPETS.map((snippet) => ({
    ...snippet,
    files: snippet.files.map((file) => ({ ...file })),
  }));
}

export function examplePreview() {
  const snippet = SEED_SNIPPETS[0];
  if (!snippet) throw new Error("Seed fixture is missing its three-file example");
  return snippet;
}

export function inferLanguage(path: string): string | undefined {
  return languageFromPath(path);
}
