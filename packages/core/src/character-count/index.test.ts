import { describe, expect, it } from 'vitest';
import { countCharacters, MAX_CHARACTER_COUNT_INPUT_LENGTH } from './index';

describe('countCharacters', () => {
  it.each([
    ['', 0],
    ['Hello world!', 12],
    ['  a\t\nb  ', 8],
    ['é', 1],
    ['e\u0301', 1],
    ['👨‍👩‍👧‍👦👍🏽🇵🇭', 3],
    ['你好', 2],
    ['a\r\nb', 3],
  ])('counts graphemes in %j', (text, count) => {
    expect(countCharacters(text)).toEqual({ ok: true, value: count });
  });
  it('accepts the input boundary and rejects overflow without a partial count', () => {
    expect(
      countCharacters('a'.repeat(MAX_CHARACTER_COUNT_INPUT_LENGTH)),
    ).toEqual({
      ok: true,
      value: MAX_CHARACTER_COUNT_INPUT_LENGTH,
    });
    expect(
      countCharacters('a'.repeat(MAX_CHARACTER_COUNT_INPUT_LENGTH + 1)),
    ).toEqual({
      ok: false,
      error: { code: 'input-too-large' },
    });
  });
});
