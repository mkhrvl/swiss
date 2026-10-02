import type { Result } from '../result';

export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 20_000_000;
export type ImageRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
};
export type OcrError = {
  code:
    | 'image-too-large'
    | 'unsupported-image'
    | 'invalid-image'
    | 'invalid-region'
    | 'invalid-model'
    | 'cancelled'
    | 'busy';
};
export type OcrProgress = { stage: string; fraction: number };
export type OcrRequest = {
  image: Blob;
  region?: ImageRegion;
  englishModel: ArrayBuffer;
};
export type OcrAssets = {
  workerUrl: string;
  coreUrl: string;
  processingWorkerUrl?: string;
};
export type OcrResult = Result<string, OcrError>;
export type WorkerRequest = OcrRequest & { assets: OcrAssets };
export type WorkerResponse =
  | { kind: 'progress'; value: OcrProgress }
  | { kind: 'result'; value: OcrResult }
  | { kind: 'failure' };

export function validateImage(image: Blob): OcrError | undefined {
  if (image.size > MAX_IMAGE_BYTES) return { code: 'image-too-large' };
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(image.type))
    return { code: 'unsupported-image' };
  if (!image.size) return { code: 'invalid-image' };
}
export function validateRegion(
  region: ImageRegion,
  width: number,
  height: number,
): boolean {
  return (
    Object.values(region).every(Number.isInteger) &&
    region.x >= 0 &&
    region.y >= 0 &&
    region.width > 0 &&
    region.height > 0 &&
    region.x + region.width <= width &&
    region.y + region.height <= height
  );
}
