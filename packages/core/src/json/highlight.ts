import { createScanner, type JSONScanner } from 'jsonc-parser';

export type JsonHighlight = Readonly<{
  offset: number;
  length: number;
  kind:
    'property' | 'string' | 'number' | 'keyword' | 'punctuation' | 'invalid';
}>;

function tokenKind(token: number): JsonHighlight['kind'] | undefined {
  if (token >= 1 && token <= 6) return 'punctuation';
  if (token >= 7 && token <= 9) return 'keyword';
  if (token === 10) return 'string';
  if (token === 11) return 'number';
  if (token === 12 || token === 13 || token === 16) return 'invalid';
  return undefined;
}

function scanSignificant(scanner: JSONScanner): number {
  let token = scanner.scan();
  while (token === 14 || token === 15) token = scanner.scan();
  return token;
}

// Highlight incomplete input too. These scanner token codes are public API;
// its ambient const enum cannot be used as a value with isolatedModules.
export function highlightJson(source: string): readonly JsonHighlight[] {
  if (source.length > 2_097_152) return [];
  const scanner = createScanner(source, false);
  const highlights: JsonHighlight[] = [];
  let token = scanSignificant(scanner);
  while (token !== 17) {
    let kind = tokenKind(token);
    if (scanner.getTokenError() !== 0) kind = 'invalid';
    const offset = scanner.getTokenOffset();
    const length = scanner.getTokenLength();
    token = scanSignificant(scanner);
    if (kind === 'string' && token === 6) kind = 'property';
    if (kind) highlights.push({ offset, length, kind });
    // Fall back to plain text instead of creating an unbounded React tree.
    if (highlights.length > 20_000) return [];
  }
  return highlights;
}
