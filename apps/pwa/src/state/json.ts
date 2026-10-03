import { useMemo, useState } from 'react';
import {
  inspectJson,
  type JsonError,
  type JsonOptions,
  type JsonSyntaxError,
} from '@swiss/core/json';

const syntaxMessages: Record<JsonSyntaxError, string> = {
  InvalidSymbol: 'Unexpected character.',
  InvalidNumberFormat: 'Invalid number.',
  PropertyNameExpected: 'Expected a quoted property name.',
  ValueExpected: 'Expected a JSON value.',
  ColonExpected: 'Expected a colon after the property name.',
  CommaExpected: 'Expected a comma between values.',
  CloseBraceExpected: 'Expected a closing brace.',
  CloseBracketExpected: 'Expected a closing bracket.',
  EndOfFileExpected: 'Unexpected content after the JSON value.',
  InvalidCommentToken: 'Comments are not allowed in JSON.',
  UnexpectedEndOfComment: 'Comments are not allowed in JSON.',
  UnexpectedEndOfString: 'Unterminated string.',
  UnexpectedEndOfNumber: 'Incomplete number.',
  InvalidUnicode: 'Invalid Unicode escape.',
  InvalidEscapeCharacter: 'Invalid string escape.',
  InvalidCharacter: 'Invalid character inside a string.',
};
export function jsonErrorMessage(error: JsonError): string {
  switch (error.code) {
    case 'invalid-json':
      return `${syntaxMessages[error.reason]} Line ${error.line}, column ${error.column}.`;
    case 'input-too-large':
      return 'Use JSON with at most 262,144 characters.';
    case 'too-deep':
      return 'Use JSON with at most 128 nesting levels.';
    case 'output-too-large':
      return 'Formatted output exceeds 2,097,152 characters. Try Minify or less indentation.';
    case 'invalid-options':
      return 'Choose Format or Minify and a listed indentation option.';
  }
}
export function useJsonTools() {
  const [source, setSource] = useState('');
  const [options, setOptions] = useState<JsonOptions>({
    mode: 'format',
    indentation: '2',
  });
  const document = useMemo(() => inspectJson(source), [source]);
  const rendered = useMemo(() => {
    if (!document.ok) return document;
    return document.value.render(options);
  }, [document, options]);
  const empty = !/[^ \t\r\n]/.test(source);
  const output = !empty && rendered.ok ? rendered.value : '';
  const syntaxError = !empty && !document.ok ? document.error : undefined;
  let message = 'Paste JSON to get started.';
  if (!empty)
    message = document.ok ? 'Valid JSON.' : jsonErrorMessage(document.error);
  let outputError = '';
  if (!empty && document.ok && !rendered.ok)
    outputError = jsonErrorMessage(rendered.error);
  return {
    source,
    setSource,
    options,
    setOptions,
    output,
    message,
    syntaxError,
    outputError,
  };
}
