import { describe, expect, it } from 'vitest';
import { decodeBase64, MAX_BASE64_INPUT_LENGTH } from './index';

describe('decodeBase64', () => {
  it.each([
    ['SGVsbG8gd29ybGQ=', 'Hello world'],
    ['Zg', 'f'],
    ['Zg=', 'f'],
    ['Zm8', 'fo'],
    ['\n SG Vs\tbG8= \r\n', 'Hello'],
    ['ICBjYWbDqSDwn5SQICA=', '  café 🔐  '],
    ['8J-UkA', '🔐'],
    ['bGluZTEKbGluZTIJZW5k', 'line1\nline2\tend'],
    ['77u/YQ==', '\uFEFFa'],
  ])('preserves decoded text from %s', (input, output) => {
    const result = decodeBase64(input);
    expect(result.ok && result.value.output).toBe(output);
    expect(result.ok && result.value.format).toBe('text');
  });
  it.each([
    ['+/8=', 'fbff'],
    ['-_8', 'fbff'],
    ['/w==', 'ff'],
    ['AA==', '00'],
    ['AQID', '010203'],
    ['woA=', 'c280'],
  ])('preserves binary and control bytes from %s', (input, output) => {
    const result = decodeBase64(input);
    expect(result.ok && result.value.output).toBe(output);
    expect(result.ok && result.value.format).toBe('hex');
  });
  it.each([
    '!',
    'A',
    'Zm=9v',
    '+_8=',
    'SGVsbG8===',
    'Zg\u00a0==',
    'Zg\f==',
    '=',
    '\uFEFF',
  ])('rejects malformed input %s', (input) => {
    expect(decodeBase64(input)).toEqual({
      ok: false,
      error: { code: 'invalid-input' },
    });
  });
  it.each(['', ' \r\n\t ', '\u00a0', '\u0085'])(
    'returns an empty result for blank input',
    (input) => {
      const result = decodeBase64(input);
      expect(result.ok && result.value.output).toBe('');
    },
  );
  it('bounds work including whitespace', () => {
    expect(decodeBase64('A'.repeat(MAX_BASE64_INPUT_LENGTH + 1))).toEqual({
      ok: false,
      error: { code: 'input-too-large', maxLength: MAX_BASE64_INPUT_LENGTH },
    });
    const accepted = decodeBase64('A'.repeat(MAX_BASE64_INPUT_LENGTH));
    expect(accepted.ok && accepted.value.bytes.length).toBe(49_152);
  });
});
