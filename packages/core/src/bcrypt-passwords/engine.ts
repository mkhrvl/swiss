import type { Result } from '../result';
import {
  validateBcryptRequest,
  type BcryptError,
  type BcryptRequest,
  type BcryptResponse,
} from './contracts';

/** One lazy worker per workspace; termination cancels even the highest cost. */
export function createBcryptEngine(createWorker: () => Worker) {
  let worker: Worker | undefined;
  let cancelJob: (() => void) | undefined;
  function reset() {
    worker?.terminate();
    worker = undefined;
  }
  async function run(
    request: BcryptRequest,
    signal?: AbortSignal,
  ): Promise<Result<string | boolean, BcryptError>> {
    if (signal?.aborted) return { ok: false, error: { code: 'cancelled' } };
    const error = validateBcryptRequest(request);
    if (error) return { ok: false, error };
    if (cancelJob) return { ok: false, error: { code: 'busy' } };
    worker ??= createWorker();
    const current = worker;
    return new Promise((resolve, reject) => {
      const finish = (
        result?: Result<string | boolean, BcryptError>,
        failure?: Error,
        terminate = false,
      ) => {
        signal?.removeEventListener('abort', abort);
        current.onmessage = null;
        current.onerror = null;
        current.onmessageerror = null;
        cancelJob = undefined;
        if (terminate) reset();
        if (failure) reject(failure);
        else resolve(result!);
      };
      const fail = () =>
        finish(undefined, new Error('Bcrypt worker failed'), true);
      const abort = () =>
        finish({ ok: false, error: { code: 'cancelled' } }, undefined, true);
      cancelJob = abort;
      signal?.addEventListener('abort', abort, { once: true });
      current.onerror = fail;
      current.onmessageerror = fail;
      current.onmessage = ({ data }: MessageEvent<BcryptResponse>) => {
        if (data.kind === 'result') finish(data.result);
        else fail();
      };
      try {
        current.postMessage(request);
      } catch {
        fail();
      }
    });
  }
  return {
    async hash(
      password: string,
      cost: number,
      options: { signal?: AbortSignal } = {},
    ): Promise<Result<string, BcryptError>> {
      const result = await run(
        { operation: 'hash', password, cost },
        options.signal,
      );
      if (!result.ok) return result;
      if (typeof result.value !== 'string')
        throw new Error('Unexpected bcrypt hash result');
      return { ok: true, value: result.value };
    },
    async verify(
      hash: string,
      password: string,
      options: { signal?: AbortSignal } = {},
    ): Promise<Result<boolean, BcryptError>> {
      const result = await run(
        { operation: 'verify', hash, password },
        options.signal,
      );
      if (!result.ok) return result;
      if (typeof result.value !== 'boolean')
        throw new Error('Unexpected bcrypt verification result');
      return { ok: true, value: result.value };
    },
    dispose() {
      cancelJob?.();
      reset();
    },
  };
}
