import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  generateApiKey,
  generateJwtSigningKey,
  generatePassword,
  type PasswordCharacterType,
  type SecretEncoding,
  type JwtHmacAlgorithm,
} from './index';

function value(result: ReturnType<typeof generateApiKey>) {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.code);
  return result.value;
}
afterEach(() => vi.restoreAllMocks());

describe('API key generation', () => {
  it('defaults to 256 bits encoded without URL-unsafe characters or padding', () => {
    const key = value(generateApiKey());
    expect(key).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(key, 'base64url')).toHaveLength(32);
  });
  it.each(['base64url', 'base64', 'hex'] as const)(
    'preserves every random byte in %s',
    (encoding) => {
      vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
        (array as Uint8Array).fill(255);
        return array;
      });
      const key = value(generateApiKey(16, encoding));
      expect(Buffer.from(key, encoding)).toEqual(Buffer.alloc(16, 255));
      if (encoding === 'hex') expect(key).toBe('ff'.repeat(16));
      if (encoding === 'base64url') expect(key).not.toMatch(/[+/=]/);
    },
  );
  it.each([0, 15, 129, 16.5, NaN, Infinity])(
    'rejects invalid byte length %s',
    (length) => {
      expect(generateApiKey(length)).toEqual({
        ok: false,
        error: { code: 'invalid-byte-length' },
      });
    },
  );
  it('rejects an unsupported encoding without generating randomness', () => {
    const random = vi.spyOn(crypto, 'getRandomValues');
    expect(generateApiKey(32, 'broken' as SecretEncoding)).toEqual({
      ok: false,
      error: { code: 'invalid-encoding' },
    });
    expect(random).not.toHaveBeenCalled();
  });
});

describe('JWT HMAC signing keys', () => {
  it.each([
    ['HS256', 32, 'SHA-256'],
    ['HS384', 48, 'SHA-384'],
    ['HS512', 64, 'SHA-512'],
  ] as const)(
    'generates a usable %s key of the required size',
    async (algorithm, size, hash) => {
      const encoded = value(generateJwtSigningKey(algorithm));
      const bytes = Buffer.from(encoded, 'base64');
      expect(bytes).toHaveLength(size);
      const key = await crypto.subtle.importKey(
        'raw',
        bytes,
        { name: 'HMAC', hash },
        false,
        ['sign', 'verify'],
      );
      const payload = new TextEncoder().encode(
        'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0',
      );
      const signature = await crypto.subtle.sign('HMAC', key, payload);
      expect(await crypto.subtle.verify('HMAC', key, signature, payload)).toBe(
        true,
      );
      expect(
        await crypto.subtle.verify('HMAC', key, signature, new Uint8Array([1])),
      ).toBe(false);
    },
  );
  it('rejects unsupported algorithms including object property names', () => {
    for (const algorithm of ['RS256', 'toString', '__proto__'])
      expect(generateJwtSigningKey(algorithm as JwtHmacAlgorithm)).toEqual({
        ok: false,
        error: { code: 'invalid-algorithm' },
      });
  });
});

describe('password generation', () => {
  it('defaults to 20 characters with all selected types represented', () => {
    const password = value(generatePassword());
    expect(password).toHaveLength(20);
    expect(password).toMatch(/[a-z]/);
    expect(password).toMatch(/[A-Z]/);
    expect(password).toMatch(/[0-9]/);
    expect(password).toMatch(/[^A-Za-z0-9]/);
    expect(password).not.toMatch(/\s/);
  });
  it.each([
    ['lowercase', /^[a-z]{128}$/],
    ['uppercase', /^[A-Z]{128}$/],
    ['digits', /^[0-9]{128}$/],
    ['symbols', /^[!@#$%^&*()\-_=+[\]{};:,.?/]{128}$/],
  ] as const)('uses only the selected %s type', (type, pattern) => {
    expect(
      value(generatePassword({ length: 128, characterTypes: [type] })),
    ).toMatch(pattern);
  });
  it('rejects whole candidates missing selected character types at the minimum length', () => {
    vi.spyOn(crypto, 'getRandomValues')
      .mockImplementationOnce((array) => {
        (array as Uint8Array).fill(0);
        return array;
      })
      .mockImplementation((array) => {
        const bytes = array as Uint8Array;
        bytes.forEach((_, index) => {
          bytes[index] = [0, 26, 52, 62][index % 4]!;
        });
        return array;
      });
    expect(
      value(
        generatePassword({
          length: 8,
          characterTypes: ['lowercase', 'uppercase', 'digits', 'symbols'],
        }),
      ),
    ).toBe('aA0!aA0!');
  });
  it('rejects biased random bytes before sampling characters', () => {
    vi.spyOn(crypto, 'getRandomValues')
      .mockImplementationOnce((array) => {
        (array as Uint8Array).fill(255);
        return array;
      })
      .mockImplementation((array) => {
        (array as Uint8Array).fill(0);
        return array;
      });
    expect(
      value(generatePassword({ length: 8, characterTypes: ['lowercase'] })),
    ).toBe('aaaaaaaa');
  });
  it('deduplicates character groups instead of weighting duplicate selections', () => {
    vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
      (array as Uint8Array).fill(26);
      return array;
    });
    expect(
      value(
        generatePassword({
          length: 8,
          characterTypes: ['lowercase', 'lowercase'],
        }),
      ),
    ).toBe('aaaaaaaa');
  });
  it.each([0, 7, 129, 20.5, NaN, Infinity])(
    'rejects invalid length %s',
    (length) => {
      expect(
        generatePassword({ length, characterTypes: ['lowercase'] }),
      ).toEqual({ ok: false, error: { code: 'invalid-password-length' } });
    },
  );
  it('requires at least one known character type', () => {
    expect(generatePassword({ length: 20, characterTypes: [] })).toEqual({
      ok: false,
      error: { code: 'no-character-types' },
    });
    expect(
      generatePassword({
        length: 20,
        characterTypes: ['toString' as PasswordCharacterType],
      }),
    ).toEqual({ ok: false, error: { code: 'invalid-character-type' } });
  });
  it('does not fall back to insecure randomness when cryptography fails', () => {
    vi.spyOn(crypto, 'getRandomValues').mockImplementation(() => {
      throw new Error('RNG unavailable');
    });
    const insecure = vi.spyOn(Math, 'random');
    expect(() => generatePassword()).toThrow('RNG unavailable');
    expect(() => generateApiKey()).toThrow('RNG unavailable');
    expect(() => generateJwtSigningKey()).toThrow('RNG unavailable');
    expect(insecure).not.toHaveBeenCalled();
  });
});
