import { IDENTITY_ASSETS } from '@swiss/core/identity-passwords';
import { browser } from 'wxt/browser';

export const identityWorkerUrl = new URL(
  `${IDENTITY_ASSETS.directory}/worker.js`,
  browser.runtime.getURL('/'),
).href;
// All Identity assets are bundled locally; the worker initializes on first use.
// Keep async so cancellation rejects the shared initializer contract's promise.
export async function initializeIdentityAssets(
  signal: AbortSignal,
  _progress: (message: string) => void,
) {
  signal.throwIfAborted();
}
