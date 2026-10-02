import { createHash } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { IDENTITY_ASSETS } from '@swiss/core/identity-passwords';

const directory = `https://swiss.test/${IDENTITY_ASSETS.directory}/`;
const manifestUrl = `${directory}assets.json`;
const files = new Map([
  ['worker.js', 'synthetic worker'],
  ['_framework/runtime.wasm', 'synthetic runtime'],
]);
const manifest = {
  version: IDENTITY_ASSETS.version,
  files: [...files].map(([path, text]) => ({
    path,
    bytes: Buffer.byteLength(text),
    sha256: createHash('sha256').update(text).digest('hex'),
  })),
};
let cache: Map<string, Response>;
let fetchAsset: ReturnType<typeof vi.fn<typeof fetch>>;
let initialize: typeof import('./identity-assets').initializeIdentityAssets;
const load = (signal = new AbortController().signal) =>
  initialize(signal, () => {});

beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal('location', { origin: 'https://swiss.test' });
  cache = new Map();
  vi.stubGlobal('caches', {
    open: async () => ({
      match: async (url: string) => cache.get(url)?.clone(),
      put: async (url: string, response: Response) => {
        cache.set(url, response.clone());
      },
    }),
  });
  fetchAsset = vi.fn<typeof fetch>(async (url, options) => {
    options?.signal?.throwIfAborted();
    if (url === manifestUrl) return Response.json(manifest);
    const text = files.get(String(url).slice(directory.length));
    return new Response(text, { status: text ? 200 : 404 });
  });
  vi.stubGlobal('fetch', fetchAsset);
  initialize = (await import('./identity-assets')).initializeIdentityAssets;
});
afterEach(() => vi.unstubAllGlobals());

it('loads and verifies assets on first use, then reuses the cache offline', async () => {
  await load();
  expect(await cache.get(`${directory}worker.js`)?.clone().text()).toBe(
    'synthetic worker',
  );
  expect(cache.has(manifestUrl)).toBe(true);
  fetchAsset.mockRejectedValue(new Error('Offline'));
  fetchAsset.mockClear();
  await load();
  expect(fetchAsset).not.toHaveBeenCalled();
});

it('repairs missing and corrupted files while reusing verified files', async () => {
  await load();
  cache.set(`${directory}worker.js`, new Response('damaged worker'));
  fetchAsset.mockClear();
  await load();
  expect(fetchAsset.mock.calls.map(([url]) => url)).toEqual([
    `${directory}worker.js`,
  ]);
  expect(fetchAsset.mock.calls[0]?.[1]?.headers).toEqual({
    'X-Swiss-Prepare': 'identity',
  });
  expect(await cache.get(`${directory}worker.js`)?.clone().text()).toBe(
    'synthetic worker',
  );
  cache.delete(`${directory}_framework/runtime.wasm`);
  fetchAsset.mockClear();
  await load();
  expect(fetchAsset.mock.calls.map(([url]) => url)).toEqual([
    `${directory}_framework/runtime.wasm`,
  ]);
});

it('rejects damaged downloads without committing readiness and allows retry', async () => {
  const goodFetch = fetchAsset.getMockImplementation()!;
  fetchAsset.mockImplementation(async (url, options) =>
    url === `${directory}worker.js`
      ? new Response('corrupt bytes')
      : goodFetch(url, options),
  );
  await expect(load()).rejects.toThrow('integrity');
  expect(cache.has(manifestUrl)).toBe(false);
  expect(cache.has(`${directory}worker.js`)).toBe(false);
  fetchAsset.mockImplementation(goodFetch);
  await load();
  expect(cache.has(manifestUrl)).toBe(true);
});

it('cancels first-use loading and recovers on the next operation', async () => {
  const controller = new AbortController();
  const goodFetch = fetchAsset.getMockImplementation()!;
  fetchAsset.mockImplementation(async (url, options) => {
    const response = await goodFetch(url, options);
    if (url === `${directory}worker.js`) controller.abort();
    return response;
  });
  await expect(load(controller.signal)).rejects.toMatchObject({
    name: 'AbortError',
  });
  expect(cache.has(manifestUrl)).toBe(false);
  fetchAsset.mockImplementation(goodFetch);
  await load();
  expect(cache.has(manifestUrl)).toBe(true);
});

it('replaces an invalid cached manifest before loading assets', async () => {
  cache.set(manifestUrl, new Response('broken manifest'));
  await load();
  expect(await cache.get(manifestUrl)?.clone().json()).toEqual(manifest);
});
