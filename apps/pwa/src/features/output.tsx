import { Button } from '@swiss/ui/components/button';
import { Textarea } from '@swiss/ui/components/textarea';
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from '@swiss/ui/components/field';
import { useEffect, useState } from 'react';
export function Output({
  value,
  label = 'Output',
}: {
  value: string;
  label?: string;
}) {
  const [status, setStatus] = useState('');
  useEffect(() => {
    setStatus('');
  }, [value]);
  async function copy() {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setStatus('Copied');
    } catch {
      setStatus('Copy unavailable. Select the text and copy manually.');
    }
  }
  return (
    <FieldGroup className="mt-6">
      <Field>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <FieldLabel htmlFor="tool-output">{label}</FieldLabel>
          <Button
            variant="outline"
            disabled={!value}
            onClick={() => void copy()}
          >
            Copy
          </Button>
        </div>
        <Textarea
          className="min-h-40 field-sizing-fixed resize-y font-mono bg-muted/40"
          id="tool-output"
          aria-label={label}
          readOnly
          spellCheck={false}
          value={value}
          onClick={() => void copy()}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void copy();
            }
          }}
        />
        <FieldDescription>
          <output className="feedback">{status}</output>
        </FieldDescription>
      </Field>
    </FieldGroup>
  );
}
