import type { SnippetFile } from '@/src/data/snippets/domain';

export type DiffLineType = 'unchanged' | 'added' | 'removed';

export interface DiffLine {
  readonly type: DiffLineType;
  readonly content: string;
  readonly oldLineNumber?: number;
  readonly newLineNumber?: number;
}

export interface FileDiffResult {
  readonly path: string;
  readonly status: 'added' | 'removed' | 'modified' | 'unchanged';
  readonly language?: string;
  readonly originalText: string;
  readonly currentText: string;
  readonly addedCount: number;
  readonly removedCount: number;
  readonly lines: readonly DiffLine[];
}

export interface SnippetDiffSummary {
  readonly files: readonly FileDiffResult[];
  readonly totalAdded: number;
  readonly totalRemoved: number;
  readonly changedFilesCount: number;
}

const MAX_LCS_LINES = 800;

function splitLines(text: string): string[] {
  if (!text) return [];
  return text.replace(/\r\n/g, '\n').split('\n');
}

/**
 * Computes a clean line-by-line diff using LCS (with a fast trimmed prefix/suffix
 * pass so typical code files diff in <1ms).
 */
export function computeLineDiff(originalText: string, currentText: string): DiffLine[] {
  const a = splitLines(originalText);
  const b = splitLines(currentText);

  if (a.length === 0 && b.length === 0) {
    return [];
  }

  // Trim shared prefix
  let prefixLen = 0;
  while (prefixLen < a.length && prefixLen < b.length && a[prefixLen] === b[prefixLen]) {
    prefixLen += 1;
  }

  // Trim shared suffix
  let suffixLen = 0;
  while (
    suffixLen < a.length - prefixLen &&
    suffixLen < b.length - prefixLen &&
    a[a.length - 1 - suffixLen] === b[b.length - 1 - suffixLen]
  ) {
    suffixLen += 1;
  }

  const result: DiffLine[] = [];

  for (let i = 0; i < prefixLen; i += 1) {
    result.push({
      type: 'unchanged',
      content: a[i],
      oldLineNumber: i + 1,
      newLineNumber: i + 1,
    });
  }

  const midA = a.slice(prefixLen, a.length - suffixLen);
  const midB = b.slice(prefixLen, b.length - suffixLen);

  if (midA.length === 0 && midB.length === 0) {
    // Identical
  } else if (midA.length === 0) {
    midB.forEach((line, idx) => {
      result.push({
        type: 'added',
        content: line,
        newLineNumber: prefixLen + idx + 1,
      });
    });
  } else if (midB.length === 0) {
    midA.forEach((line, idx) => {
      result.push({
        type: 'removed',
        content: line,
        oldLineNumber: prefixLen + idx + 1,
      });
    });
  } else if (midA.length > MAX_LCS_LINES || midB.length > MAX_LCS_LINES) {
    // Fallback for huge files to prevent quadratic memory usage
    midA.forEach((line, idx) => {
      result.push({
        type: 'removed',
        content: line,
        oldLineNumber: prefixLen + idx + 1,
      });
    });
    midB.forEach((line, idx) => {
      result.push({
        type: 'added',
        content: line,
        newLineNumber: prefixLen + idx + 1,
      });
    });
  } else {
    const m = midA.length;
    const n = midB.length;
    const dp: Uint32Array[] = Array.from({ length: m + 1 }, () => new Uint32Array(n + 1));

    for (let i = m - 1; i >= 0; i -= 1) {
      const row = dp[i];
      const nextRow = dp[i + 1];
      for (let j = n - 1; j >= 0; j -= 1) {
        if (midA[i] === midB[j]) {
          row[j] = nextRow[j + 1] + 1;
        } else {
          row[j] = nextRow[j] >= row[j + 1] ? nextRow[j] : row[j + 1];
        }
      }
    }

    let i = 0;
    let j = 0;
    while (i < m && j < n) {
      if (midA[i] === midB[j]) {
        result.push({
          type: 'unchanged',
          content: midA[i],
          oldLineNumber: prefixLen + i + 1,
          newLineNumber: prefixLen + j + 1,
        });
        i += 1;
        j += 1;
      } else if (dp[i + 1][j] >= dp[i][j + 1]) {
        result.push({
          type: 'removed',
          content: midA[i],
          oldLineNumber: prefixLen + i + 1,
        });
        i += 1;
      } else {
        result.push({
          type: 'added',
          content: midB[j],
          newLineNumber: prefixLen + j + 1,
        });
        j += 1;
      }
    }

    while (i < m) {
      result.push({
        type: 'removed',
        content: midA[i],
        oldLineNumber: prefixLen + i + 1,
      });
      i += 1;
    }

    while (j < n) {
      result.push({
        type: 'added',
        content: midB[j],
        newLineNumber: prefixLen + j + 1,
      });
      j += 1;
    }
  }

  for (let k = 0; k < suffixLen; k += 1) {
    const oldIdx = a.length - suffixLen + k;
    const newIdx = b.length - suffixLen + k;
    result.push({
      type: 'unchanged',
      content: a[oldIdx],
      oldLineNumber: oldIdx + 1,
      newLineNumber: newIdx + 1,
    });
  }

  return result;
}

export function computeFilesDiff(
  originalFiles: readonly SnippetFile[],
  currentFiles: readonly SnippetFile[],
): SnippetDiffSummary {
  const origMap = new Map<string, SnippetFile>();
  for (const file of originalFiles) {
    origMap.set(file.path, file);
  }

  const currMap = new Map<string, SnippetFile>();
  for (const file of currentFiles) {
    currMap.set(file.path, file);
  }

  const orderedPaths: string[] = [];
  for (const file of currentFiles) {
    orderedPaths.push(file.path);
  }
  for (const file of originalFiles) {
    if (!currMap.has(file.path)) {
      orderedPaths.push(file.path);
    }
  }

  let totalAdded = 0;
  let totalRemoved = 0;
  let changedFilesCount = 0;
  const files: FileDiffResult[] = [];

  for (const path of orderedPaths) {
    const orig = origMap.get(path);
    const curr = currMap.get(path);

    if (orig && curr) {
      const lines = computeLineDiff(orig.text, curr.text);
      let addedCount = 0;
      let removedCount = 0;
      for (const l of lines) {
        if (l.type === 'added') addedCount += 1;
        else if (l.type === 'removed') removedCount += 1;
      }
      const status = addedCount > 0 || removedCount > 0 ? 'modified' : 'unchanged';
      if (status !== 'unchanged') changedFilesCount += 1;
      totalAdded += addedCount;
      totalRemoved += removedCount;
      files.push({
        path,
        status,
        language: curr.language || orig.language,
        originalText: orig.text,
        currentText: curr.text,
        addedCount,
        removedCount,
        lines,
      });
    } else if (curr && !orig) {
      const lines = computeLineDiff('', curr.text);
      const addedCount = lines.length;
      changedFilesCount += 1;
      totalAdded += addedCount;
      files.push({
        path,
        status: 'added',
        language: curr.language,
        originalText: '',
        currentText: curr.text,
        addedCount,
        removedCount: 0,
        lines,
      });
    } else if (orig && !curr) {
      const lines = computeLineDiff(orig.text, '');
      const removedCount = lines.length;
      changedFilesCount += 1;
      totalRemoved += removedCount;
      files.push({
        path,
        status: 'removed',
        language: orig.language,
        originalText: orig.text,
        currentText: '',
        addedCount: 0,
        removedCount,
        lines,
      });
    }
  }

  return {
    files,
    totalAdded,
    totalRemoved,
    changedFilesCount,
  };
}
