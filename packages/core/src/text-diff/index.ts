import type { Result } from '../result';

export const MAX_TEXT_DIFF_INPUT_LENGTH = 32_768;
const MAX_COMPARISON_WORK = 1_000_000;
const MAX_EDIT_DISTANCE = 512;

export type DiffSegment = {
  kind: 'equal' | 'removed' | 'added';
  text: string;
};
export type TextDiff = {
  segments: DiffSegment[];
  added: number;
  removed: number;
  grouped: boolean;
};
export type TextDiffError = { code: 'input-too-large' };

// Myers' shortest edit path: long unchanged runs cost linear work, even when
// edits occur at both ends. Bound both search work and trace storage (~2 MB).
function findChanges(
  before: string[],
  after: string[],
): DiffSegment[] | undefined {
  const offset = MAX_EDIT_DISTANCE + 1;
  const frontier = new Int32Array(2 * MAX_EDIT_DISTANCE + 3).fill(-1);
  frontier[offset + 1] = 0;
  const trace: Int32Array[] = [];
  let work = 0;
  for (let distance = 0; distance <= MAX_EDIT_DISTANCE; distance++) {
    trace.push(frontier.slice());
    for (let diagonal = -distance; diagonal <= distance; diagonal += 2) {
      if (++work > MAX_COMPARISON_WORK) return undefined;
      const index = offset + diagonal;
      let x = frontier[index - 1]! + 1;
      if (
        diagonal === -distance ||
        (diagonal !== distance && frontier[index - 1]! < frontier[index + 1]!)
      ) {
        x = frontier[index + 1]!;
      }
      let y = x - diagonal;
      while (x < before.length && y < after.length && before[x] === after[y]) {
        if (++work > MAX_COMPARISON_WORK) return undefined;
        x++;
        y++;
      }
      frontier[index] = x;
      if (x >= before.length && y >= after.length)
        return backtrack(before, after, trace, offset);
    }
  }
  return undefined;
}

function backtrack(
  before: string[],
  after: string[],
  trace: Int32Array[],
  offset: number,
): DiffSegment[] {
  const changes: DiffSegment[] = [];
  let x = before.length;
  let y = after.length;
  for (let distance = trace.length - 1; distance >= 0; distance--) {
    const frontier = trace[distance]!;
    const diagonal = x - y;
    const index = offset + diagonal;
    let previousDiagonal = diagonal - 1;
    if (
      diagonal === -distance ||
      (diagonal !== distance && frontier[index - 1]! < frontier[index + 1]!)
    ) {
      previousDiagonal = diagonal + 1;
    }
    const previousX = frontier[offset + previousDiagonal]!;
    const previousY = previousX - previousDiagonal;
    while (x > previousX && y > previousY) {
      changes.push({ kind: 'equal', text: before[--x]! });
      y--;
    }
    if (!distance) break;
    if (x === previousX) changes.push({ kind: 'added', text: after[--y]! });
    else changes.push({ kind: 'removed', text: before[--x]! });
  }
  return changes.reverse();
}

/** Exact, character-level comparison with bounded time, memory and render size. */
export function compareTexts(
  original: string,
  revised: string,
): Result<TextDiff, TextDiffError> {
  if (
    original.length > MAX_TEXT_DIFF_INPUT_LENGTH ||
    revised.length > MAX_TEXT_DIFF_INPUT_LENGTH
  ) {
    return { ok: false, error: { code: 'input-too-large' } };
  }
  // Compare Unicode code points so small edits within words and IDs stay visible.
  const before = Array.from(original);
  const after = Array.from(revised);
  let start = 0;
  while (start < before.length && before[start] === after[start]) start++;
  let endBefore = before.length;
  let endAfter = after.length;
  while (
    endBefore > start &&
    endAfter > start &&
    before[endBefore - 1] === after[endAfter - 1]
  ) {
    endBefore--;
    endAfter--;
  }
  const segments: DiffSegment[] = [];
  function append(kind: DiffSegment['kind'], text: string) {
    if (!text) return;
    const previous = segments.at(-1);
    if (previous?.kind === kind) previous.text += text;
    else segments.push({ kind, text });
  }
  function appendReplacement() {
    append('removed', before.slice(start, endBefore).join(''));
    append('added', after.slice(start, endAfter).join(''));
  }
  append('equal', before.slice(0, start).join(''));
  let grouped = false;
  if (start === endBefore || start === endAfter) {
    appendReplacement();
  } else {
    const changes = findChanges(
      before.slice(start, endBefore),
      after.slice(start, endAfter),
    );
    if (changes) {
      // At most 512 changed code points, so merged output has at most 1,027 spans.
      for (const change of changes) append(change.kind, change.text);
    } else {
      grouped = true;
      appendReplacement();
    }
  }
  append('equal', before.slice(endBefore).join(''));
  let added = 0;
  let removed = 0;
  for (const segment of segments) {
    if (segment.kind === 'added') added += Array.from(segment.text).length;
    if (segment.kind === 'removed') removed += Array.from(segment.text).length;
  }
  return { ok: true, value: { segments, added, removed, grouped } };
}
