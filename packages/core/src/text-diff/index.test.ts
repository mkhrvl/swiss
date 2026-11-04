import { describe, expect, it } from 'vitest';
import { compareTexts, MAX_TEXT_DIFF_INPUT_LENGTH } from './index';

function diff(original: string, revised: string) {
  const result = compareTexts(original, revised);
  if (!result.ok) throw new Error(result.error.code);
  return result.value;
}

describe('text comparison', () => {
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
      { kind: 'equal', text: ' cat and ' },
      { kind: 'removed', text: 'two' },
      { kind: 'added', text: 'three' },
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
