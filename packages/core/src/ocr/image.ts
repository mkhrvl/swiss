import type { Result } from '../result';
import { MAX_IMAGE_PIXELS, validateImage, type OcrError } from './contracts';

/** The caller owns and must close the returned bitmap. */
export async function decodeImage(
  image: Blob,
): Promise<Result<ImageBitmap, OcrError>> {
  const invalid = validateImage(image);
  if (invalid) return { ok: false, error: invalid };
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(image);
  } catch {
    return { ok: false, error: { code: 'invalid-image' } };
  }
  if (bitmap.width * bitmap.height > MAX_IMAGE_PIXELS) {
    bitmap.close();
    return { ok: false, error: { code: 'image-too-large' } };
  }
  return { ok: true, value: bitmap };
}

/** Gives hosts preview dimensions while keeping all image rules in core. */
export async function inspectOcrImage(
  image: Blob,
): Promise<Result<{ width: number; height: number }, OcrError>> {
  const result = await decodeImage(image);
  if (!result.ok) return result;
  const { width, height } = result.value;
  result.value.close();
  return { ok: true, value: { width, height } };
}
