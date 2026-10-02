import { Button } from '@swiss/ui/components/button';
import { Input } from '@swiss/ui/components/input';
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from '@swiss/ui/components/field';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { ImageRegion } from '@swiss/core/ocr';
import type { WorkspaceImage } from '../state/workspace';

export function ImageRegionPicker({
  image,
  region,
  disabled,
  onChange,
}: {
  image: WorkspaceImage;
  region?: ImageRegion;
  disabled: boolean;
  onChange: (value: ImageRegion | undefined) => void;
}) {
  const [url, setUrl] = useState('');
  const [draft, setDraft] = useState<ImageRegion>();
  const start = useRef<{ x: number; y: number }>(undefined);
  useEffect(() => {
    const value = URL.createObjectURL(image.blob);
    setUrl(value);
    return () => URL.revokeObjectURL(value);
  }, [image.blob]);
  const selected = draft ?? region;
  function point(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(
        0,
        Math.min(
          image.width - 1,
          Math.floor(
            ((event.clientX - bounds.left) / bounds.width) * image.width,
          ),
        ),
      ),
      y: Math.max(
        0,
        Math.min(
          image.height - 1,
          Math.floor(
            ((event.clientY - bounds.top) / bounds.height) * image.height,
          ),
        ),
      ),
    };
  }
  function selectionAt(event: PointerEvent<HTMLDivElement>) {
    if (!start.current || disabled) return;
    const end = point(event);
    return {
      x: Math.min(start.current.x, end.x),
      y: Math.min(start.current.y, end.y),
      width: Math.abs(end.x - start.current.x) + 1,
      height: Math.abs(end.y - start.current.y) + 1,
    };
  }
  const fields = region ?? {
    x: 0,
    y: 0,
    width: image.width,
    height: image.height,
  };
  return (
    <div className="region-picker">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="image-name">
          {image.name} · {image.width} × {image.height}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || !region}
          onClick={() => onChange(undefined)}
        >
          Full image
        </Button>
      </div>
      <div
        className="image-preview"
        aria-label="Image preview; drag to select a region"
        onPointerDown={(event) => {
          if (!disabled && event.button === 0) {
            start.current = point(event);
            event.currentTarget.setPointerCapture(event.pointerId);
          }
        }}
        onPointerMove={(event) => {
          const value = selectionAt(event);
          if (value) setDraft(value);
        }}
        onPointerUp={(event) => {
          if (!start.current) return;
          const value = selectionAt(event);
          if (value) onChange(value);
          start.current = undefined;
          setDraft(undefined);
        }}
        onPointerCancel={() => {
          start.current = undefined;
          setDraft(undefined);
        }}
      >
        <img
          src={url || undefined}
          alt="Selected for text recognition"
          draggable={false}
        />
        {selected && (
          <div
            className="selection-region"
            style={{
              left: `${(selected.x / image.width) * 100}%`,
              top: `${(selected.y / image.height) * 100}%`,
              width: `${(selected.width / image.width) * 100}%`,
              height: `${(selected.height / image.height) * 100}%`,
            }}
          />
        )}
      </div>
      <FieldDescription>
        Drag a region or enter source-image pixels below.
      </FieldDescription>
      <FieldGroup className="region-fields">
        {(['x', 'y', 'width', 'height'] as const).map((field) => (
          <Field key={field} data-disabled={disabled}>
            <FieldLabel htmlFor={`region-${field}`}>{field}</FieldLabel>
            <Input
              id={`region-${field}`}
              aria-label={`Region ${field}`}
              type="number"
              min={field === 'x' || field === 'y' ? 0 : 1}
              step="1"
              disabled={disabled}
              value={fields[field]}
              onChange={(event) =>
                onChange({ ...fields, [field]: Number(event.target.value) })
              }
            />
          </Field>
        ))}
      </FieldGroup>
    </div>
  );
}
