import { IDENTITY_ASSETS } from '@swiss/core/identity-passwords';

const cacheName = `swiss-${IDENTITY_ASSETS.version}`;
const directory = new URL(
  `${import.meta.env.BASE_URL}${IDENTITY_ASSETS.directory}/`,
  location.origin,
).href;
export const identityWorkerUrl = `${directory}worker.js`;
const manifestUrl = `${directory}assets.json`;
type Asset = { path: string; bytes: number; sha256: string };
type Manifest = { version: string; files: Asset[] };

function checkManifest(manifest: Manifest) {
  if (
    manifest.version !== IDENTITY_ASSETS.version ||
    !Array.isArray(manifest.files) ||
    !manifest.files.length ||
    !manifest.files.some((file) => file.path === 'worker.js') ||
    manifest.files.some(
      (file) =>
        !/^(worker\.js|_framework\/[\w.-]+)$/.test(file.path) ||
        !Number.isSafeInteger(file.bytes) ||
        file.bytes <= 0 ||
        !/^[a-f0-9]{64}$/.test(file.sha256),
    )
  )
    throw new Error('Invalid Identity asset manifest');
}
async function validAsset(response: Response, file: Asset) {
  const bytes = await response.clone().arrayBuffer();
  if (bytes.byteLength !== file.bytes) return false;
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return (
    Array.from(hash, (byte) => byte.toString(16).padStart(2, '0')).join('') ===
    file.sha256
  );
}
export async function initializeIdentityAssets(
  signal: AbortSignal,
  progress: (message: string) => void,
) {
  signal.throwIfAborted();
  const request = {
    signal,
    cache: 'reload' as const,
    headers: { 'X-Swiss-Prepare': 'identity' },
  };
  const cache = await caches.open(cacheName);
  let response = await cache.match(manifestUrl);
  let manifest: Manifest | undefined;
  if (response) {
    try {
      const cached: Manifest = await response.clone().json();
      checkManifest(cached);
      manifest = cached;
    } catch {
      response = undefined;
    }
  }
  if (!manifest) {
    progress('Loading Identity…');
    response = await fetch(manifestUrl, request);
    if (!response.ok) throw new Error('Identity manifest unavailable');
    const downloaded: Manifest = await response.clone().json();
    checkManifest(downloaded);
    manifest = downloaded;
  }
  for (const [index, file] of manifest.files.entries()) {
    signal.throwIfAborted();
    progress(`Loading Identity ${index + 1} of ${manifest.files.length}…`);
    const url = `${directory}${file.path}`;
    const cached = await cache.match(url);
    if (cached && (await validAsset(cached, file))) continue;
    const asset = await fetch(url, request);
    if (!asset.ok) throw new Error('Identity asset unavailable');
    if (!(await validAsset(asset, file)))
      throw new Error('Identity asset integrity check failed');
    signal.throwIfAborted();
    await cache.put(url, asset);
  }
  signal.throwIfAborted();
  if (!response) throw new Error('Identity manifest unavailable');
  await cache.put(manifestUrl, response);
}
