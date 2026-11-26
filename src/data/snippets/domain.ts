export type SnippetSummary = {
  id: string;
  title: string;
  fileCount: number;
};

export type SnippetFile = {
  path: string;
  language?: string;
  text: string;
};

export type Snippet = SnippetSummary & {
  files: readonly SnippetFile[];
};

export type SnippetDraft = {
  title: string;
  files: readonly SnippetFile[];
};

export type FailureCode =
  | "missing"
  | "unauthenticated"
  | "forbidden"
  | "invalid"
  | "conflict"
  | "unavailable"
  | "unknown"
  | "save-unconfirmed";

export type FieldIssue = {
  field: "title" | "files";
  path?: string;
  message: string;
};

export type Failure = {
  code: FailureCode;
  message?: string;
  fieldIssues?: ReadonlyArray<FieldIssue>;
};

export interface SnippetAdapter {
  list(input?: { signal?: AbortSignal }): Promise<readonly SnippetSummary[]>;
  read(id: string, input?: { signal?: AbortSignal }): Promise<Snippet>;
  create(draft: SnippetDraft): Promise<CreateReceipt>;
}

export type CreateReceipt = {
  id: string;
  snippet?: Snippet;
};

export class AdapterError extends Error {
  readonly failure: Failure;

  constructor(failure: Failure) {
    super(failure.message ?? failure.code);
    this.name = "AdapterError";
    this.failure = failure;
  }
}

export function isAdapterError(error: unknown): error is AdapterError {
  return error instanceof AdapterError;
}

export function failureOf(error: unknown): Failure {
  if (isAdapterError(error)) return error.failure;
  return { code: "unknown", message: "Something went wrong. Please try again." };
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
