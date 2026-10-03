import { useEffect, useMemo, useRef, useState } from 'react';
import { highlightJson } from '@swiss/core/json';
import {
  SyntaxHighlight,
  syntaxGutterStyle,
} from '@swiss/ui/components/syntax-highlight';
import { Button } from '@swiss/ui/components/button';
import { Textarea } from '@swiss/ui/components/textarea';
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from '@swiss/ui/components/field';
import {
  InputGroup,
  InputGroupTextarea,
  InputGroupAddon,
  InputGroupButton,
} from '@swiss/ui/components/input-group';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@swiss/ui/components/toggle-group';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@swiss/ui/components/resizable';
import { useWorkspace } from '../state/workspace';

function JsonOutput({ value }: Readonly<{ value: string }>) {
  const id = 'json-output';
  const label = 'JSON output';
  const ranges = useMemo(() => highlightJson(value), [value]);
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
    const current = ++version.current;
    setCopied(false);
    setMessage('');
    try {
      await navigator.clipboard.writeText(value);
      if (version.current === current) setCopied(true);
    } catch {
      if (version.current === current)
        setMessage('Copy unavailable. Select the text and copy it manually.');
    }
  }
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <InputGroup
        className="syntax-surface"
        data-highlighted="true"
        style={syntaxGutterStyle(value)}
      >
        <SyntaxHighlight
          text={value}
          ranges={ranges}
          className="syntax-highlight-group"
        />
        <InputGroupTextarea
          id={id}
          className="syntax-control min-h-24 field-sizing-content resize-none font-mono"
          value={value}
          readOnly
          spellCheck={false}
          aria-describedby={`${id}-copy-feedback`}
        />
        <InputGroupAddon
          align="block-start"
          className="absolute top-1 right-1 w-auto justify-end rounded-md bg-background/90 p-0"
        >
          <InputGroupButton
            variant="text"
            size="sm"
            disabled={!value}
            aria-label={`Copy ${label.toLowerCase()}`}
            onClick={() => void copy()}
          >
            <span aria-live="polite">{copied ? 'COPIED' : 'COPY'}</span>
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      <FieldDescription>
        <output id={`${id}-copy-feedback`}>{message}</output>
      </FieldDescription>
    </Field>
  );
}

export function JsonTools() {
  const { json: state } = useWorkspace();
  const ranges = useMemo(() => highlightJson(state.source), [state.source]);
  const input = useRef<HTMLTextAreaElement>(null);
  const container = useRef<HTMLElement>(null);
  const [sideBySide, setSideBySide] = useState(false);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSideBySide(entry.contentRect.width >= 672);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  function goToError() {
    if (state.syntaxError?.code !== 'invalid-json') return;
    const element = input.current;
    if (!element) return;
    element.focus();
    element.setSelectionRange(
      state.syntaxError.offset,
      state.syntaxError.offset + state.syntaxError.length,
    );
  }
  const inputPanel = (
    <Field data-invalid={Boolean(state.syntaxError)}>
      <FieldLabel htmlFor="json-input">JSON input</FieldLabel>
      <div
        className="syntax-surface relative rounded-md"
        data-highlighted="true"
        style={syntaxGutterStyle(state.source)}
      >
        <SyntaxHighlight text={state.source} ranges={ranges} />
        <Textarea
          ref={input}
          id="json-input"
          className="syntax-control min-h-24 field-sizing-content resize-none font-mono"
          value={state.source}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder={'{"users": [{"name": "Ada"}]}'}
          aria-invalid={Boolean(state.syntaxError)}
          aria-describedby="json-feedback"
          onChange={(event) => state.setSource(event.target.value)}
        />
      </div>
      <FieldDescription>
        <output id="json-feedback">{state.message}</output>
      </FieldDescription>
      {state.syntaxError?.code === 'invalid-json' && (
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          onClick={goToError}
        >
          Go to error
        </Button>
      )}
    </Field>
  );
  const outputPanel = (
    <div className="min-w-0">
      <JsonOutput value={state.output} />
      {state.outputError && (
        <FieldDescription>
          <output>{state.outputError}</output>
        </FieldDescription>
      )}
    </div>
  );
  return (
    <section ref={container} aria-labelledby="json-title">
      <h1 id="json-title" className="mb-6">
        JSON
      </h1>
      <FieldGroup>
        <div className="flex flex-wrap gap-6">
          <Field className="w-auto">
            <FieldLabel id="json-mode-label">Output style</FieldLabel>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={state.options.mode}
              aria-labelledby="json-mode-label"
              onValueChange={(mode) => {
                if (mode === 'format' || mode === 'minify')
                  state.setOptions({ ...state.options, mode });
              }}
            >
              <ToggleGroupItem value="format">Format</ToggleGroupItem>
              <ToggleGroupItem value="minify">Minify</ToggleGroupItem>
            </ToggleGroup>
          </Field>
          <Field
            className="w-auto"
            data-disabled={state.options.mode === 'minify'}
          >
            <FieldLabel id="json-indent-label">Indentation</FieldLabel>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={state.options.indentation}
              disabled={state.options.mode === 'minify'}
              aria-labelledby="json-indent-label"
              onValueChange={(indentation) => {
                if (
                  indentation === '2' ||
                  indentation === '4' ||
                  indentation === 'tab'
                )
                  state.setOptions({ ...state.options, indentation });
              }}
            >
              <ToggleGroupItem value="2">2 spaces</ToggleGroupItem>
              <ToggleGroupItem value="4">4 spaces</ToggleGroupItem>
              <ToggleGroupItem value="tab">Tabs</ToggleGroupItem>
            </ToggleGroup>
          </Field>
        </div>
        <FieldGroup>
          {sideBySide ? (
            <ResizablePanelGroup
              orientation="horizontal"
              className="h-auto items-start gap-3"
              style={{ overflow: 'visible' }}
            >
              <ResizablePanel
                id="json-input-panel"
                defaultSize="50%"
                minSize="240px"
                style={{ overflow: 'visible' }}
              >
                {inputPanel}
              </ResizablePanel>
              <ResizableHandle
                withHandle
                aria-label="Resize JSON panels"
                className="self-stretch"
              />
              <ResizablePanel
                id="json-output-panel"
                defaultSize="50%"
                minSize="240px"
                style={{ overflow: 'visible' }}
              >
                {outputPanel}
              </ResizablePanel>
            </ResizablePanelGroup>
          ) : (
            <FieldGroup>
              {inputPanel}
              {outputPanel}
            </FieldGroup>
          )}
        </FieldGroup>
      </FieldGroup>
    </section>
  );
}
