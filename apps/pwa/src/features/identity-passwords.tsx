import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@swiss/ui/components/button';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@swiss/ui/components/input-group';
import { Textarea } from '@swiss/ui/components/textarea';
import { Field, FieldGroup, FieldLabel } from '@swiss/ui/components/field';
import { useWorkspace } from '../state/workspace';
import { Output } from './output';

export function IdentityPasswords({
  operation,
}: {
  operation: 'hash' | 'verify';
}) {
  const { identity: state } = useWorkspace();
  const hash = operation === 'hash';
  const password = hash ? state.hashPassword : state.verifyPassword;
  const show = hash ? state.showHashPassword : state.showVerifyPassword;
  const busy = hash ? state.hashBusy : state.verifyBusy;
  const PasswordVisibilityIcon = show ? EyeOff : Eye;
  return (
    <section aria-labelledby="identity-title">
      <h1 id="identity-title">{hash ? 'Hash password' : 'Verify password'}</h1>
      <p className="description">
        {hash
          ? 'Generate a salted password hash using ASP.NET Identity.'
          : 'Check a password against an existing ASP.NET Identity V2 or V3 hash. Verification updates as you type.'}
      </p>
      <FieldGroup>
        <Field data-disabled={hash && busy}>
          <FieldLabel htmlFor="identity-password">Password</FieldLabel>
          <InputGroup className="password-input">
            <InputGroupInput
              id="identity-password"
              type={show ? 'text' : 'password'}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              value={password}
              disabled={hash && busy}
              onChange={(event) =>
                hash
                  ? state.changeHashPassword(event.target.value)
                  : state.changeVerifyPassword(event.target.value)
              }
              aria-describedby="identity-feedback"
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-sm"
                aria-label={show ? 'Hide password' : 'Show password'}
                aria-pressed={show}
                onClick={() =>
                  hash
                    ? state.setShowHashPassword(!show)
                    : state.setShowVerifyPassword(!show)
                }
              >
                <PasswordVisibilityIcon aria-hidden="true" />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </Field>
        {!hash && (
          <Field>
            <FieldLabel htmlFor="identity-hash">Stored hash</FieldLabel>
            <Textarea
              className="min-h-40 field-sizing-fixed resize-y font-mono"
              id="identity-hash"
              value={state.storedHash}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              onChange={(event) => state.changeStoredHash(event.target.value)}
              aria-describedby="identity-feedback"
            />
          </Field>
        )}
      </FieldGroup>
      <div className="actions">
        {hash && (
          <Button
            variant="default"
            disabled={busy}
            onClick={() => void state.generate()}
          >
            Hash password
          </Button>
        )}
        {busy && (
          <Button
            variant="outline"
            onClick={hash ? state.cancelHash : state.cancelVerify}
          >
            Cancel
          </Button>
        )}
        <Button
          variant="outline"
          onClick={hash ? state.clearHash : state.clearVerify}
        >
          Clear
        </Button>
      </div>
      <output id="identity-feedback" className="feedback">
        {hash ? state.hashMessage : state.verifyMessage}
      </output>
      {hash && <Output value={state.generatedHash} label="Identity hash" />}
    </section>
  );
}
