import { useEffect, useRef, useState } from 'react';
import {
  generateApiKey,
  generateJwtSigningKey,
  generatePassword,
  type SecretEncoding,
  type JwtHmacAlgorithm,
  type PasswordCharacterType,
  type SecretGenerationError,
} from '@swiss/core/secret-generation';

export type ApiKeyOptions = { bytes: string; encoding: SecretEncoding };
export type JwtKeyOptions = {
  algorithm: JwtHmacAlgorithm;
  encoding: SecretEncoding;
};
export type RandomPasswordOptions = {
  length: string;
  characterTypes: PasswordCharacterType[];
};
const errors: Record<SecretGenerationError['code'], string> = {
  'invalid-byte-length': 'Choose a whole number from 16 to 128 random bytes.',
  'invalid-encoding': 'Choose Base64url, Base64, or Hex.',
  'invalid-algorithm': 'Choose HS256, HS384, or HS512.',
  'invalid-password-length': 'Choose a whole number from 8 to 128 characters.',
  'no-character-types': 'Select at least one character type.',
  'invalid-character-type': 'Choose one of the listed character types.',
};
const resultCount = 5;
const resultIndices = Array.from({ length: resultCount }, (_, index) => index);
type GeneratedSecret = { value: string; copied: boolean };
function emptyResults(): GeneratedSecret[] {
  return resultIndices.map(() => ({ value: '', copied: false }));
}
function useGeneratedSecrets(
  factory: () => ReturnType<typeof generateApiKey>,
  options: object,
) {
  const [results, setResults] = useState(emptyResults);
  const generatedOptions = useRef<object | undefined>(undefined);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<SecretGenerationError['code']>();
  const versions = useRef(resultIndices.map(() => 0));
  const timers = useRef<(ReturnType<typeof setTimeout> | undefined)[]>([]);
  const feedbackVersion = useRef(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      for (const index of resultIndices) {
        versions.current[index] = (versions.current[index] ?? 0) + 1;
        clearTimeout(timers.current[index]);
      }
    };
  }, []);
  function invalidate(index: number) {
    versions.current[index] = (versions.current[index] ?? 0) + 1;
    clearTimeout(timers.current[index]);
    timers.current[index] = undefined;
  }
  function reset(indices: number[]) {
    feedbackVersion.current++;
    for (const index of indices) invalidate(index);
    setResults((current) =>
      current.map((result, index) =>
        indices.includes(index) ? { value: '', copied: false } : result,
      ),
    );
    setMessage('');
    setError(undefined);
  }
  function clear() {
    reset(resultIndices);
  }
  function generate(index?: number) {
    generatedOptions.current = options;
    const indices = index === undefined ? resultIndices : [index];
    reset(indices);
    try {
      const values = new Map<number, string>();
      for (const target of indices) {
        const result = factory();
        if (!result.ok) {
          setError(result.error.code);
          setMessage(errors[result.error.code]);
          return;
        }
        values.set(target, result.value);
      }
      setResults((current) =>
        current.map((result, target) => {
          const value = values.get(target);
          return value === undefined ? result : { value, copied: false };
        }),
      );
    } catch {
      setMessage(
        'Secure generation is unavailable. Use a browser with Web Crypto support.',
      );
    }
  }
  async function copy(index: number) {
    const value = results[index]?.value;
    if (!value) return;
    invalidate(index);
    const version = versions.current[index];
    const feedback = ++feedbackVersion.current;
    setMessage('');
    setResults((current) =>
      current.map((result, target) =>
        target === index ? { ...result, copied: false } : result,
      ),
    );
    try {
      await navigator.clipboard.writeText(value);
      if (!alive.current || version !== versions.current[index]) return;
      setResults((current) =>
        current.map((result, target) =>
          target === index ? { ...result, copied: true } : result,
        ),
      );
      timers.current[index] = setTimeout(() => {
        if (!alive.current || version !== versions.current[index]) return;
        setResults((current) =>
          current.map((result, target) =>
            target === index ? { ...result, copied: false } : result,
          ),
        );
        timers.current[index] = undefined;
      }, 2000);
    } catch {
      if (
        alive.current &&
        version === versions.current[index] &&
        feedback === feedbackVersion.current
      )
        setMessage('Copy unavailable. Select the value and copy it manually.');
    }
  }
  function ensureGenerated() {
    if (generatedOptions.current !== options) generate();
  }
  return { results, message, error, clear, generate, ensureGenerated, copy };
}
export function useSecretGenerators() {
  const [apiOptions, setApiOptions] = useState<ApiKeyOptions>({
    bytes: '32',
    encoding: 'base64url',
  });
  const [jwtOptions, setJwtOptions] = useState<JwtKeyOptions>({
    algorithm: 'HS256',
    encoding: 'base64',
  });
  const [passwordOptions, setPasswordOptions] = useState<RandomPasswordOptions>(
    {
      length: '20',
      characterTypes: ['lowercase', 'uppercase', 'digits', 'symbols'],
    },
  );
  const api = useGeneratedSecrets(
    () => generateApiKey(Number(apiOptions.bytes), apiOptions.encoding),
    apiOptions,
  );
  const jwt = useGeneratedSecrets(
    () => generateJwtSigningKey(jwtOptions.algorithm, jwtOptions.encoding),
    jwtOptions,
  );
  const password = useGeneratedSecrets(
    () =>
      generatePassword({
        length: Number(passwordOptions.length),
        characterTypes: passwordOptions.characterTypes,
      }),
    passwordOptions,
  );
  return {
    api: {
      ...api,
      options: apiOptions,
      change(options: Partial<ApiKeyOptions>) {
        setApiOptions((current) => ({ ...current, ...options }));
        api.clear();
      },
    },
    jwt: {
      ...jwt,
      options: jwtOptions,
      change(options: Partial<JwtKeyOptions>) {
        setJwtOptions((current) => ({ ...current, ...options }));
        jwt.clear();
      },
    },
    password: {
      ...password,
      options: passwordOptions,
      change(options: Partial<RandomPasswordOptions>) {
        setPasswordOptions((current) => ({ ...current, ...options }));
        password.clear();
      },
    },
  };
}
