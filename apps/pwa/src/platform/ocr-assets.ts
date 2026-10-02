import { OCR_ASSETS, verifyEnglishModel } from '@swiss/core/ocr';

export const assetCacheName = `swiss-${OCR_ASSETS.version}`;
const directory = new URL(
  `${import.meta.env.BASE_URL}${OCR_ASSETS.directory}/`,
  location.origin,
).href;
export const engineAssets = {
  workerUrl: `${directory}worker.min.js`,
  coreUrl: directory,
};
const modelUrl = `${directory}${OCR_ASSETS.modelFile}`;
const required = [
  ...OCR_ASSETS.engineFiles.map((file) => `${directory}${file}`),
  modelUrl,
];

export async function loadOcrModel(
  signal: AbortSignal,
  progress: (value: string) => void,
): Promise<ArrayBuffer> {
  signal.throwIfAborted();
  const cache = await caches.open(assetCacheName);
  let model: ArrayBuffer | undefined;
  for (const [index, url] of required.entries()) {
    signal.throwIfAborted();
    progress(`Loading OCR ${index + 1} of ${required.length}…`);
    const cached = await cache.match(url);
    if (cached) {
      if (url !== modelUrl) continue;
      const bytes = await cached.arrayBuffer();
      if (await verifyEnglishModel(bytes)) {
        model = bytes;
        continue;
      }
    }
    const response = await fetch(url, {
      signal,
      cache: 'reload',
      headers: { 'X-Swiss-Prepare': 'ocr' },
    });
    if (!response.ok) throw new Error('OCR asset unavailable');
    if (url === modelUrl) {
      model = await response.clone().arrayBuffer();
      if (!(await verifyEnglishModel(model)))
        throw new Error('Model integrity check failed');
    }
    signal.throwIfAborted();
    await cache.put(url, response);
  }
  signal.throwIfAborted();
  if (!model) throw new Error('English model unavailable');
  return model;
}
