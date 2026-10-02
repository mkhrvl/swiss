import { describe, it, expect } from 'vitest';
import { createOcrEngine, MAX_IMAGE_BYTES, verifyEnglishModel } from './index';
import { validateRegion } from './contracts';

describe('OCR boundaries', () => {
  const engine = createOcrEngine({ workerUrl: 'unused', coreUrl: 'unused' });
  const request = (image: Blob) => ({
    image,
    englishModel: new ArrayBuffer(0),
  });
  it('rejects oversized input before starting a worker', async () => {
    expect(
      await engine.recognize(
        request(
          new Blob([new Uint8Array(MAX_IMAGE_BYTES + 1)], {
            type: 'image/png',
          }),
        ),
      ),
    ).toEqual({ ok: false, error: { code: 'image-too-large' } });
  });
  it('rejects formats outside PNG, JPEG and WebP', async () => {
    expect(
      await engine.recognize(
        request(new Blob(['svg'], { type: 'image/svg+xml' })),
      ),
    ).toEqual({ ok: false, error: { code: 'unsupported-image' } });
  });
  it('does not start an already cancelled job', async () => {
    expect(
      await engine.recognize(
        request(new Blob(['png'], { type: 'image/png' })),
        { signal: AbortSignal.abort() },
      ),
    ).toEqual({ ok: false, error: { code: 'cancelled' } });
  });
  it('rejects an incorrect model', async () => {
    expect(await verifyEnglishModel(new ArrayBuffer(4))).toBe(false);
  });
  it.each([
    [{ x: 0, y: 0, width: 100, height: 50 }, true],
    [{ x: 99, y: 49, width: 1, height: 1 }, true],
    [{ x: -1, y: 0, width: 1, height: 1 }, false],
    [{ x: 0, y: 0, width: 0, height: 1 }, false],
    [{ x: 99, y: 0, width: 2, height: 1 }, false],
    [{ x: 0.5, y: 0, width: 1, height: 1 }, false],
    [{ x: NaN, y: 0, width: 1, height: 1 }, false],
  ])('validates source-pixel region %j', (region, valid) => {
    expect(validateRegion(region, 100, 50)).toBe(valid);
  });
});
