import {
  AdapterError,
  type CreateReceipt,
  type Snippet,
  type SnippetAdapter,
  type SnippetDraft,
  type SnippetSummary,
} from "@/data/snippets/domain";
import { createDemoId, delay } from "@/data/snippets/demo/async";
import { inferLanguage } from "@/data/snippets/demo/fixtures";
import { getScenario } from "@/data/snippets/demo/scenarios";
import { readDemoStore, writeDemoStore } from "@/data/snippets/demo/storage";
import { validateDraft } from "@/data/snippets/validation";

const READ_DELAY_MS = 220;
const SLOW_READ_DELAY_MS = 1_400;
const WRITE_DELAY_MS = 340;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createDemoAdapter(): SnippetAdapter {
  return {
    async list(input = {}): Promise<readonly SnippetSummary[]> {
      const scenario = getScenario();
      await delay(scenario === "slow" ? SLOW_READ_DELAY_MS : READ_DELAY_MS, input.signal);
      const state = readDemoStore();

      if (scenario === "read-failure") {
        throw new AdapterError({
          code: "unavailable",
          message: "The active demo scenario blocked this read. Clear the scenario and retry.",
        });
      }

      if (scenario === "empty") return [];

      return state.snippets.map((snippet) => ({
        id: snippet.id,
        title: snippet.title,
        fileCount: snippet.fileCount,
      }));
    },

    async read(id, input = {}): Promise<Snippet> {
      const scenario = getScenario();
      await delay(scenario === "slow" ? SLOW_READ_DELAY_MS : READ_DELAY_MS, input.signal);
      const state = readDemoStore();

      if (scenario === "read-failure") {
        throw new AdapterError({
          code: "unavailable",
          message: "The active demo scenario blocked this read. Clear the scenario and retry.",
        });
      }

      if (scenario === "missing-detail") {
        throw new AdapterError({
          code: "missing",
          message: "This snippet is not in the active demo scenario.",
        });
      }

      const found = state.snippets.find((snippet) => snippet.id === id);
      if (!found) {
        throw new AdapterError({
          code: "missing",
          message: "This snippet is not in this browser's demo data.",
        });
      }

      return clone(found);
    },

    async create(draft: SnippetDraft): Promise<CreateReceipt> {
      await delay(WRITE_DELAY_MS);

      if (getScenario() === "write-failure") {
        throw new AdapterError({
          code: "unknown",
          message:
            "The active demo scenario rejected this save. Your title, files, and code are still here.",
        });
      }

      const validated = validateDraft(draft);
      if (!validated.value) {
        throw new AdapterError({ code: "invalid", fieldIssues: validated.issues });
      }

      const state = readDemoStore();
      const snippet: Snippet = {
        id: createDemoId(),
        title: validated.value.title,
        fileCount: validated.value.files.length,
        files: validated.value.files.map((file) => ({
          ...file,
          language: file.language ?? inferLanguage(file.path),
        })),
      };

      const next = { version: 1 as const, snippets: [snippet, ...state.snippets] };
      writeDemoStore(next);

      return { id: snippet.id, snippet: clone(snippet) };
    },
  };
}
