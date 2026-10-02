import {
  createWorker,
  OEM,
  type Worker as TesseractWorker,
} from 'tesseract.js';
import { verifyEnglishModel } from './assets';
import { decodeImage } from './image';
import {
  validateRegion,
  type WorkerRequest,
  type WorkerResponse,
} from './contracts';

/** Registers processing in a worker created by the host's bundler. */
export function startOcrWorker() {
  // Avoid DOM-only declarations in core's public interface.
  const scope = globalThis as unknown as {
    onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
    postMessage(message: WorkerResponse): void;
  };
  let engine: TesseractWorker | undefined;
  const send = (message: WorkerResponse) => scope.postMessage(message);

  scope.onmessage = async ({ data }) => {
    let bitmap: ImageBitmap | undefined;
    try {
      const decoded = await decodeImage(data.image);
      if (!decoded.ok) {
        send({ kind: 'result', value: decoded });
        return;
      }
      bitmap = decoded.value;
      const region = data.region ?? {
        x: 0,
        y: 0,
        width: bitmap.width,
        height: bitmap.height,
      };
      if (!validateRegion(region, bitmap.width, bitmap.height)) {
        send({
          kind: 'result',
          value: { ok: false, error: { code: 'invalid-region' } },
        });
        return;
      }
      if (!(await verifyEnglishModel(data.englishModel))) {
        send({
          kind: 'result',
          value: { ok: false, error: { code: 'invalid-model' } },
        });
        return;
      }
      const canvas = new OffscreenCanvas(region.width, region.height);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Image canvas unavailable');
      context.fillStyle = 'white';
      context.fillRect(0, 0, region.width, region.height);
      context.drawImage(
        bitmap,
        region.x,
        region.y,
        region.width,
        region.height,
        0,
        0,
        region.width,
        region.height,
      );
      bitmap.close();
      bitmap = undefined;
      const image = await canvas.convertToBlob({ type: 'image/png' });
      engine ??= await createWorker(
        [{ code: 'eng', data: new Uint8Array(data.englishModel) }],
        OEM.LSTM_ONLY,
        {
          workerPath: data.assets.workerUrl,
          corePath: data.assets.coreUrl,
          cacheMethod: 'none',
          workerBlobURL: false,
          logger: (progress) =>
            send({
              kind: 'progress',
              value: { stage: progress.status, fraction: progress.progress },
            }),
          errorHandler: () => send({ kind: 'failure' }),
        },
      );
      const result = await engine.recognize(image, {}, { text: true });
      send({ kind: 'result', value: { ok: true, value: result.data.text } });
    } catch {
      send({ kind: 'failure' });
    } finally {
      bitmap?.close();
    }
  };
}
