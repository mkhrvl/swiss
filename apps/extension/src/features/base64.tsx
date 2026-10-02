import { Button } from '@swiss/ui/components/button';
import { Textarea } from '@swiss/ui/components/textarea';
import { Field, FieldGroup, FieldLabel } from '@swiss/ui/components/field';
import { decodeBase64 } from '@swiss/core/base64';
import { useWorkspace } from '../state/workspace';
import { Output } from './output';
export function Base64() {
  const { base64, setBase64 } = useWorkspace();
  const result = decodeBase64(base64);
  let message;
  if (result.ok) {
    message = `${base64.length.toLocaleString()} / 65,536 characters`;
  } else {
    message =
      result.error.code === 'input-too-large'
        ? 'Input exceeds 65,536 characters.'
        : 'Enter valid Base64 or Base64url.';
  }
  return (
    <section aria-labelledby="base64-title">
      <h1 id="base64-title">Decode Base64</h1>
      <p className="description">
        Standard or URL alphabet. Padding is optional.
      </p>
      <FieldGroup>
        <Field data-invalid={!result.ok}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <FieldLabel htmlFor="base64-input">Encoded input</FieldLabel>
            <Button
              variant="outline"
              size="sm"
              disabled={!base64}
              onClick={() => setBase64('')}
            >
              Clear
            </Button>
          </div>
          <Textarea
            className="min-h-40 field-sizing-fixed resize-y font-mono"
            id="base64-input"
            value={base64}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            onChange={(event) => setBase64(event.target.value)}
            placeholder="Paste or use the selection menu…"
            aria-invalid={!result.ok}
            aria-describedby="base64-help"
          />
          <output id="base64-help" className="feedback">
            {message}
          </output>
        </Field>
      </FieldGroup>
      <Output
        value={result.ok ? result.value.output : ''}
        label={
          result.ok && result.value.format === 'hex'
            ? 'Decoded bytes (hex)'
            : 'Decoded text'
        }
      />
    </section>
  );
}
