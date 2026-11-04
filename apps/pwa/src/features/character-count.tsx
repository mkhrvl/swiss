import { useMemo } from 'react';
import { countCharacters } from '@swiss/core/character-count';
import { Button } from '@swiss/ui/components/button';
import { Textarea } from '@swiss/ui/components/textarea';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@swiss/ui/components/field';
import { useWorkspace } from '../state/workspace';

export function CharacterCount() {
  const { characterText, setCharacterText } = useWorkspace();
  const result = useMemo(() => countCharacters(characterText), [characterText]);
  let feedback =
    'Input exceeds 262,144 UTF-16 characters. Shorten it to count.';
  if (result.ok) {
    const unit = result.value === 1 ? 'character' : 'characters';
    feedback = `${result.value.toLocaleString()} ${unit}`;
  }
  return (
    <section aria-labelledby="character-count-title">
      <h1 id="character-count-title" className="mb-6">
        Count characters
      </h1>
      <FieldGroup>
        <Field data-invalid={!result.ok}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <FieldLabel htmlFor="character-count-input">
              Text to count
            </FieldLabel>
            <Button
              variant="outline"
              onClick={() => setCharacterText('')}
              disabled={!characterText}
            >
              Clear
            </Button>
          </div>
          <Textarea
            id="character-count-input"
            className="min-h-64 field-sizing-fixed resize-y"
            autoCapitalize="off"
            autoComplete="off"
            spellCheck={false}
            value={characterText}
            onChange={(event) => setCharacterText(event.target.value)}
            placeholder="Paste or type text…"
            aria-invalid={!result.ok}
            aria-describedby="character-count-help character-count-result"
          />
          <FieldDescription id="character-count-help">
            Includes spaces and line breaks. Emoji and combined letters count as
            one character.
          </FieldDescription>
          <output
            id="character-count-result"
            aria-live="polite"
            className="text-lg font-medium tabular-nums"
          >
            {feedback}
          </output>
        </Field>
      </FieldGroup>
    </section>
  );
}
