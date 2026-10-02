import { afterEach, describe, expect, it, vi } from 'vitest';
import { inspectBcryptHash, isBcryptCost, rateBcryptCost } from './contracts';
import { processBcryptRequest } from './processing';

// Generated independently with Python bcrypt 3.2.2, fixed salt, cost 4.
const fixturePassword = '  café 🔐  ';
const fixtureHash =
  '$2b$04$abcdefghijklmnopqrstuuK3nEtR/OYkgNnPTl7gUVWmBqJNnKuJO';
afterEach(() => vi.unstubAllGlobals());

describe('bcrypt contracts', () => {
  it.each([1, 3, 21, 31, 4.5, NaN, Infinity])(
    'rejects unsupported cost %s rather than clamping it',
    (cost) => {
      expect(isBcryptCost(cost)).toBe(false);
      expect(
        processBcryptRequest({ operation: 'hash', password: 'test', cost }),
      ).toEqual({ ok: false, error: { code: 'invalid-cost' } });
    },
  );
  it.each([4, 12, 20])(
    'accepts valid cost %s without expensive hashing',
    (cost) => expect(isBcryptCost(cost)).toBe(true),
  );
  it.each([
    [3, 'invalid'],
    [4, 'low'],
    [9, 'low'],
    [10, 'acceptable'],
    [11, 'acceptable'],
    [12, 'recommended'],
    [14, 'recommended'],
    [15, 'expensive'],
    [20, 'expensive'],
  ])('rates cost %s as %s', (cost, rating) =>
    expect(rateBcryptCost(Number(cost))).toBe(rating),
  );
  it.each(['2a', '2b', '2y'])(
    'verifies independent %s hashes and preserves exact Unicode/spaces',
    (version) => {
      const hash = fixtureHash.replace('2b', version);
      expect(
        processBcryptRequest({
          operation: 'verify',
          hash,
          password: fixturePassword,
        }),
      ).toEqual({ ok: true, value: true });
      expect(
        processBcryptRequest({
          operation: 'verify',
          hash,
          password: fixturePassword.trim(),
        }),
      ).toEqual({ ok: true, value: false });
    },
  );
  it('generates salted interoperable-format hashes and verifies match/mismatch', () => {
    const request = {
      operation: 'hash',
      password: fixturePassword,
      cost: 4,
    } as const;
    const first = processBcryptRequest(request);
    const second = processBcryptRequest(request);
    expect(first.ok && typeof first.value === 'string').toBe(true);
    if (!first.ok || typeof first.value !== 'string')
      throw new Error('Hash failed');
    expect(inspectBcryptHash(first.value)).toEqual({
      ok: true,
      value: { cost: 4 },
    });
    expect(first).not.toEqual(second);
    expect(
      processBcryptRequest({
        operation: 'verify',
        hash: first.value,
        password: fixturePassword,
      }),
    ).toEqual({ ok: true, value: true });
    expect(
      processBcryptRequest({
        operation: 'verify',
        hash: first.value,
        password: 'wrong',
      }),
    ).toEqual({ ok: true, value: false });
  });
  it('accepts exactly 72 UTF-8 bytes and rejects truncation in hashing and verification', () => {
    const generated = processBcryptRequest({
      operation: 'hash',
      password: 'é'.repeat(36),
      cost: 4,
    });
    expect(generated.ok).toBe(true);
    for (const password of ['a'.repeat(73), 'é'.repeat(37), '🔐'.repeat(19)]) {
      expect(
        processBcryptRequest({ operation: 'hash', password, cost: 4 }),
      ).toEqual({ ok: false, error: { code: 'password-too-long' } });
      expect(
        processBcryptRequest({
          operation: 'verify',
          password,
          hash: fixtureHash,
        }),
      ).toEqual({ ok: false, error: { code: 'password-too-long' } });
    }
  });
  it('supports empty passwords used by existing bcrypt hashes', () =>
    expect(
      processBcryptRequest({
        operation: 'verify',
        password: '',
        hash: '$2b$04$abcdefghijklmnopqrstuubyCG3zY1GIXMyxfivm.ClDiInHzxjiq',
      }),
    ).toEqual({ ok: true, value: true }));
  it.each([
    '',
    fixtureHash.slice(0, -1),
    fixtureHash.replace('$2b$', '$2x$'),
    fixtureHash.replace('$04$', '$03$'),
    fixtureHash.replace('$04$', '$32$'),
    fixtureHash + 'extra',
  ])('rejects malformed hashes before work', (hash) =>
    expect(inspectBcryptHash(hash)).toEqual({
      ok: false,
      error: { code: 'invalid-hash' },
    }),
  );
  it('bounds work encoded in stored hashes before verification', () =>
    expect(
      processBcryptRequest({
        operation: 'verify',
        hash: fixtureHash.replace('$04$', '$21$'),
        password: fixturePassword,
      }),
    ).toEqual({ ok: false, error: { code: 'unsupported-cost' } }));
  it('never falls back when Web Crypto is unavailable', () => {
    vi.stubGlobal('crypto', undefined);
    expect(() =>
      processBcryptRequest({ operation: 'hash', password: 'test', cost: 4 }),
    ).toThrow();
  });
});
