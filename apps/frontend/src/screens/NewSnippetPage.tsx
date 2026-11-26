import * as React from 'react';
import { Github } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { SnippetWorkbench } from '@/src/features/snippets/workbench/SnippetWorkbench';

type ImportedFile = { path: string; text: string };

function parseRepo(value: string) {
  const match = value.trim().match(/^https?:\/\/github\.com\/([^/]+)\/([^/#]+)(?:\/tree\/([^/#]+))?/);
  return match ? { owner: match[1], repo: match[2].replace(/\.git$/, ''), branch: match[3] ?? 'HEAD' } : null;
}

export function NewSnippetPage() {
  const [choice, setChoice] = React.useState<'choose' | 'new' | 'import'>('choose');
  const [files, setFiles] = React.useState<ImportedFile[] | null>(null);
  const [githubUrl, setGithubUrl] = React.useState('');
  const [error, setError] = React.useState('');
  const fileInput = React.useRef<HTMLInputElement>(null);

  if (choice === 'new') return <SnippetWorkbench mode="create" />;
  if (files) return <SnippetWorkbench mode="create" initialFiles={files} />;

  const importLocal = async (selected: FileList | null) => {
    if (!selected?.length) return;
    setFiles(await Promise.all(Array.from(selected).map(async (file) => ({ path: file.webkitRelativePath || file.name, text: await file.text() }))));
  };

  const importGithub = async () => {
    const repo = parseRepo(githubUrl);
    if (!repo) { setError('Paste a GitHub repository URL such as https://github.com/owner/repository'); return; }
    setError('');
    try {
      const response = await fetch(`https://api.github.com/repos/${repo.owner}/${repo.repo}/git/trees/${repo.branch}?recursive=1`);
      if (!response.ok) throw new Error('Repository could not be loaded.');
      const tree = await response.json() as { tree: Array<{ path: string; type: string; url: string }> };
      const blobs = tree.tree.filter((item) => item.type === 'blob').slice(0, 20);
      setFiles(await Promise.all(blobs.map(async (item) => {
        const blob = await fetch(item.url).then((res) => res.json() as Promise<{ content: string; encoding: string }>);
        return { path: item.path, text: blob.encoding === 'base64' ? atob(blob.content.replace(/\n/g, '')) : blob.content };
      })));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Repository import failed.'); }
  };

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-3xl items-center px-6 py-12">
      <section className="w-full rounded-2xl border border-[var(--hairline)] bg-[var(--paper)] p-8 shadow-[var(--shadow)]">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--action)]">New snippet</p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--ink)]">How do you want to start?</h1>
        <p className="mt-2 text-sm text-[var(--secondary-text)]">Start with a blank editor or bring in files you already have.</p>
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <Button variant="primary" size="lg" onClick={() => setChoice('new')}>Type something new</Button>
          <Button variant="secondary" size="lg" onClick={() => setChoice('import')}>Import existing files</Button>
        </div>
        {choice === 'import' && (
          <div className="mt-6 space-y-4 border-t border-[var(--hairline)] pt-6">
            <Button variant="secondary" onClick={() => fileInput.current?.click()}>Choose files from this computer</Button>
            <input ref={fileInput} type="file" multiple className="sr-only" onChange={(event) => void importLocal(event.target.files)} />
            <div className="flex flex-col gap-2 sm:flex-row">
              <input value={githubUrl} onChange={(event) => setGithubUrl(event.target.value)} placeholder="https://github.com/owner/repository" className="h-10 min-w-0 flex-1 rounded-md border border-[var(--control-border)] bg-[var(--canvas)] px-3 text-sm text-[var(--ink)]" />
              <Button variant="secondary" onClick={() => void importGithub()}><Github className="h-4 w-4" /> Import from GitHub</Button>
            </div>
            {error && <p role="alert" className="text-sm text-[var(--error-ink)]">{error}</p>}
          </div>
        )}
      </section>
    </main>
  );
}
