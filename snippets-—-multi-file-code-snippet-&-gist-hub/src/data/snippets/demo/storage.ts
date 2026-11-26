import type { DemoScenario } from '../domain';
import { SnippetAdapterError } from '../domain';
import { createSeedRecords, type StoredSnippetRecord } from './fixtures';

const STORAGE_KEY = 'snipbase_demo_store_v4';
const SCENARIO_KEY = 'snipbase_demo_scenario_v4';

interface StoredSnapshot {
  version: 1;
  records: StoredSnippetRecord[];
}

function isValidRecord(value: unknown): value is StoredSnippetRecord {
  if (!value || typeof value !== 'object') return false;
  const rec = value as Record<string, unknown>;
  return (
    typeof rec.id === 'string' &&
    typeof rec.title === 'string' &&
    (rec.visibility === 'public' ||
      rec.visibility === 'unlisted' ||
      rec.visibility === 'private') &&
    Array.isArray(rec.tags) &&
    Array.isArray(rec.files) &&
    typeof rec.ownerId === 'string' &&
    typeof rec.ownerName === 'string'
  );
}

export function getDemoScenario(): DemoScenario {
  try {
    const raw = window.localStorage.getItem(SCENARIO_KEY);
    if (
      raw === 'normal' ||
      raw === 'slow-read' ||
      raw === 'save-error' ||
      raw === 'empty' ||
      raw === 'storage-blocked'
    ) {
      return raw;
    }
  } catch {
    // Ignore storage read errors when reading scenario
  }
  return 'normal';
}

export function setDemoScenario(scenario: DemoScenario): void {
  try {
    window.localStorage.setItem(SCENARIO_KEY, scenario);
  } catch {
    // Best-effort persistence for test scenario
  }
}

export function readDemoRecords(): StoredSnippetRecord[] {
  const scenario = getDemoScenario();
  if (scenario === 'storage-blocked') {
    throw new SnippetAdapterError({
      code: 'unavailable',
      message:
        'Browser storage is blocked in this test scenario. Switch Demo Controls back to Normal or reset the store.',
    });
  }

  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    throw new SnippetAdapterError({
      code: 'unavailable',
      message:
        'Browser storage is inaccessible in this profile. Allow local storage or reset browser site data.',
    });
  }

  if (raw === null) {
    const seeded = createSeedRecords();
    writeDemoRecords(seeded);
    return structuredClone(seeded);
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredSnapshot>;
    if (
      parsed.version !== 1 ||
      !Array.isArray(parsed.records) ||
      !parsed.records.every(isValidRecord)
    ) {
      throw new Error('Invalid snapshot structure');
    }
    return structuredClone(parsed.records);
  } catch {
    throw new SnippetAdapterError({
      code: 'unavailable',
      message:
        'Local demo data appears corrupted and was not overwritten automatically. Use "Reset demo data" in Demo Controls to restore sample snippets.',
    });
  }
}

export function writeDemoRecords(records: StoredSnippetRecord[]): void {
  const scenario = getDemoScenario();
  if (scenario === 'storage-blocked') {
    throw new SnippetAdapterError({
      code: 'unavailable',
      message:
        'Could not save because browser storage is blocked. Switch Demo Controls back to Normal and try again.',
    });
  }

  const snapshot: StoredSnapshot = {
    version: 1,
    records: structuredClone(records),
  };

  try {
    const serialized = JSON.stringify(snapshot);
    window.localStorage.setItem(STORAGE_KEY, serialized);
    // Verify atomic read-back before confirming write
    const verified = window.localStorage.getItem(STORAGE_KEY);
    if (verified !== serialized) {
      throw new Error('Write verification mismatch');
    }
  } catch {
    throw new SnippetAdapterError({
      code: 'unavailable',
      message:
        'Failed to write to browser storage (quota exceeded or storage blocked). Your draft is still intact.',
    });
  }
}

export function resetDemoStore(): StoredSnippetRecord[] {
  const seeded = createSeedRecords();
  setDemoScenario('normal');
  writeDemoRecords(seeded);
  return structuredClone(seeded);
}
