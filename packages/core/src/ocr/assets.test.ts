/// <reference types="node" />
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { verifyEnglishModel } from './index';

const require = createRequire(import.meta.url);
const modelPath = join(
  dirname(require.resolve('@tesseract.js-data/eng/package.json')),
  '4.0.0_best_int/eng.traineddata.gz',
);
const gzip = await readFile(modelPath);
const representations = [
  Uint8Array.from(gzip),
  Uint8Array.from(gunzipSync(gzip)),
];

describe('English model integrity across HTTP representations', () => {
  it.each(
    representations.map(
      (bytes, index) => [index ? 'HTTP-decoded' : 'gzip', bytes] as const,
    ),
  )('accepts the pinned %s model', async (_, bytes) => {
    expect(await verifyEnglishModel(bytes.buffer)).toBe(true);
  });
  it.each(
    representations.map(
      (bytes, index) => [index ? 'HTTP-decoded' : 'gzip', bytes] as const,
    ),
  )('rejects altered %s model data', async (_, bytes) => {
    const changed = new Uint8Array(bytes);
    changed[changed.length - 1] = changed[changed.length - 1]! ^ 1;
    expect(await verifyEnglishModel(changed.buffer)).toBe(false);
  });
});
