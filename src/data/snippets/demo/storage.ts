import { AdapterError, type Snippet, type SnippetFile } from "@/data/snippets/domain";
import { cloneSeedSnippets } from "@/data/snippets/demo/fixtures";

const STORAGE_KEY = "snippets-demo:v1";

type StoredState = {
  version: 1;
  snippets: Snippet[];
};

function unreadable(): AdapterError {
  return new AdapterError({
    code: "unavailable",
    message:
      "Demo storage could not be read. Reset the demo data in the library to start from the seed fixtures.",
  });
}

function parseFile(value: unknown): SnippetFile {
  if (typeof value !== "object" || value === null) throw unreadable();
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.path !== "string" ||
    typeof candidate.text !== "string" ||
    (candidate.language !== undefined && typeof candidate.language !== "string")
  ) {
    throw unreadable();
  }
  return {
    path: candidate.path,
    text: candidate.text,
    ...(typeof candidate.language === "string" ? { language: candidate.language } : {}),
  };
}

function parseState(value: unknown): StoredState {
  if (typeof value !== "object" || value === null) throw unreadable();
  const candidate = value as Record<string, unknown>;
  if (candidate.version !== 1 || !Array.isArray(candidate.snippets)) throw unreadable();

  const snippets: Snippet[] = candidate.snippets.map((entry: unknown) => {
    if (typeof entry !== "object" || entry === null) throw unreadable();
    const record = entry as Record<string, unknown>;
    if (
      typeof record.id !== "string" ||
      typeof record.title !== "string" ||
      typeof record.fileCount !== "number" ||
      !Array.isArray(record.files)
    ) {
      throw unreadable();
    }
    const files = record.files.map(parseFile);
    if (files.length !== record.fileCount) throw unreadable();
    return { id: record.id, title: record.title, fileCount: files.length, files };
  });

  return { version: 1, snippets };
}

export function writeDemoStore(state: StoredState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    throw new AdapterError({
      code: "unavailable",
      message:
        "The browser blocked demo storage. Your draft is still here. Allow local storage or reset the demo data, then save again.",
    });
  }
}

export function readDemoStore(): StoredState {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    throw unreadable();
  }

  if (raw === null) {
    const seeded: StoredState = { version: 1, snippets: cloneSeedSnippets() };
    writeDemoStore(seeded);
    return seeded;
  }

  try {
    return parseState(JSON.parse(raw) as unknown);
  } catch {
    throw unreadable();
  }
}

export function resetDemoStore(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    throw unreadable();
  }
}
