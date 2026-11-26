"use client";

import * as React from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { failureOf } from "@/data/snippets/domain";
import { languageFromPath } from "@/data/snippets/language";
import { normalizePath, validateDraft } from "@/data/snippets/validation";
import { CodeEditor } from "@/features/snippets/CodeEditor";
import { SnippetHeader } from "@/features/snippets/SnippetHeader";
import { useCreateSnippet } from "@/features/snippets/queries";

type DraftFile = {
  id: string;
  path: string;
  text: string;
};

type FileIssue = { id: string; message: string };

export function SnippetComposer() {
  const router = useRouter();
  const createSnippet = useCreateSnippet();
  const [title, setTitle] = React.useState("");
  const [files, setFiles] = React.useState<DraftFile[]>([{ id: "file-1", path: "", text: "" }]);
  const [activeFileId, setActiveFileId] = React.useState("file-1");
  const [titleError, setTitleError] = React.useState("");
  const [fileIssues, setFileIssues] = React.useState<FileIssue[]>([]);
  const [saveError, setSaveError] = React.useState("");
  const [dirty, setDirty] = React.useState(false);
  const [pendingNavigation, setPendingNavigation] = React.useState<string | null>(null);
  const [fileToRemove, setFileToRemove] = React.useState<DraftFile | null>(null);
  const nextFileId = React.useRef(2);
  const titleRef = React.useRef<HTMLInputElement>(null);
  const activePathRef = React.useRef<HTMLInputElement>(null);
  const cancelNavigationFocusRef = React.useRef<HTMLElement | null>(null);
  const fileButtonRefs = React.useRef(new Map<string, HTMLButtonElement>());

  const activeFile = files.find((file) => file.id === activeFileId) ?? files[0];
  const saving = createSnippet.isPending;

  React.useEffect(() => {
    if (!dirty) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [dirty]);

  const updateFile = (fileId: string, update: Partial<Pick<DraftFile, "path" | "text">>) => {
    setFiles((current) =>
      current.map((file) => (file.id === fileId ? { ...file, ...update } : file)),
    );
    setDirty(true);
    setSaveError("");
    setFileIssues((current) => current.filter((issue) => issue.id !== fileId));
  };

  const addFile = () => {
    const file = { id: `file-${nextFileId.current}`, path: "", text: "" };
    nextFileId.current += 1;
    setFiles((current) => [...current, file]);
    setActiveFileId(file.id);
    setDirty(true);
    setSaveError("");
    window.setTimeout(() => activePathRef.current?.focus(), 0);
  };

  const removeFile = (file: DraftFile) => {
    const remaining = files.filter((entry) => entry.id !== file.id);
    if (remaining.length === 0) return;
    setFiles(remaining);
    setFileIssues((current) => current.filter((issue) => issue.id !== file.id));
    setDirty(true);
    setSaveError("");
    if (activeFileId === file.id) {
      const next = remaining[Math.min(files.findIndex((entry) => entry.id === file.id), remaining.length - 1)];
      if (next) {
        setActiveFileId(next.id);
        window.setTimeout(() => fileButtonRefs.current.get(next.id)?.focus(), 0);
      }
    } else {
      window.setTimeout(() => fileButtonRefs.current.get(activeFileId)?.focus(), 0);
    }
    setFileToRemove(null);
  };

  const requestRemoveFile = (file: DraftFile) => {
    if (files.length === 1) return;
    if (file.text.length > 0) {
      setFileToRemove(file);
      return;
    }
    removeFile(file);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    setSaveError("");

    const result = validateDraft({
      title,
      files: files.map(({ path, text }) => ({
        path,
        text,
        ...(languageFromPath(path) ? { language: languageFromPath(path) } : {}),
      })),
    });

    if (!result.value) {
      setTitleError(result.issues.find((issue) => issue.field === "title")?.message ?? "");
      const issues = result.issues
        .filter((issue) => issue.field === "files")
        .flatMap((issue) => {
          const matches = files.filter(
            (file) =>
              file.path === issue.path ||
              (normalizePath(file.path) !== null && normalizePath(file.path) === issue.path),
          );
          return (matches.length ? matches : files.slice(0, 1)).map((file) => ({
            id: file.id,
            message: issue.message,
          }));
        });
      setFileIssues(issues);

      if (result.issues[0]?.field === "title") {
        titleRef.current?.focus();
      } else {
        const firstIssue = issues[0];
        const invalidFile = firstIssue ? files.find((file) => file.id === firstIssue.id) : files[0];
        if (invalidFile) {
          setActiveFileId(invalidFile.id);
          window.setTimeout(() => activePathRef.current?.focus(), 0);
        }
      }
      return;
    }

    setTitleError("");
    setFileIssues([]);
    createSnippet.mutate(result.value, {
      onSuccess: (receipt) => {
        setDirty(false);
        router.push(`/snippets/${encodeURIComponent(receipt.id)}`);
      },
      onError: (error) => {
        const failure = failureOf(error);
        setSaveError(failure.message ?? "The snippet wasn’t saved. Your draft is still here.");
      },
    });
  };

  const handleNavigationCapture = (event: React.MouseEvent<HTMLElement>) => {
    if (!dirty || saving || !(event.target instanceof Element)) return;
    const anchor = event.target.closest("a");
    if (!anchor || anchor.target || anchor.origin !== window.location.origin) return;
    event.preventDefault();
    cancelNavigationFocusRef.current = anchor;
    setPendingNavigation(`${anchor.pathname}${anchor.search}${anchor.hash}`);
  };

  const cancelNavigation = () => {
    setPendingNavigation(null);
    window.setTimeout(() => cancelNavigationFocusRef.current?.focus(), 0);
  };

  const confirmNavigation = () => {
    if (!pendingNavigation) return;
    setDirty(false);
    router.push(pendingNavigation);
    setPendingNavigation(null);
  };

  const issueForActiveFile = activeFile
    ? fileIssues.find((issue) => issue.id === activeFile.id)?.message
    : undefined;

  return (
    <div
      className="site-shell"
      onClickCapture={handleNavigationCapture}
    >
      <SnippetHeader />
      <main id="main-content" className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-8 sm:py-10">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <Link
              href="/snippets"
              className="site-nav-link inline-flex min-h-10 items-center gap-2 rounded-md pr-2 text-sm font-medium"
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              Browse snippets
            </Link>
            <h1 className="site-title mt-4 text-3xl font-semibold tracking-[-0.03em]">
              Create a snippet
            </h1>
            <p className="site-muted mt-2 text-sm">
              Keep related files together in one example.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="site-panel mb-6 flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-end sm:p-5">
            <div className="min-w-0 flex-1">
              <Label htmlFor="snippet-title" className="site-label text-sm font-medium">
                Snippet title
              </Label>
              <Input
                id="snippet-title"
                ref={titleRef}
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setTitleError("");
                  setSaveError("");
                  setDirty(true);
                }}
                disabled={saving}
                placeholder="e.g. Format a list of timings"
                aria-invalid={Boolean(titleError)}
                aria-describedby={titleError ? "snippet-title-error" : undefined}
                className="site-input mt-2"
              />
              {titleError ? (
                <p id="snippet-title-error" role="alert" className="site-accent mt-1.5 text-sm">
                  {titleError}
                </p>
              ) : null}
            </div>
            <Button
              type="submit"
              size="lg"
              className="site-primary h-11 shrink-0 border"
              disabled={saving}
            >
              {saving ? "Saving…" : "Save snippet"}
            </Button>
          </div>

          {saveError ? (
            <div
              role="alert"
              className="site-error mb-5 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm"
            >
              <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span>{saveError}</span>
            </div>
          ) : null}

          <section
            aria-label="Snippet files"
            className="site-panel overflow-hidden rounded-xl border shadow-[0_16px_55px_rgba(0,0,0,0.28)]"
          >
            <div className="site-divider flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
              <h2 className="site-title font-semibold">Files</h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={saving}
                onClick={addFile}
                className="site-secondary border"
              >
                <Plus aria-hidden="true" />
                Add file
              </Button>
            </div>

            <div className="grid min-w-0 lg:grid-cols-[230px_minmax(0,1fr)]">
              <aside className="site-panel-soft site-divider border-b p-3 lg:border-b-0 lg:border-r">
                <Label htmlFor="mobile-file-select" className="sr-only">
                  Choose a file
                </Label>
                <select
                  id="mobile-file-select"
                  className="site-input min-h-11 w-full rounded-md border px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#52d7e8] lg:hidden"
                  value={activeFile?.id ?? ""}
                  onChange={(event) => setActiveFileId(event.target.value)}
                  disabled={saving}
                >
                  {files.map((file, index) => (
                    <option key={file.id} value={file.id}>
                      {file.path || `Untitled file ${index + 1}`}
                    </option>
                  ))}
                </select>
                <h3 className="site-muted hidden px-2 py-2 text-xs font-semibold uppercase tracking-wide lg:block">
                  File list
                </h3>
                <ul className="hidden space-y-1 lg:block">
                  {files.map((file, index) => {
                    const selected = file.id === activeFileId;
                    return (
                      <li key={file.id}>
                        <button
                          ref={(element) => {
                            if (element) fileButtonRefs.current.set(file.id, element);
                            else fileButtonRefs.current.delete(file.id);
                          }}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => setActiveFileId(file.id)}
                          disabled={saving}
                          className={`min-h-11 w-full truncate rounded-md px-3 text-left font-mono text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#52d7e8] ${
                            selected
                              ? "site-selected font-semibold"
                              : "site-row text-slate-300 hover:bg-slate-100"
                          }`}
                        >
                          {file.path || `Untitled file ${index + 1}`}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <p className="site-muted mt-3 hidden px-2 text-xs lg:block">
                  {files.length} {files.length === 1 ? "file" : "files"}
                </p>
              </aside>

              {activeFile ? (
                <div className="min-w-0">
                  <div className="site-divider flex flex-wrap items-end gap-3 border-b p-4 sm:p-5">
                    <div className="min-w-0 flex-1">
                      <Label htmlFor="active-file-path" className="site-label text-sm">
                        File path
                      </Label>
                      <Input
                        id="active-file-path"
                        ref={activePathRef}
                        value={activeFile.path}
                        onChange={(event) => updateFile(activeFile.id, { path: event.target.value })}
                        disabled={saving}
                        placeholder="src/main.ts"
                        aria-invalid={Boolean(issueForActiveFile)}
                        aria-describedby={issueForActiveFile ? "active-file-path-error" : undefined}
                        className="site-input mt-2 font-mono"
                      />
                      {issueForActiveFile ? (
                        <p
                          id="active-file-path-error"
                          role="alert"
                          className="site-accent mt-1.5 text-sm"
                        >
                          {issueForActiveFile}
                        </p>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={saving || files.length === 1}
                      onClick={() => requestRemoveFile(activeFile)}
                      className="site-secondary border"
                    >
                      <Trash2 aria-hidden="true" />
                      Remove
                    </Button>
                  </div>
                  <div className="site-code-chrome flex items-center justify-between gap-3 border-b px-4 py-2.5">
                    <p className="site-muted truncate font-mono text-xs">
                      {activeFile.path || "Untitled file"}
                    </p>
                    <span className="site-accent shrink-0 text-[11px] uppercase tracking-wide">
                      {languageFromPath(activeFile.path) ?? "Plain text"}
                    </span>
                  </div>
                  <CodeEditor
                    fileId={activeFile.id}
                    path={activeFile.path}
                    language={languageFromPath(activeFile.path) ?? "plaintext"}
                    value={activeFile.text}
                    disabled={saving}
                    onChange={(text) => updateFile(activeFile.id, { text })}
                  />
                </div>
              ) : null}
            </div>
          </section>
          <p role="status" aria-live="polite" className="site-muted mt-3 min-h-5 text-sm">
            {saving ? "Saving snippet…" : ""}
          </p>
        </form>

        <AlertDialog.Root
          open={Boolean(fileToRemove)}
          onOpenChange={(open) => {
            if (!open) setFileToRemove(null);
          }}
        >
          <AlertDialog.Portal>
            <AlertDialog.Overlay className="fixed inset-0 z-40 bg-slate-950/45" />
            <AlertDialog.Content className="site-panel fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border p-6 shadow-2xl">
              <AlertDialog.Title className="site-title text-lg font-semibold">
                Remove this file?
              </AlertDialog.Title>
              <AlertDialog.Description className="site-muted mt-2 text-sm leading-6">
                {fileToRemove?.path || "This file"} has content that will be removed from your draft.
              </AlertDialog.Description>
              <div className="mt-6 flex justify-end gap-3">
                <AlertDialog.Cancel asChild>
                  <Button
                    variant="outline"
                    className="site-secondary border"
                    onClick={() => setFileToRemove(null)}
                  >
                    Keep file
                  </Button>
                </AlertDialog.Cancel>
                <AlertDialog.Action asChild>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      if (fileToRemove) removeFile(fileToRemove);
                    }}
                  >
                    Remove file
                  </Button>
                </AlertDialog.Action>
              </div>
            </AlertDialog.Content>
          </AlertDialog.Portal>
        </AlertDialog.Root>

        <AlertDialog.Root
          open={Boolean(pendingNavigation)}
          onOpenChange={(open) => {
            if (!open) cancelNavigation();
          }}
        >
          <AlertDialog.Portal>
            <AlertDialog.Overlay className="fixed inset-0 z-40 bg-slate-950/45" />
            <AlertDialog.Content className="site-panel fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border p-6 shadow-2xl">
              <AlertDialog.Title className="site-title text-lg font-semibold">
                Discard your changes?
              </AlertDialog.Title>
              <AlertDialog.Description className="site-muted mt-2 text-sm leading-6">
                Your unsaved title, files, and code will be lost if you leave this page.
              </AlertDialog.Description>
              <div className="mt-6 flex justify-end gap-3">
                <AlertDialog.Cancel asChild>
                  <Button
                    variant="outline"
                    className="site-secondary border"
                    onClick={cancelNavigation}
                  >
                    Keep editing
                  </Button>
                </AlertDialog.Cancel>
                <AlertDialog.Action asChild>
                  <Button variant="destructive" onClick={confirmNavigation}>
                    Discard changes
                  </Button>
                </AlertDialog.Action>
              </div>
            </AlertDialog.Content>
          </AlertDialog.Portal>
        </AlertDialog.Root>
      </main>
    </div>
  );
}
