import { createRequire } from 'node:module';
import { dirname, resolve, join } from 'node:path';
import { mkdir, copyFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const require = createRequire(resolve('packages/core/package.json'));
const bcryptLicense = resolve(
  dirname(require.resolve('bcryptjs')),
  '..',
  'LICENSE',
);
const jsonLicense = join(
  dirname(require.resolve('jsonc-parser/package.json')),
  'LICENSE.md',
);
const tesseract = dirname(require.resolve('tesseract.js/package.json'));
const core = dirname(
  createRequire(join(tesseract, 'package.json')).resolve(
    'tesseract.js-core/package.json',
  ),
);
const modelPackage = dirname(
  createRequire(import.meta.url).resolve('@tesseract.js-data/eng/package.json'),
);
const model = join(modelPackage, '4.0.0_best_int/eng.traineddata.gz');
const checksum = createHash('sha256')
  .update(await readFile(model))
  .digest('hex');
if (
  checksum !==
  '45b4cb346724ac1774f1c36f42f182b887bcdb28ebe63e6fff90ac41f3fcff91'
)
  throw new Error('English model checksum changed');
for (const host of ['pwa', 'extension']) {
  const licenses = resolve(`apps/${host}/public/licenses`);
  await mkdir(licenses, { recursive: true });
  await copyFile(bcryptLicense, join(licenses, 'bcryptjs.txt'));
  await copyFile(jsonLicense, join(licenses, 'jsonc-parser.txt'));
  const destination = resolve(
    `apps/${host}/public/ocr/tesseract-7.0.0-eng-1.0.0`,
  );
  await mkdir(destination, { recursive: true });
  await copyFile(
    join(tesseract, 'dist/worker.min.js'),
    join(destination, 'worker.min.js'),
  );
  for (const file of [
    'tesseract-core-lstm.wasm.js',
    'tesseract-core-simd-lstm.wasm.js',
    'tesseract-core-relaxedsimd-lstm.wasm.js',
  ])
    await copyFile(join(core, file), join(destination, file));
  await copyFile(
    join(tesseract, 'LICENSE.md'),
    join(destination, 'TESSERACT-LICENSE.txt'),
  );
  await copyFile(join(core, 'LICENSE'), join(destination, 'CORE-LICENSE.txt'));
  await copyFile(model, join(destination, 'eng.traineddata.gz'));
}
console.log(
  'Prepared bundled OCR assets, English data and dependency license notices in both hosts.',
);
