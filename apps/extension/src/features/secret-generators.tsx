import { useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@swiss/ui/components/button';
import { Checkbox } from '@swiss/ui/components/checkbox';
import { Input } from '@swiss/ui/components/input';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@swiss/ui/components/input-group';
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldSet,
  FieldLegend,
  FieldTitle,
} from '@swiss/ui/components/field';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@swiss/ui/components/toggle-group';
import type {
  PasswordCharacterType,
  SecretEncoding,
  JwtHmacAlgorithm,
} from '@swiss/core/secret-generation';
import { useWorkspace } from '../state/workspace';

const encodings: { value: SecretEncoding; label: string }[] = [
  { value: 'base64url', label: 'Base64url' },
  { value: 'base64', label: 'Base64' },
  { value: 'hex', label: 'Hex' },
];
const characterTypes: { value: PasswordCharacterType; label: string }[] = [
  { value: 'lowercase', label: 'Lowercase letters (a–z)' },
  { value: 'uppercase', label: 'Uppercase letters (A–Z)' },
  { value: 'digits', label: 'Digits (0–9)' },
  { value: 'symbols', label: 'Symbols (!@#$…)' },
];
const descriptions = {
  'api-key':
    'Generate a random token for your own API. Creating a token here does not register it with a service.',
  'jwt-key':
    'Generate a shared secret for HMAC JWT signing. The same secret signs and verifies tokens.',
  'random-password':
    'Generate a random password with at least one character from each selected type.',
};
const titles = {
  'api-key': 'Generate API key',
  'jwt-key': 'Generate JWT signing key',
  'random-password': 'Generate password',
};
const outputLabels = {
  'api-key': 'API key',
  'jwt-key': 'JWT signing key',
  'random-password': 'Generated password',
};

export function SecretGenerators({
  kind,
}: {
  kind: 'api-key' | 'jwt-key' | 'random-password';
}) {
  const { generators } = useWorkspace();
  let state: Pick<
    typeof generators.api,
    | 'results'
    | 'message'
    | 'error'
    | 'clear'
    | 'generate'
    | 'ensureGenerated'
    | 'copy'
  > = generators.api;
  if (kind === 'jwt-key') state = generators.jwt;
  if (kind === 'random-password') state = generators.password;
  const { ensureGenerated } = state;
  useEffect(() => {
    ensureGenerated();
  }, [ensureGenerated]);
  let encoding: SecretEncoding = generators.api.options.encoding;
  if (kind === 'jwt-key') encoding = generators.jwt.options.encoding;
  let decoding = 'Base64';
  if (encoding === 'base64url') decoding = 'Base64url';
  if (encoding === 'hex') decoding = 'Hex';
  const invalidLength =
    state.error === 'invalid-byte-length' ||
    state.error === 'invalid-password-length';
  const invalidTypes =
    state.error === 'no-character-types' ||
    state.error === 'invalid-character-type';
  return (
    <section aria-labelledby="generator-title">
      <h1 id="generator-title">{titles[kind]}</h1>
      <p className="description">{descriptions[kind]}</p>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          state.generate();
        }}
      >
        <FieldGroup>
          {kind === 'api-key' && (
            <Field data-invalid={invalidLength}>
              <FieldLabel htmlFor="generator-length">Random bytes</FieldLabel>
              <Input
                id="generator-length"
                type="number"
                min={16}
                max={128}
                step={1}
                value={generators.api.options.bytes}
                aria-invalid={invalidLength}
                aria-describedby="generator-feedback"
                onChange={(event) =>
                  generators.api.change({ bytes: event.target.value })
                }
              />
              <FieldDescription>
                16–128 bytes. The default 32 bytes provides 256 bits of
                randomness.
              </FieldDescription>
            </Field>
          )}
          {kind === 'jwt-key' && (
            <Field>
              <FieldTitle id="algorithm-label">Signing algorithm</FieldTitle>
              <ToggleGroup
                type="single"
                variant="outline"
                value={generators.jwt.options.algorithm}
                aria-labelledby="algorithm-label"
                onValueChange={(value) => {
                  if (value)
                    generators.jwt.change({
                      algorithm: value as JwtHmacAlgorithm,
                    });
                }}
              >
                <ToggleGroupItem value="HS256">HS256</ToggleGroupItem>
                <ToggleGroupItem value="HS384">HS384</ToggleGroupItem>
                <ToggleGroupItem value="HS512">HS512</ToggleGroupItem>
              </ToggleGroup>
              <FieldDescription>
                Uses 32, 48, or 64 random bytes for HS256, HS384, or HS512
                respectively.
              </FieldDescription>
            </Field>
          )}
          {kind !== 'random-password' && (
            <Field>
              <FieldTitle id="encoding-label">Encoding</FieldTitle>
              <ToggleGroup
                type="single"
                variant="outline"
                value={encoding}
                aria-labelledby="encoding-label"
                onValueChange={(value) => {
                  if (!value) return;
                  if (kind === 'api-key')
                    generators.api.change({
                      encoding: value as SecretEncoding,
                    });
                  else
                    generators.jwt.change({
                      encoding: value as SecretEncoding,
                    });
                }}
              >
                {encodings.map((option) => (
                  <ToggleGroupItem key={option.value} value={option.value}>
                    {option.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              {kind === 'jwt-key' && (
                <FieldDescription>
                  Decode the generated {decoding} value to bytes before using it
                  as the signing key.
                </FieldDescription>
              )}
            </Field>
          )}
          {kind === 'random-password' && (
            <>
              <Field data-invalid={invalidLength}>
                <FieldLabel htmlFor="generator-length">
                  Password length
                </FieldLabel>
                <Input
                  id="generator-length"
                  type="number"
                  min={8}
                  max={128}
                  step={1}
                  value={generators.password.options.length}
                  aria-invalid={invalidLength}
                  aria-describedby="generator-feedback"
                  onChange={(event) =>
                    generators.password.change({ length: event.target.value })
                  }
                />
                <FieldDescription>8–128 characters.</FieldDescription>
              </Field>
              <FieldSet>
                <FieldLegend variant="label">Character types</FieldLegend>
                <FieldGroup className="gap-3">
                  {characterTypes.map((option) => (
                    <Field
                      key={option.value}
                      orientation="horizontal"
                      data-invalid={invalidTypes}
                    >
                      <Checkbox
                        id={`characters-${option.value}`}
                        checked={generators.password.options.characterTypes.includes(
                          option.value,
                        )}
                        aria-invalid={invalidTypes}
                        aria-describedby="generator-feedback"
                        onCheckedChange={(checked) => {
                          const types =
                            generators.password.options.characterTypes.filter(
                              (type) => type !== option.value,
                            );
                          if (checked === true) types.push(option.value);
                          generators.password.change({ characterTypes: types });
                        }}
                      />
                      <FieldLabel htmlFor={`characters-${option.value}`}>
                        {option.label}
                      </FieldLabel>
                    </Field>
                  ))}
                </FieldGroup>
              </FieldSet>
            </>
          )}
        </FieldGroup>
        <div className="actions">
          <Button size="sm" type="submit">
            {titles[kind]}
          </Button>
          <Button
            size="sm"
            type="button"
            variant="outline"
            onClick={state.clear}
          >
            Clear
          </Button>
        </div>
      </form>
      <FieldSet className="mt-6">
        <FieldLegend>{outputLabels[kind]} results</FieldLegend>
        <FieldGroup className="gap-3">
          {state.results.map((result, index) => {
            const label = `${outputLabels[kind]} ${index + 1}`;
            return (
              <Field key={index}>
                <FieldLabel
                  htmlFor={`generated-secret-${index + 1}`}
                  className="sr-only"
                >
                  {label}
                </FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id={`generated-secret-${index + 1}`}
                    type="text"
                    value={result.value}
                    readOnly
                    autoComplete="off"
                    spellCheck={false}
                    aria-describedby="generator-feedback"
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      size="xs"
                      variant="text"
                      aria-label={`Regenerate ${label}`}
                      title={`Regenerate ${label}`}
                      disabled={!result.value}
                      onClick={() => state.generate(index)}
                    >
                      <RefreshCw aria-hidden="true" data-icon="inline-end" />
                    </InputGroupButton>
                    <InputGroupButton
                      size="sm"
                      variant="text"
                      aria-label={`Copy ${label}`}
                      disabled={!result.value}
                      onClick={() => void state.copy(index)}
                    >
                      <span aria-live="polite">
                        {result.copied ? 'COPIED' : 'COPY'}
                      </span>
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
              </Field>
            );
          })}
        </FieldGroup>
      </FieldSet>
      <output id="generator-feedback" className="feedback">
        {state.message}
      </output>
    </section>
  );
}
