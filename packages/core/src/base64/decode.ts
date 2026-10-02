import type { Result } from '../result';

export const MAX_BASE64_INPUT_LENGTH = 65_536;

export type Base64Error =
  { code: 'invalid-input' } | { code: 'input-too-large'; maxLength: number };

export type DecodedBase64 = {
  bytes: Uint8Array;
  output: string;
  format: 'text' | 'hex';
};

/** Accepts standard Base64 or Base64url and preserves UTF-8 and binary output. */
export function decodeBase64(
  input: string,
): Result<DecodedBase64, Base64Error> {
  if (input.length > MAX_BASE64_INPUT_LENGTH) {
    return {
      ok: false,
      error: { code: 'input-too-large', maxLength: MAX_BASE64_INPUT_LENGTH },
    };
  }
  if (/^\p{White_Space}*$/u.test(input)) {
    return {
      ok: true,
      value: { bytes: new Uint8Array(), output: '', format: 'text' },
    };
  }
  let compact = input.replace(/[ \t\r\n]/g, '');
  if (
    !/^[A-Za-z0-9+/_-]*={0,2}$/.test(compact) ||
    (/[-_]/.test(compact) && /[+/]/.test(compact)) ||
    compact.length % 4 === 1
  ) {
    return { ok: false, error: { code: 'invalid-input' } };
  }
  compact = compact.replace(/-/g, '+').replace(/_/g, '/');
  compact = compact.padEnd(Math.ceil(compact.length / 4) * 4, '=');
  let binary: string;
  try {
    binary = atob(compact);
  } catch {
    return { ok: false, error: { code: 'invalid-input' } };
  }
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  try {
    // ignoreBOM preserves U+FEFF, matching the desktop tool's exact text output.
    const text = new TextDecoder('utf-8', {
      fatal: true,
      ignoreBOM: true,
    }).decode(bytes);
    // Control characters intentionally classify decoded content as binary.
    // eslint-disable-next-line no-control-regex
    if (!/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/.test(text)) {
      return { ok: true, value: { bytes, output: text, format: 'text' } };
    }
  } catch {
    // Invalid UTF-8 is binary data, not a partial text result.
  }
  const output = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  return { ok: true, value: { bytes, output, format: 'hex' } };
}
