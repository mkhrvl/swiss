import type { BcryptRequest, BcryptResponse } from './contracts';
import { processBcryptRequest } from './processing';

export function startBcryptWorker() {
  const scope = globalThis as unknown as {
    onmessage: ((event: MessageEvent<BcryptRequest>) => void) | null;
    postMessage(message: BcryptResponse): void;
  };
  scope.onmessage = ({ data }) => {
    try {
      scope.postMessage({ kind: 'result', result: processBcryptRequest(data) });
    } catch {
      scope.postMessage({ kind: 'failure' });
    }
  };
}
