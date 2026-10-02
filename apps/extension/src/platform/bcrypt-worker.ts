import { browser } from 'wxt/browser';

export function createBcryptWorker() {
  return new Worker(browser.runtime.getURL('/bcrypt-worker.js'), {
    type: 'module',
  });
}
