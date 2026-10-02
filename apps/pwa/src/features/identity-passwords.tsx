import { Button } from '@swiss/ui/components/button';
import { Input } from '@swiss/ui/components/input';
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
  const busy = hash ? state.hashBusy : state.verifyBusy;
  return (
    <section aria-labelledby="identity-title">
      <h1 id="identity-title">{hash ? 'Hash password' : 'Verify password'}</h1>
      <p className="description">
        {hash
          ? 'ASP.NET Identity · salted V3 hashes.'
          : 'ASP.NET Identity V2/V3 · verification updates as you type.'}
      </p>
      <FieldGroup>
        <Field data-disabled={hash && busy}>
          <FieldLabel htmlFor="identity-password">Password</FieldLabel>
          <Input
            id="identity-password"
            type="text"
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
