import { describe, expect, it } from 'vitest';
import { compareTexts, MAX_TEXT_DIFF_INPUT_LENGTH } from './index';

function diff(original: string, revised: string) {
  const result = compareTexts(original, revised);
  if (!result.ok) throw new Error(result.error.code);
  return result.value;
}

describe('text comparison', () => {
  it('highlights only the missing final character of a UUID', () => {
    const original = '96356d0f4a34466a930982ba8a4e0cbe';
    expect(diff(original, original.slice(0, -1))).toEqual({
      segments: [
        { kind: 'equal', text: original.slice(0, -1) },
        { kind: 'removed', text: 'e' },
      ],
      added: 0,
      removed: 1,
      grouped: false,
    });
  });

  it.each([
    ['abc123def', 'abc923def', '1', '9'],
    ['word', 'wOrd', 'o', 'O'],
    ['a猫🔒b', 'a猫🔑b', '🔒', '🔑'],
  ])(
    'isolates changed characters inside %s',
    (original, revised, removed, added) => {
      const result = diff(original, revised);
      expect(result.added).toBe(1);
      expect(result.removed).toBe(1);
      expect(
        result.segments.filter((segment) => segment.kind !== 'equal'),
      ).toEqual([
        { kind: 'removed', text: removed },
        { kind: 'added', text: added },
      ]);
    },
  );

  it('isolates an insertion and separate edits within an identifier', () => {
    expect(diff('abc123def', 'abc0123def').segments).toEqual([
      { kind: 'equal', text: 'abc' },
      { kind: 'added', text: '0' },
      { kind: 'equal', text: '123def' },
    ]);
    expect(diff('abc123def', 'aXc123dYf')).toMatchObject({
      added: 2,
      removed: 2,
      grouped: false,
    });
    expect(diff('a b', 'a  b').segments).toEqual([
      { kind: 'equal', text: 'a ' },
      { kind: 'added', text: ' ' },
      { kind: 'equal', text: 'b' },
    ]);
  });

  it('compares long identifiers at the input limit without grouping a small edit', () => {
    const original = 'x'.repeat(MAX_TEXT_DIFF_INPUT_LENGTH);
    expect(
      diff(original, original.slice(0, 16_384) + 'y' + original.slice(16_385)),
    ).toMatchObject({
      added: 1,
      removed: 1,
      grouped: false,
    });
  });

  it('identifies word replacements and keeps surrounding text', () => {
    expect(diff('The old fox.', 'The new fox.')).toEqual({
      segments: [
        { kind: 'equal', text: 'The ' },
        { kind: 'removed', text: 'old' },
        { kind: 'added', text: 'new' },
        { kind: 'equal', text: ' fox.' },
      ],
      added: 3,
      removed: 3,
      grouped: false,
    });
  });

  it('handles empty, identical and one-sided text', () => {
    expect(diff('', '').segments).toEqual([]);
    expect(diff('same\n', 'same\n').segments).toEqual([
      { kind: 'equal', text: 'same\n' },
    ]);
    expect(diff('', 'new').segments).toEqual([{ kind: 'added', text: 'new' }]);
    expect(diff('old', '').segments).toEqual([
      { kind: 'removed', text: 'old' },
    ]);
  });

  it('matches internal unchanged words across multiple edits', () => {
    expect(
      diff('one cat and two dogs', 'a cat and three dogs').segments,
    ).toEqual([
      { kind: 'removed', text: 'one' },
      { kind: 'added', text: 'a' },
      { kind: 'equal', text: ' cat and t' },
      { kind: 'removed', text: 'wo' },
      { kind: 'added', text: 'hree' },
      { kind: 'equal', text: ' dogs' },
    ]);
  });

  it('preserves whitespace, case, punctuation, line endings and Unicode exactly', () => {
    const cases = [
      [' café\t猫\r\n🔒!', ' Café  猫\n🔑?'],
      ['a\nb\na\n', 'a\na\nb\n'],
      ['<script>alert(1)</script>', '<img src=x>'],
      ['e\u0301', 'é'],
      ['   ', '\t'],
    ];
    for (const [original, revised] of cases) {
      const { segments } = diff(original!, revised!);
      expect(
        segments
          .filter((part) => part.kind !== 'added')
          .map((part) => part.text)
          .join(''),
      ).toBe(original);
      expect(
        segments
          .filter((part) => part.kind !== 'removed')
          .map((part) => part.text)
          .join(''),
      ).toBe(revised);
    }
    expect(diff('🔒', '🔑')).toMatchObject({ added: 1, removed: 1 });
  });

  it('retains long unchanged content between distant edits', () => {
    const middle = ' keep'.repeat(2500);
    const result = diff(`old${middle} old`, `new${middle} new`);
    expect(result).toMatchObject({ added: 6, removed: 6, grouped: false });
    expect(result.segments).toContainEqual({
      kind: 'equal',
      text: `${middle} `,
    });
  });

  it('reconstructs both sources across repeated and reordered words', () => {
    const texts = [
      '',
      'a',
      'b',
      'a a',
      'a b',
      'b a',
      'b b',
      'a b a',
      'b a b',
      'a  b\n',
      '🔒 a 🔑',
    ];
    for (const original of texts) {
      for (const revised of texts) {
        const { segments } = diff(original, revised);
        expect(
          segments
            .filter((part) => part.kind !== 'added')
            .map((part) => part.text)
            .join(''),
        ).toBe(original);
        expect(
          segments
            .filter((part) => part.kind !== 'removed')
            .map((part) => part.text)
            .join(''),
        ).toBe(revised);
      }
    }
  });

  it('accepts the input limit and rejects oversized input on either side', () => {
    const limit = 'x'.repeat(MAX_TEXT_DIFF_INPUT_LENGTH);
    expect(compareTexts(limit, limit).ok).toBe(true);
    expect(compareTexts(`${limit}x`, '')).toEqual({
      ok: false,
      error: { code: 'input-too-large' },
    });
    expect(compareTexts('', `${limit}x`).ok).toBe(false);
  });

  it('groups expensive comparisons without losing any source text', () => {
    const original = `start ${'a '.repeat(4000)}end`;
    const revised = `start ${'b '.repeat(4000)}end`;
    const result = diff(original, revised);
    expect(result.grouped).toBe(true);
    expect(result.segments).toEqual([
      { kind: 'equal', text: 'start ' },
      { kind: 'removed', text: 'a '.repeat(3999) + 'a' },
      { kind: 'added', text: 'b '.repeat(3999) + 'b' },
      { kind: 'equal', text: ' end' },
    ]);
  });
});
