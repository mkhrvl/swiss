/** Executable assets are bundled by both hosts. The English model is data only. */
export const OCR_ASSETS = {
  version: 'tesseract-7.0.0-eng-1.0.0',
  directory: 'ocr/tesseract-7.0.0-eng-1.0.0',
  engineFiles: [
    'worker.min.js',
    'tesseract-core-lstm.wasm.js',
    'tesseract-core-simd-lstm.wasm.js',
    'tesseract-core-relaxedsimd-lstm.wasm.js',
  ],
  modelFile: 'eng.traineddata.gz',
  modelBytes: 2_952_873,
  modelSha256:
    '45b4cb346724ac1774f1c36f42f182b887bcdb28ebe63e6fff90ac41f3fcff91',
  decodedModelBytes: 5_199_098,
  decodedModelSha256:
    '5dc5d8d640a212c9d6184921ba103b186f50e0fed9ee716c53e6b312b400d747',
} as const;

export async function verifyEnglishModel(model: ArrayBuffer): Promise<boolean> {
  // HTTP servers may label .gz files with Content-Encoding: gzip. Fetch then
  // returns decoded bytes; both representations must match this exact model.
  let expected: string | undefined;
  if (model.byteLength === OCR_ASSETS.modelBytes)
    expected = OCR_ASSETS.modelSha256;
  else if (model.byteLength === OCR_ASSETS.decodedModelBytes)
    expected = OCR_ASSETS.decodedModelSha256;
  if (!expected) return false;
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', model));
  return (
    Array.from(hash, (byte) => byte.toString(16).padStart(2, '0')).join('') ===
    expected
  );
}
