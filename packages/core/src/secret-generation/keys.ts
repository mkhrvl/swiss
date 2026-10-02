import type { Result } from '../result';
import type {
  JwtHmacAlgorithm,
  SecretEncoding,
  SecretGenerationError,
} from './contracts';

const jwtBytes: Record<JwtHmacAlgorithm, number> = {
  HS256: 32,
  HS384: 48,
  HS512: 64,
};
function generateBytes(
  length: number,
  encoding: SecretEncoding,
): Result<string, SecretGenerationError> {
  if (!['base64url', 'base64', 'hex'].includes(encoding))
    return { ok: false, error: { code: 'invalid-encoding' } };
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  if (encoding === 'hex') {
    return {
      ok: true,
      value: Array.from(bytes, (byte) =>
        byte.toString(16).padStart(2, '0'),
      ).join(''),
    };
  }
  // btoa expects a binary byte string, not Unicode code points.
  const base64 = btoa(String.fromCharCode(...bytes));
  const value =
    encoding === 'base64url'
      ? base64.replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
      : base64;
  return { ok: true, value };
}
/** Generates random token material, without provisioning credentials for any service. */
export function generateApiKey(
  bytes = 32,
  encoding: SecretEncoding = 'base64url',
): Result<string, SecretGenerationError> {
  if (!Number.isInteger(bytes) || bytes < 16 || bytes > 128)
    return { ok: false, error: { code: 'invalid-byte-length' } };
  return generateBytes(bytes, encoding);
}
/** RFC 7518 section 3.2: HMAC keys have at least the hash output's byte length. */
export function generateJwtSigningKey(
  algorithm: JwtHmacAlgorithm = 'HS256',
  encoding: SecretEncoding = 'base64',
): Result<string, SecretGenerationError> {
  if (!Object.hasOwn(jwtBytes, algorithm))
    return { ok: false, error: { code: 'invalid-algorithm' } };
  return generateBytes(jwtBytes[algorithm], encoding);
}
