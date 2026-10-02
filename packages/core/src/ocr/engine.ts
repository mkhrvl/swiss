import {
  validateImage,
  type OcrAssets,
  type OcrProgress,
  type OcrRequest,
  type OcrResult,
  type WorkerResponse,
} from './contracts';

/** One job per workspace; abort/dispose terminates the worker and its OCR child. */
export function createOcrEngine(assets: OcrAssets) {
  let worker: Worker | undefined;
  let cancelJob: (() => void) | undefined;
  return {
    async recognize(
      request: OcrRequest,
      options: {
        signal?: AbortSignal;
        onProgress?: (progress: OcrProgress) => void;
      } = {},
    ): Promise<OcrResult> {
      const invalid = validateImage(request.image);
      if (invalid) return { ok: false, error: invalid };
      if (options.signal?.aborted)
        return { ok: false, error: { code: 'cancelled' } };
      if (cancelJob) return { ok: false, error: { code: 'busy' } };
      worker ??= assets.processingWorkerUrl
        ? new Worker(assets.processingWorkerUrl)
        : new Worker(new URL('./worker-entry.ts', import.meta.url), {
            type: 'module',
          });
      const current = worker;
      return new Promise((resolve, reject) => {
        const finish = (
          result?: OcrResult,
          error?: Error,
          terminate = false,
        ) => {
          options.signal?.removeEventListener('abort', abort);
          current.onmessage = null;
          current.onerror = null;
          cancelJob = undefined;
          if (terminate) {
            current.terminate();
            worker = undefined;
          }
          if (error) reject(error);
          else resolve(result!);
        };
        const abort = () =>
          finish({ ok: false, error: { code: 'cancelled' } }, undefined, true);
        cancelJob = abort;
        options.signal?.addEventListener('abort', abort, { once: true });
        current.onerror = () =>
          finish(undefined, new Error('OCR worker failed'), true);
        current.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
          if (data.kind === 'progress') options.onProgress?.(data.value);
          else if (data.kind === 'result') finish(data.value);
          else finish(undefined, new Error('OCR engine failed'), true);
        };
        // Clone model data; ownership remains with the host for later jobs.
        try {
          current.postMessage({ ...request, assets });
        } catch {
          finish(undefined, new Error('OCR request could not be sent'), true);
        }
      });
    },
    dispose() {
      cancelJob?.();
      worker?.terminate();
      worker = undefined;
    },
  };
}
