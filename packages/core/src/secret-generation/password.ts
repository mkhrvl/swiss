import type { Result } from '../result';
import type {
  PasswordCharacterType,
  PasswordOptions,
  SecretGenerationError,
} from './contracts';

const characters: Record<PasswordCharacterType, string> = {
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digits: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.?/',
};
const defaultOptions: Readonly<PasswordOptions> = {
  length: 20,
  characterTypes: ['lowercase', 'uppercase', 'digits', 'symbols'],
};
export function generatePassword(
  options: Readonly<PasswordOptions> = defaultOptions,
): Result<string, SecretGenerationError> {
  if (
    !Number.isInteger(options.length) ||
    options.length < 8 ||
    options.length > 128
  )
    return { ok: false, error: { code: 'invalid-password-length' } };
  if (!options.characterTypes.length)
    return { ok: false, error: { code: 'no-character-types' } };
  if (options.characterTypes.some((type) => !Object.hasOwn(characters, type)))
    return { ok: false, error: { code: 'invalid-character-type' } };
  const groups = [...new Set(options.characterTypes)].map(
    (type) => characters[type],
  );
  const alphabet = groups.join('');
  const limit = 256 - (256 % alphabet.length);
  const random = new Uint8Array(128);
  let cursor = random.length;
  function nextCharacter() {
    while (true) {
      if (cursor === random.length) {
        crypto.getRandomValues(random);
        cursor = 0;
      }
      const byte = random[cursor++]!;
      // Reject the incomplete range instead of biasing characters with modulo.
      if (byte < limit) return alphabet[byte % alphabet.length]!;
    }
  }
  while (true) {
    const candidate = Array.from(
      { length: options.length },
      nextCharacter,
    ).join('');
    // Condition uniform candidates on containing each selected character type.
    if (
      groups.every((group) =>
        [...candidate].some((char) => group.includes(char)),
      )
    )
      return { ok: true, value: candidate };
  }
}
