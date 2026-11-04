import { useMemo } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import {
  compareTexts,
  MAX_TEXT_DIFF_INPUT_LENGTH,
} from '@swiss/core/text-diff';
import { Button } from '@swiss/ui/components/button';
import { Textarea } from '@swiss/ui/components/textarea';
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from '@swiss/ui/components/field';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@swiss/ui/components/card';
import {
  Empty,
  EmptyHeader,
  EmptyDescription,
} from '@swiss/ui/components/empty';
import { useWorkspace } from '../state/workspace';

export function TextComparison() {
  const { textDiff, setTextDiff } = useWorkspace();
  const { original, revised } = textDiff;
  const result = useMemo(
    () => compareTexts(original, revised),
    [original, revised],
  );
  const hasInput = Boolean(original || revised);
  let message = 'Enter text on either side to compare.';
  if (!result.ok) {
    message =
      'Each text can contain up to 32,768 characters. Shorten the text to compare.';
  } else if (hasInput) {
    message =
      result.value.added || result.value.removed
        ? `${result.value.added.toLocaleString()} characters added · ${result.value.removed.toLocaleString()} characters removed`
        : 'Texts are identical.';
  }
  return (
    <section aria-labelledby="text-diff-title" className="@container/text-diff">
      <h1 id="text-diff-title">Compare text</h1>
      <p className="description">
        See what changed between two versions. Words, spaces and line breaks are
        compared exactly.
      </p>
      <div className="mb-4 flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={!hasInput}
          onClick={() => setTextDiff({ original: revised, revised: original })}
        >
          <ArrowLeftRight data-icon="inline-start" />
          Swap texts
        </Button>
        <Button
          variant="outline"
          disabled={!hasInput}
          onClick={() => setTextDiff({ original: '', revised: '' })}
        >
          Clear
        </Button>
      </div>
      <FieldGroup className="grid grid-cols-1 gap-4 @min-[640px]/text-diff:grid-cols-2">
        {(['original', 'revised'] as const).map((side) => {
          const label = side === 'original' ? 'Original text' : 'Revised text';
          const invalid = textDiff[side].length > MAX_TEXT_DIFF_INPUT_LENGTH;
          return (
            <Field key={side} className="min-w-0" data-invalid={invalid}>
              <FieldLabel htmlFor={`text-diff-${side}`}>{label}</FieldLabel>
              <Textarea
                id={`text-diff-${side}`}
                className="min-h-48 field-sizing-fixed resize-y font-mono"
                value={textDiff[side]}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                placeholder={`Paste ${label.toLowerCase()}…`}
                aria-invalid={invalid}
                aria-describedby={`text-diff-${side}-count text-diff-feedback`}
                onChange={(event) =>
                  setTextDiff({ ...textDiff, [side]: event.target.value })
                }
              />
              <FieldDescription
                id={`text-diff-${side}-count`}
                className="tabular-nums"
              >
                {textDiff[side].length.toLocaleString()} /{' '}
                {MAX_TEXT_DIFF_INPUT_LENGTH.toLocaleString()}
              </FieldDescription>
            </Field>
          );
        })}
      </FieldGroup>
      <Card className="mt-6 min-w-0">
        <CardHeader>
          <CardTitle>Differences</CardTitle>
          <CardDescription>
            <output id="text-diff-feedback" aria-live="polite">
              {message}
            </output>
          </CardDescription>
          <p id="text-diff-legend" className="flex flex-wrap gap-4 text-sm">
            <span className="text-diff-removed">− Removed</span>
            <span className="text-diff-added">+ Added</span>
          </p>
        </CardHeader>
        <CardContent>
          {result.ok && hasInput ? (
            <>
              <div className="text-diff-surface">
                <pre
                  id="text-diff-result"
                  className="text-diff-highlight"
                  aria-hidden="true"
                >
                  {result.value.segments.map((segment, index) => {
                    if (segment.kind === 'removed')
                      return (
                        <del key={index} className="text-diff-removed">
                          {segment.text}
                        </del>
                      );
                    if (segment.kind === 'added')
                      return (
                        <ins key={index} className="text-diff-added">
                          {segment.text}
                        </ins>
                      );
                    return <span key={index}>{segment.text}</span>;
                  })}
                </pre>
                <Textarea
                  id="text-diff-output"
                  className="text-diff-control min-h-24 field-sizing-content resize-none font-mono"
                  value={result.value.segments
                    .map((segment) => segment.text)
                    .join('')}
                  readOnly
                  spellCheck={false}
                  aria-label="Text differences"
                  aria-describedby="text-diff-legend"
                />
              </div>
              {result.value.grouped && (
                <p className="mt-3 text-sm text-muted-foreground">
                  Large changes are grouped into broader blocks to keep
                  comparison responsive.
                </p>
              )}
            </>
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyDescription>
                  {result.ok
                    ? 'Paste your versions above. Changes appear as you type.'
                    : 'Shorten the input above to see differences.'}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
