export type SecretEncoding = 'base64url' | 'base64' | 'hex';
export type JwtHmacAlgorithm = 'HS256' | 'HS384' | 'HS512';
export type PasswordCharacterType =
  'lowercase' | 'uppercase' | 'digits' | 'symbols';
export type PasswordOptions = {
  length: number;
  characterTypes: readonly PasswordCharacterType[];
};
export type SecretGenerationError = {
  code:
    | 'invalid-byte-length'
    | 'invalid-encoding'
    | 'invalid-algorithm'
    | 'invalid-password-length'
    | 'no-character-types'
    | 'invalid-character-type';
};
