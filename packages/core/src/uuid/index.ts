import type { Result } from '../result';

export type UuidVersion = 4 | 7;
export type UuidOptions = { version: UuidVersion; hyphens: boolean };
export type UuidError = {
  code: 'invalid-uuid-version' | 'invalid-uuid-hyphens';
};

/** RFC 9562 UUIDs: random v4, or v7 with a Unix millisecond timestamp and random tail. */
export function generateUuid(
  version: UuidVersion = 4,
  hyphens = true,
): Result<string, UuidError> {
  if (version !== 4 && version !== 7)
    return { ok: false, error: { code: 'invalid-uuid-version' } };
  if (typeof hyphens !== 'boolean')
    return { ok: false, error: { code: 'invalid-uuid-hyphens' } };

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  if (version === 7) {
    let timestamp = Date.now();
    if (
      !Number.isInteger(timestamp) ||
      timestamp < 0 ||
      timestamp > 0xffffffffffff
    )
      throw new Error('System time is outside the UUID v7 timestamp range');
    for (let index = 5; index >= 0; index--) {
      bytes[index] = timestamp % 256;
      timestamp = Math.floor(timestamp / 256);
    }
  }
  bytes[6] = (version << 4) | (bytes[6]! & 0x0f);
  bytes[8] = 0x80 | (bytes[8]! & 0x3f);
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  const value = hyphens
    ? `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
    : hex;
  return { ok: true, value };
}
