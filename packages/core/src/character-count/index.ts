import type { Result } from '../result';

export const MAX_CHARACTER_COUNT_INPUT_LENGTH = 262_144;
const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

export function countCharacters(
  text: string,
): Result<number, { code: 'input-too-large' }> {
  if (text.length > MAX_CHARACTER_COUNT_INPUT_LENGTH)
    return { ok: false, error: { code: 'input-too-large' } };
  let count = 0;
  const segments = segmenter.segment(text)[Symbol.iterator]();
  while (!segments.next().done) count += 1;
  return { ok: true, value: count };
}
