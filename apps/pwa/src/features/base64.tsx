import { Button } from '@swiss/ui/components/button';
import { Textarea } from '@swiss/ui/components/textarea';
import { Field, FieldGroup, FieldLabel } from '@swiss/ui/components/field';
import { decodeBase64, MAX_BASE64_INPUT_LENGTH } from '@swiss/core/base64';
import { useWorkspace } from '../state/workspace';
import { Output } from './output';
export function Base64() {
  const { base64, setBase64 } = useWorkspace();
  const result = decodeBase64(base64);
  let message = '';
  if (!result.ok) {
    message =
      result.error.code === 'input-too-large'
        ? 'Input exceeds 65,536 characters. Shorten it to decode.'
        : 'Enter valid Base64 or Base64url.';
  }
  return (
    <section aria-labelledby="base64-title">
      <h1 id="base64-title" className="mb-6">
        Decode Base64
      </h1>
      <FieldGroup>
        <Field data-invalid={!result.ok}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <FieldLabel htmlFor="base64-input">Encoded input</FieldLabel>
            <Button
              variant="outline"
              onClick={() => setBase64('')}
              disabled={!base64}
            >
              Clear
            </Button>
          </div>
          <Textarea
            className="min-h-40 field-sizing-fixed resize-y font-mono"
            id="base64-input"
            autoCapitalize="off"
            autoComplete="off"
            spellCheck={false}
            value={base64}
            onChange={(event) => setBase64(event.target.value)}
            placeholder="Paste Base64 or Base64url…"
            aria-invalid={!result.ok}
            aria-describedby="base64-help"
          />
          <div className="flex items-center justify-between gap-3 flex-wrap text-sm text-muted-foreground">
            <output id="base64-help">
              {message || 'Standard and URL alphabets · padding optional'}
            </output>
            <span>
              {base64.length.toLocaleString()} /{' '}
              {MAX_BASE64_INPUT_LENGTH.toLocaleString()}
            </span>
          </div>
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
