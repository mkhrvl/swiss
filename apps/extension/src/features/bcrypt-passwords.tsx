import { useEffect, useRef, useState } from 'react';
import {
  BCRYPT_MIN_COST,
  BCRYPT_MAX_COST,
  BCRYPT_MAX_PASSWORD_BYTES,
  inspectBcryptHash,
  isBcryptCost,
  rateBcryptCost,
  type BcryptCostRating,
} from '@swiss/core/bcrypt-passwords';
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from '@swiss/ui/components/alert';
import { Button } from '@swiss/ui/components/button';
import { Input } from '@swiss/ui/components/input';
import { Slider } from '@swiss/ui/components/slider';
import { Textarea } from '@swiss/ui/components/textarea';
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from '@swiss/ui/components/field';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@swiss/ui/components/input-group';
import { useWorkspace } from '../state/workspace';

const guidance: Record<
  BcryptCostRating,
  { label: string; description: string }
> = {
  invalid: {
    label: 'Unsupported cost',
    description: 'Choose a whole number from 4 to 20.',
  },
  low: {
    label: 'Low — avoid for production',
    description:
      'Below OWASP’s minimum bcrypt cost of 10. Useful for quick tests only.',
  },
  acceptable: {
    label: 'Acceptable — meets the minimum',
    description:
      'Meets OWASP’s minimum of 10. Increase the cost if your deployment hardware allows.',
  },
  recommended: {
    label: 'Recommended starting range',
    description:
      '12 is the default. Benchmark hashing and verification on your deployment hardware.',
  },
  expensive: {
    label: 'Very expensive — benchmark first',
    description:
      'High CPU cost. Cost 20 can take minutes in a browser; cancel at any time.',
  },
};

function BcryptHashOutput({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState('');
  const version = useRef(0);
  useEffect(() => {
    version.current += 1;
    setCopied(false);
    setMessage('');
    return () => {
      version.current += 1;
    };
  }, [value]);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);
  async function copy() {
    const current = version.current;
    try {
      await navigator.clipboard.writeText(value);
      if (version.current === current) {
        setCopied(true);
        setMessage('');
      }
    } catch {
      if (version.current === current)
        setMessage('Copy unavailable. Select the hash and copy it manually.');
    }
  }
  return (
    <Field className="mt-6">
      <FieldLabel htmlFor="bcrypt-output">Bcrypt hash</FieldLabel>
      <InputGroup>
        <InputGroupInput
          id="bcrypt-output"
          value={value}
          readOnly
          autoComplete="off"
          spellCheck={false}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            variant="text"
            size="sm"
            aria-label="Copy bcrypt hash"
            disabled={!value}
            onClick={() => void copy()}
          >
            <span aria-live="polite">{copied ? 'COPIED' : 'COPY'}</span>
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      <FieldDescription>
        <output>{message}</output>
      </FieldDescription>
    </Field>
  );
}

export function BcryptPasswords({
  operation,
}: {
  operation: 'hash' | 'verify';
}) {
  const { bcrypt: state } = useWorkspace();
  const hashing = operation === 'hash';
  const title = hashing ? 'Generate bcrypt hash' : 'Verify bcrypt hash';
  const password = hashing ? state.hashPassword : state.verifyPassword;
  const cost = Number(state.cost);
  const rating = rateBcryptCost(cost);
  const costGuidance = guidance[rating];
  const invalidCost = !isBcryptCost(cost);
  const passwordBytes = new TextEncoder().encode(password).byteLength;
  const passwordTooLong = passwordBytes > BCRYPT_MAX_PASSWORD_BYTES;
  const stored = inspectBcryptHash(state.storedHash.trim());
  const invalidHash = !hashing && state.storedHash !== '' && !stored.ok;
  let sliderCost = 12;
  if (Number.isFinite(cost))
    sliderCost = Math.min(
      BCRYPT_MAX_COST,
      Math.max(BCRYPT_MIN_COST, Math.round(cost)),
    );
  let message = hashing ? state.hashMessage : state.verifyMessage;
  if (state.busy && state.busy !== operation)
    message =
      'A bcrypt operation is running in the other tool. Cancel it here or wait for it to finish.';
  return (
    <section aria-labelledby="bcrypt-title">
      <h1 id="bcrypt-title" className="mb-6">
        {title}
      </h1>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (hashing) void state.generate();
          else void state.verify();
        }}
      >
        <FieldGroup>
          <Field data-invalid={passwordTooLong}>
            <FieldLabel htmlFor="bcrypt-password">Password</FieldLabel>
            <Input
              id="bcrypt-password"
              type="text"
              value={password}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-invalid={passwordTooLong}
              aria-describedby="bcrypt-password-guidance bcrypt-feedback"
              onChange={(event) => {
                if (hashing) state.changeHashPassword(event.target.value);
                else state.changeVerifyPassword(event.target.value);
              }}
            />
            <FieldDescription id="bcrypt-password-guidance">
              {passwordBytes} / 72 UTF-8 bytes. Longer passwords are rejected
              without truncation.
            </FieldDescription>
          </Field>
          {hashing && (
            <Field data-invalid={invalidCost}>
              <FieldLabel id="bcrypt-cost-label" htmlFor="bcrypt-cost">
                Cost factor
              </FieldLabel>
              <div className="flex items-center gap-4">
                <Slider
                  className="flex-1"
                  min={BCRYPT_MIN_COST}
                  max={BCRYPT_MAX_COST}
                  step={1}
                  value={[sliderCost]}
                  thumbProps={{
                    'aria-labelledby': 'bcrypt-cost-label',
                    'aria-describedby': 'bcrypt-cost-guidance',
                    'aria-valuetext': `Cost ${sliderCost}`,
                  }}
                  onValueChange={([value]) => {
                    if (value !== undefined) state.changeCost(String(value));
                  }}
                />
                <Input
                  id="bcrypt-cost"
                  className="w-20"
                  type="number"
                  min={BCRYPT_MIN_COST}
                  max={BCRYPT_MAX_COST}
                  step={1}
                  value={state.cost}
                  aria-invalid={invalidCost}
                  aria-describedby="bcrypt-cost-guidance"
                  onChange={(event) => state.changeCost(event.target.value)}
                />
              </div>
              <FieldDescription>
                Each increase doubles the work. Cost is stored in the hash.
              </FieldDescription>
              <Alert
                id="bcrypt-cost-guidance"
                variant={
                  rating === 'low' || rating === 'invalid'
                    ? 'destructive'
                    : 'default'
                }
              >
                <AlertTitle>{costGuidance.label}</AlertTitle>
                <AlertDescription>{costGuidance.description}</AlertDescription>
              </Alert>
            </Field>
          )}
          {!hashing && (
            <Field data-invalid={invalidHash}>
              <FieldLabel htmlFor="bcrypt-stored-hash">
                Stored bcrypt hash
              </FieldLabel>
              <Textarea
                id="bcrypt-stored-hash"
                className="min-h-24 field-sizing-fixed resize-y font-mono"
                value={state.storedHash}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                aria-invalid={invalidHash}
                aria-describedby="bcrypt-hash-guidance bcrypt-feedback"
                onChange={(event) => state.changeStoredHash(event.target.value)}
              />
              <FieldDescription id="bcrypt-hash-guidance">
                Supports $2a$, $2b$ and $2y$ hashes with costs 4–20.
                Verification uses the cost in the stored hash.
                {stored.ok && (
                  <span className="block">
                    Cost {stored.value.cost} ·{' '}
                    {guidance[rateBcryptCost(stored.value.cost)].label}
                  </span>
                )}
              </FieldDescription>
            </Field>
          )}
        </FieldGroup>
        <div className="actions">
          <Button
            type="submit"
            disabled={
              Boolean(state.busy) ||
              passwordTooLong ||
              (hashing && invalidCost) ||
              (!hashing && !state.storedHash.trim())
            }
          >
            {title}
          </Button>
          {state.busy && (
            <Button type="button" variant="outline" onClick={state.cancel}>
              Cancel
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={hashing ? state.clearHash : state.clearVerify}
          >
            Clear
          </Button>
        </div>
      </form>
      <output id="bcrypt-feedback" className="feedback">
        {message}
      </output>
      {hashing && <BcryptHashOutput value={state.generatedHash} />}
    </section>
  );
}
