import { compareSync, encodeBase64, hashSync } from 'bcryptjs';
import type { Result } from '../result';
import {
  validateBcryptRequest,
  type BcryptError,
  type BcryptRequest,
} from './contracts';

/** Synchronous processing runs only in the host's cancellable worker. */
export function processBcryptRequest(
  request: BcryptRequest,
): Result<string | boolean, BcryptError> {
  const error = validateBcryptRequest(request);
  if (error) return { ok: false, error };
  if (request.operation === 'verify')
    return { ok: true, value: compareSync(request.password, request.hash) };
  // Supply our own salt so generation requires Web Crypto, with no fallback.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const salt = `$2b$${String(request.cost).padStart(2, '0')}$${encodeBase64(bytes, bytes.length)}`;
  return { ok: true, value: hashSync(request.password, salt) };
}
