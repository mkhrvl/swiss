import { describe, expect, it } from 'vitest';
import { highlightJson } from './index';

describe('JSON highlighting', () => {
  it('distinguishes keys, values, numbers, keywords and punctuation without changing literals', () => {
    const source =
      '{ "escaped\\"key" \n: "value", "id":9007199254740993, "x":-0, "ok":true, "nil":null }';
    const colored = highlightJson(source).map(({ offset, length, kind }) => ({
      text: source.slice(offset, offset + length),
      kind,
    }));
    expect(colored).toContainEqual({
      text: '"escaped\\"key"',
      kind: 'property',
    });
    expect(colored).toContainEqual({ text: '"value"', kind: 'string' });
    expect(colored).toContainEqual({
      text: '9007199254740993',
      kind: 'number',
    });
    expect(colored).toContainEqual({ text: '-0', kind: 'number' });
    expect(colored).toContainEqual({ text: 'true', kind: 'keyword' });
    expect(colored).toContainEqual({ text: 'null', kind: 'keyword' });
    expect(colored).toContainEqual({ text: ':', kind: 'punctuation' });
  });
  it('highlights incomplete and invalid input while keeping offsets inside the source', () => {
    for (const source of [
      '{"a": "unfinished',
      '{/* comment */"x":1,}',
      '"bad\\x"',
      '[false, undefined]',
    ]) {
      const ranges = highlightJson(source);
      expect(ranges.some(({ kind }) => kind === 'invalid')).toBe(true);
      for (const range of ranges) {
        expect(range.offset).toBeGreaterThanOrEqual(0);
        expect(range.length).toBeGreaterThan(0);
        expect(range.offset + range.length).toBeLessThanOrEqual(source.length);
      }
    }
  });
  it('handles root strings, tabs and HTML-like content as ordinary text', () => {
    const source = '\t"<script>alert(1)</script>"\r\n';
    expect(highlightJson(source)).toEqual([
      { offset: 1, length: 27, kind: 'string' },
    ]);
    expect(highlightJson(' \t\r\n')).toEqual([]);
  });
  it('bounds highlighting work with a plain-text fallback for oversized or dense content', () => {
    expect(highlightJson('x'.repeat(2_097_153))).toEqual([]);
    expect(highlightJson('[' + '0,'.repeat(10_001) + '0]')).toEqual([]);
  });
});
