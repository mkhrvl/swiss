import {
  createScanner,
  visit,
  type ParseError,
  printParseErrorCode,
} from 'jsonc-parser';
import type { Result } from '../result';
export { highlightJson, type JsonHighlight } from './highlight';

// The scanner's public token codes. Its ambient const enum cannot be imported
// as a value with isolatedModules; keep this small subset local instead.
const tokens = {
  OpenBraceToken: 1,
  CloseBraceToken: 2,
  OpenBracketToken: 3,
  CloseBracketToken: 4,
  CommaToken: 5,
  ColonToken: 6,
  EOF: 17,
} as const;

export const JSON_MAX_INPUT_LENGTH = 262_144;
export const JSON_MAX_DEPTH = 128;
export const JSON_MAX_OUTPUT_LENGTH = 2_097_152;
export type JsonIndentation = '2' | '4' | 'tab';
export type JsonOutputMode = 'format' | 'minify';
export type JsonOptions = Readonly<{
  mode: JsonOutputMode;
  indentation: JsonIndentation;
}>;
export type JsonSyntaxError = Exclude<
  ReturnType<typeof printParseErrorCode>,
  '<unknown ParseErrorCode>'
>;
export type JsonError =
  | {
      code: 'invalid-json';
      reason: JsonSyntaxError;
      offset: number;
      length: number;
      line: number;
      column: number;
    }
  | {
      code:
        'input-too-large' | 'too-deep' | 'output-too-large' | 'invalid-options';
    };
export type JsonDocument = Readonly<{
  render: (options: JsonOptions) => Result<string, JsonError>;
}>;

function separatorBefore(
  previous: number,
  closing: boolean,
  depth: number,
  indent: string,
): string {
  const afterOpen =
    previous === tokens.OpenBraceToken || previous === tokens.OpenBracketToken;
  if (
    (afterOpen && !closing) ||
    previous === tokens.CommaToken ||
    (closing && !afterOpen)
  )
    return '\n' + indent.repeat(depth);
  return previous === tokens.ColonToken ? ' ' : '';
}

// Work with original token slices: parsing/serializing values would round large
// numbers, normalize escapes and discard duplicate property names.
function render(
  source: string,
  options: JsonOptions,
): Result<string, JsonError> {
  if (
    !['format', 'minify'].includes(options.mode) ||
    !['2', '4', 'tab'].includes(options.indentation)
  )
    return { ok: false, error: { code: 'invalid-options' } };
  const pretty = options.mode === 'format';
  let indent = '\t';
  if (options.indentation !== 'tab')
    indent = ' '.repeat(Number(options.indentation));
  const scanner = createScanner(source, true);
  const pieces: string[] = [];
  let size = 0;
  let depth = 0;
  let previous: number = tokens.EOF;
  let token = scanner.scan();
  while (token !== tokens.EOF) {
    const closing =
      token === tokens.CloseBraceToken || token === tokens.CloseBracketToken;
    if (closing) depth--;
    const prefix = pretty
      ? separatorBefore(previous, closing, depth, indent)
      : '';
    const raw = source.slice(
      scanner.getTokenOffset(),
      scanner.getTokenOffset() + scanner.getTokenLength(),
    );
    size += prefix.length + raw.length;
    if (size > JSON_MAX_OUTPUT_LENGTH)
      return { ok: false, error: { code: 'output-too-large' } };
    pieces.push(prefix, raw);
    if (token === tokens.OpenBraceToken || token === tokens.OpenBracketToken)
      depth++;
    previous = token;
    token = scanner.scan();
  }
  return { ok: true, value: pieces.join('') };
}

export function inspectJson(source: string): Result<JsonDocument, JsonError> {
  if (source.length > JSON_MAX_INPUT_LENGTH)
    return { ok: false, error: { code: 'input-too-large' } };
  // Bound recursion before invoking the parser, including malformed input.
  const scanner = createScanner(source, true);
  let depth = 0;
  let token = scanner.scan();
  while (token !== tokens.EOF) {
    if (token === tokens.OpenBraceToken || token === tokens.OpenBracketToken)
      depth++;
    else if (
      token === tokens.CloseBraceToken ||
      token === tokens.CloseBracketToken
    )
      depth = Math.max(0, depth - 1);
    if (depth > JSON_MAX_DEPTH)
      return { ok: false, error: { code: 'too-deep' } };
    token = scanner.scan();
  }
  let first: ParseError | undefined;
  visit(
    source,
    {
      onError(error, offset, length) {
        first ??= { error, offset, length };
      },
    },
    {
      disallowComments: true,
      allowTrailingComma: false,
      allowEmptyContent: false,
    },
  );
  if (first) {
    const reason = printParseErrorCode(first.error);
    if (reason === '<unknown ParseErrorCode>')
      throw new Error('Unknown JSON syntax error');
    let line = 1;
    let lineStart = 0;
    const breaks = /\r\n|\r|\n/g;
    for (const match of source.slice(0, first.offset).matchAll(breaks)) {
      line++;
      lineStart = match.index + match[0].length;
    }
    return {
      ok: false,
      error: {
        code: 'invalid-json',
        reason,
        offset: first.offset,
        length: first.length,
        line,
        column: first.offset - lineStart + 1,
      },
    };
  }
  return {
    ok: true,
    value: {
      render: (options) => render(source, options),
    },
  };
}
