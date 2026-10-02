export type IdentityError = {
  code: 'invalid-hash' | 'unsupported-hash' | 'cancelled' | 'busy';
};
export type VerificationOutcome = 'match' | 'match-rehash-needed' | 'mismatch';
export type IdentityRequest =
  | { operation: 'hash'; password: string }
  | { operation: 'verify'; password: string; hash: string };
export type IdentityResponse =
  { kind: 'ready' } | { kind: 'result'; value: string } | { kind: 'failure' };
