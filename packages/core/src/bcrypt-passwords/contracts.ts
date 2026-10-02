import type { Result } from '../result';

export const BCRYPT_DEFAULT_COST = 12;
export const BCRYPT_MIN_COST = 4;
export const BCRYPT_MAX_COST = 20;
export const BCRYPT_MAX_PASSWORD_BYTES = 72;

export type BcryptError = {
  code:
    | 'invalid-cost'
    | 'invalid-hash'
    | 'unsupported-cost'
    | 'password-too-long'
    | 'cancelled'
    | 'busy';
};
export type BcryptCostRating =
  'invalid' | 'low' | 'acceptable' | 'recommended' | 'expensive';
export type BcryptRequest =
  | { operation: 'hash'; password: string; cost: number }
  | { operation: 'verify'; password: string; hash: string };
export type BcryptResponse =
  | { kind: 'result'; result: Result<string | boolean, BcryptError> }
  | { kind: 'failure' };

export function isBcryptCost(cost: number): boolean {
  return (
    Number.isInteger(cost) && cost >= BCRYPT_MIN_COST && cost <= BCRYPT_MAX_COST
  );
}

/** Security and latency guidance; deployment hardware still needs benchmarking. */
export function rateBcryptCost(cost: number): BcryptCostRating {
  if (!isBcryptCost(cost)) return 'invalid';
  if (cost < 10) return 'low';
  if (cost < 12) return 'acceptable';
  if (cost < 15) return 'recommended';
  return 'expensive';
}

export function inspectBcryptHash(
  hash: string,
): Result<{ cost: number }, BcryptError> {
  if (!/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(hash))
    return { ok: false, error: { code: 'invalid-hash' } };
  const cost = Number(hash.slice(4, 6));
  if (cost < 4 || cost > 31)
    return { ok: false, error: { code: 'invalid-hash' } };
  if (cost > BCRYPT_MAX_COST)
    return { ok: false, error: { code: 'unsupported-cost' } };
  return { ok: true, value: { cost } };
}

export function validateBcryptRequest(
  request: BcryptRequest,
): BcryptError | undefined {
  if (request.operation === 'hash' && !isBcryptCost(request.cost))
    return { code: 'invalid-cost' };
  if (request.operation === 'verify') {
    const hash = inspectBcryptHash(request.hash);
    if (!hash.ok) return hash.error;
  }
  if (
    new TextEncoder().encode(request.password).byteLength >
    BCRYPT_MAX_PASSWORD_BYTES
  )
    return { code: 'password-too-long' };
}
