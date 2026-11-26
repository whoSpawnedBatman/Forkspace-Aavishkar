import { demoSnippetAdapter } from './demo/demoAdapter';
import type { SnippetAdapter } from './domain';
import { liveSnippetAdapter } from './live/liveAdapter';

export type SnippetsMode = 'demo' | 'live';

export function resolveSnippetsMode(): SnippetsMode {
  const configured = import.meta.env.VITE_SNIPPETS_MODE;
  if (configured === 'live') {
    return 'live';
  }
  return 'demo';
}

export function getActiveSnippetAdapter(): SnippetAdapter {
  const mode = resolveSnippetsMode();
  return mode === 'live' ? liveSnippetAdapter : demoSnippetAdapter;
}
