import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateUuid, type UuidVersion } from './index';

afterEach(() => vi.restoreAllMocks());

function value(version: UuidVersion = 4, hyphens = true) {
  const result = generateUuid(version, hyphens);
  if (!result.ok) throw new Error(result.error.code);
  return result.value;
}

describe('UUID generation', () => {
  it('defaults to lowercase v4 with hyphens and preserves random bits', () => {
    vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
      (array as Uint8Array).fill(0xff);
      return array;
    });
    expect(value()).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
  });

  it('matches the RFC 9562 v7 layout with a 48-bit big-endian timestamp', () => {
    vi.spyOn(Date, 'now').mockReturnValue(0x017f22e279b0);
    const random = Uint8Array.from([
      0, 0, 0, 0, 0, 0, 0x0c, 0xc3, 0x18, 0xc4, 0xdc, 0x0c, 0x0c, 0x07, 0x39,
      0x8f,
    ]);
    vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
      (array as Uint8Array).set(random);
      return array;
    });
    expect(value(7)).toBe('017f22e2-79b0-7cc3-98c4-dc0c0c07398f');
  });

  it.each([4, 7] as const)(
    'supports compact v%s without changing its bits',
    (version) => {
      vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
      vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
        (array as Uint8Array).fill(0x12);
        return array;
      });
      expect(value(version, false)).toBe(value(version).replaceAll('-', ''));
      expect(value(version, false)).toMatch(
        new RegExp(`^[0-9a-f]{12}${version}[0-9a-f]{3}[89ab][0-9a-f]{15}$`),
      );
    },
  );

  it.each([4, 7] as const)(
    'generates independent v%s values even within one millisecond',
    (version) => {
      vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
      expect(
        new Set(Array.from({ length: 100 }, () => value(version))).size,
      ).toBe(100);
    },
  );

  it('orders v7 values by timestamp across milliseconds', () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(0);
    const first = value(7);
    clock.mockReturnValue(0xffffffffffff);
    const last = value(7);
    expect(first.startsWith('00000000-0000-7')).toBe(true);
    expect(last.startsWith('ffffffff-ffff-7')).toBe(true);
    expect(first < last).toBe(true);
  });

  it.each([-1, 0x1000000000000, NaN, 1.5])(
    'rejects unrepresentable v7 system time %s',
    (timestamp) => {
      vi.spyOn(Date, 'now').mockReturnValue(timestamp);
      expect(() => value(7)).toThrow('timestamp range');
    },
  );

  it('rejects unsupported options before requesting randomness', () => {
    const random = vi.spyOn(crypto, 'getRandomValues');
    expect(generateUuid(6 as UuidVersion)).toEqual({
      ok: false,
      error: { code: 'invalid-uuid-version' },
    });
    expect(generateUuid(4, 'false' as unknown as boolean)).toEqual({
      ok: false,
      error: { code: 'invalid-uuid-hyphens' },
    });
    expect(random).not.toHaveBeenCalled();
  });

  it('never falls back to insecure randomness', () => {
    vi.spyOn(crypto, 'getRandomValues').mockImplementation(() => {
      throw new Error('RNG unavailable');
    });
    const insecure = vi.spyOn(Math, 'random');
    expect(() => value(4)).toThrow('RNG unavailable');
    expect(() => value(7)).toThrow('RNG unavailable');
    expect(insecure).not.toHaveBeenCalled();
  });
});
