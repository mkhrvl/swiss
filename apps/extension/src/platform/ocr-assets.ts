import { OCR_ASSETS, verifyEnglishModel } from '@swiss/core/ocr';
import { browser } from 'wxt/browser';

const directory = new URL(
  `${OCR_ASSETS.directory}/`,
  browser.runtime.getURL('/'),
).href;
export const engineAssets = {
  processingWorkerUrl: browser.runtime.getURL('/ocr-worker.js'),
  workerUrl: `${directory}worker.min.js`,
  coreUrl: directory,
};
export async function loadOcrModel(
  signal: AbortSignal,
  progress: (value: string) => void,
): Promise<ArrayBuffer> {
  signal.throwIfAborted();
  progress('Loading OCR…');
  const response = await fetch(`${directory}${OCR_ASSETS.modelFile}`, {
    signal,
  });
  if (!response.ok) throw new Error('English model unavailable');
  const model = await response.arrayBuffer();
  if (!(await verifyEnglishModel(model)))
    throw new Error('Model integrity check failed');
  signal.throwIfAborted();
  return model;
}
