import { describe, expect, it } from 'vitest';
import {
  inspectJson,
  JSON_MAX_DEPTH,
  JSON_MAX_INPUT_LENGTH,
  type JsonOptions,
} from './index';

function document(source: string) {
  const result = inspectJson(source);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}
function render(
  source: string,
  options: JsonOptions = { mode: 'format', indentation: '2' },
) {
  const result = document(source).render(options);
  if (!result.ok) throw new Error(result.error.code);
  return result.value;
}

describe('JSON workspace', () => {
  it.each(['null', 'true', 'false', '"hello"', '-0', '1e9999', '[]', '{}'])(
    'supports a root value: %s',
    (source) => {
      expect(render(source)).toBe(source);
    },
  );
  it('formats nested containers and empty values', () => {
    expect(render('{"a":[1,{"b":[]}],"c":{}}')).toBe(
      '{\n  "a": [\n    1,\n    {\n      "b": []\n    }\n  ],\n  "c": {}\n}',
    );
  });
  it.each([
    ['4', '    '],
    ['tab', '\t'],
  ] as const)('uses %s indentation', (indentation, prefix) => {
    expect(render('{"a":1}', { mode: 'format', indentation })).toBe(
      `{\n${prefix}"a": 1\n}`,
    );
  });
  it('preserves number literals, escapes, duplicate keys and property order', () => {
    const source =
      '{"10":9007199254740993,"2":-0,"x":1.2300e+42,"x":1e9999,"s":"\\u0061\\/"}';
    const formatted = render(source);
    expect(render(formatted, { mode: 'minify', indentation: '2' })).toBe(
      source,
    );
    expect(render(formatted)).toBe(formatted);
  });
  it('minifies only whitespace outside strings', () => {
    expect(
      render(' \r\n { "a" : "  a b \\t ", "b" : [ true , null ] } \t', {
        mode: 'minify',
        indentation: 'tab',
      }),
    ).toBe('{"a":"  a b \\t ","b":[true,null]}');
  });
  it.each([
    '',
    ' ',
    '{"a":1,}',
    '[1,]',
    '{/*x*/"a":1}',
    '//x\n1',
    '{a:1}',
    'NaN',
    'undefined',
    '01',
    '1.',
    '+1',
    '1 2',
    '"\\x"',
    '"\n"',
    '\ufeff{}',
    '\v1',
  ])('rejects non-JSON syntax: %j', (source) => {
    expect(inspectJson(source)).toMatchObject({
      ok: false,
      error: { code: 'invalid-json' },
    });
  });
  it('reports the first error with one-based CRLF line and column', () => {
    expect(inspectJson('{\r\n  "a":\r\n}')).toEqual({
      ok: false,
      error: {
        code: 'invalid-json',
        reason: 'ValueExpected',
        offset: 11,
        length: 1,
        line: 3,
        column: 1,
      },
    });
  });
  it('bounds input and nesting before parsing, ignoring brackets inside strings', () => {
    expect(inspectJson(' '.repeat(JSON_MAX_INPUT_LENGTH) + '0')).toMatchObject({
      ok: false,
      error: { code: 'input-too-large' },
    });
    expect(inspectJson(' '.repeat(JSON_MAX_INPUT_LENGTH - 1) + '0').ok).toBe(
      true,
    );
    const nested =
      '['.repeat(JSON_MAX_DEPTH) + '0' + ']'.repeat(JSON_MAX_DEPTH);
    expect(inspectJson(nested).ok).toBe(true);
    expect(inspectJson('[' + nested + ']')).toMatchObject({
      ok: false,
      error: { code: 'too-deep' },
    });
    expect(inspectJson('['.repeat(JSON_MAX_DEPTH + 1))).toMatchObject({
      ok: false,
      error: { code: 'too-deep' },
    });
    expect(inspectJson(JSON.stringify('['.repeat(1000))).ok).toBe(true);
  });
  it('rejects excessive formatted output while allowing compact output', () => {
    const source =
      '['.repeat(127) +
      Array.from({ length: 6000 }, () => '0').join(',') +
      ']'.repeat(127);
    const value = document(source);
    expect(value.render({ mode: 'format', indentation: '4' })).toEqual({
      ok: false,
      error: { code: 'output-too-large' },
    });
    expect(value.render({ mode: 'minify', indentation: '4' })).toEqual({
      ok: true,
      value: source,
    });
  });
  it('rejects invalid render options', () => {
    const value = document('{}');
    expect(
      value.render({
        mode: 'sort',
        indentation: '2',
      } as unknown as JsonOptions),
    ).toEqual({ ok: false, error: { code: 'invalid-options' } });
    expect(
      value.render({
        mode: 'format',
        indentation: '8',
      } as unknown as JsonOptions),
    ).toEqual({ ok: false, error: { code: 'invalid-options' } });
  });
});
