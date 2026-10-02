import type { Result } from '../result';
import type {
  IdentityError,
  IdentityRequest,
  IdentityResponse,
  VerificationOutcome,
} from './contracts';

/** A workspace's lazy .NET runtime; cancellation terminates synchronous work. */
export function createIdentityEngine(workerUrl: string) {
  let worker: Worker | undefined;
  let ready = false;
  let cancelJob: (() => void) | undefined;

  function reset() {
    worker?.terminate();
    worker = undefined;
    ready = false;
  }
  async function run(
    request: IdentityRequest,
    options: { signal?: AbortSignal } = {},
  ): Promise<Result<string, IdentityError>> {
    if (options.signal?.aborted)
      return { ok: false, error: { code: 'cancelled' } };
    if (cancelJob) return { ok: false, error: { code: 'busy' } };
    worker ??= new Worker(workerUrl, { type: 'module' });
    const current = worker;
    return new Promise((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const finish = (
        result?: Result<string, IdentityError>,
        error?: Error,
        terminate = false,
      ) => {
        clearTimeout(timer);
        options.signal?.removeEventListener('abort', abort);
        current.onmessage = null;
        current.onerror = null;
        current.onmessageerror = null;
        cancelJob = undefined;
        if (terminate) reset();
        if (error) reject(error);
        else resolve(result!);
      };
      const fail = () =>
        finish(undefined, new Error('Identity runtime failed'), true);
      const abort = () =>
        finish({ ok: false, error: { code: 'cancelled' } }, undefined, true);
      const send = () => {
        clearTimeout(timer);
        try {
          current.postMessage(request);
        } catch {
          fail();
        }
      };
      cancelJob = abort;
      options.signal?.addEventListener('abort', abort, { once: true });
      current.onerror = fail;
      current.onmessageerror = fail;
      current.onmessage = ({ data }: MessageEvent<IdentityResponse>) => {
        if (data.kind === 'ready' && !ready) {
          ready = true;
          send();
        } else if (data.kind === 'result' && typeof data.value === 'string') {
          finish({ ok: true, value: data.value });
        } else fail();
      };
      if (ready) send();
      else timer = setTimeout(fail, 60_000);
    });
  }
  return {
    hash(password: string, options?: { signal?: AbortSignal }) {
      return run({ operation: 'hash', password }, options);
    },
    async verify(
      hash: string,
      password: string,
      options?: { signal?: AbortSignal },
    ): Promise<Result<VerificationOutcome, IdentityError>> {
      const result = await run(
        { operation: 'verify', hash, password },
        options,
      );
      if (!result.ok) return result;
      switch (result.value) {
        case 'Success':
          return { ok: true, value: 'match' };
        case 'SuccessRehashNeeded':
          return { ok: true, value: 'match-rehash-needed' };
        case 'Failed':
          return { ok: true, value: 'mismatch' };
        case 'InvalidHash':
          return { ok: false, error: { code: 'invalid-hash' } };
        case 'UnsupportedHash':
          return { ok: false, error: { code: 'unsupported-hash' } };
        default:
          reset();
          throw new Error('Unexpected Identity result');
      }
    },
    dispose() {
      cancelJob?.();
      reset();
    },
  };
}
