import { Button } from '@swiss/ui/components/button';
import { Input } from '@swiss/ui/components/input';
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from '@swiss/ui/components/field';
import { Progress } from '@swiss/ui/components/progress';
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
} from '@swiss/ui/components/empty';
import { ScanText } from 'lucide-react';
import { useWorkspace } from '../state/workspace';
import { ImageRegionPicker } from './image-region';
import { Output } from './output';
export function Ocr() {
  const state = useWorkspace();
  return (
    <section
      aria-labelledby="ocr-title"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const file = event.dataTransfer.files[0];
        if (file) void state.selectImage(file, file.name);
      }}
      onPaste={(event) => {
        const item = Array.from(event.clipboardData.items).find((item) =>
          item.type.startsWith('image/'),
        );
        const file = item?.getAsFile();
        if (file) {
          event.preventDefault();
          void state.selectImage(file);
        }
      }}
    >
      <h1 id="ocr-title">Extract text</h1>
      <p className="description">
        English OCR, processed on your device. Upload, drop or paste an image,
        then choose the text you need.
      </p>
      <FieldGroup className="mb-6">
        <Field>
          <FieldLabel htmlFor="image-input">Choose image</FieldLabel>
          <Input
            id="image-input"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void state.selectImage(file, file.name);
              event.target.value = '';
            }}
          />
          <FieldDescription>
            PNG, JPEG or WebP · up to 20 MB / 20 MP
          </FieldDescription>
        </Field>
      </FieldGroup>
      {!state.image && (
        <Empty className="border mb-6">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ScanText aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>No image selected</EmptyTitle>
            <EmptyDescription>
              Upload, drop, or paste an image to extract English text.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
      {state.image && (
        <ImageRegionPicker
          image={state.image}
          region={state.region}
          disabled={state.busy}
          onChange={state.changeRegion}
        />
      )}
      <div className="actions">
        <Button
          variant="default"
          disabled={!state.image || state.busy}
          onClick={() => void state.recognize()}
        >
          Extract text
        </Button>
        {state.busy && (
          <Button variant="outline" onClick={state.cancel}>
            Cancel
          </Button>
        )}
        <Button
          variant="outline"
          disabled={!state.image && !state.output}
          onClick={state.clearImage}
        >
          Clear
        </Button>
      </div>
      {state.busy && (
        <Progress
          className="mt-4"
          value={state.progress * 100}
          aria-label="OCR progress"
        />
      )}
      <output className="feedback">{state.message}</output>
      <Output value={state.output} label="Extracted text" />
    </section>
  );
}
