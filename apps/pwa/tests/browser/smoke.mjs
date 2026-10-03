import { jsonUiChecks } from '../../../../scripts/json-browser-checks.mjs';
import { bcryptUiChecks } from '../../../../scripts/bcrypt-browser-checks.mjs';
import { secretGenerationUiChecks } from '../../../../scripts/secret-generation-browser-checks.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { identityUiChecks } from '../../../../scripts/identity-browser-checks.mjs';
const fixtures = JSON.parse(
  await readFile('packages/core/tests/browser/identity-fixtures.json', 'utf8'),
);
import {
  serve,
  launch,
  base64Checks,
  navigateTool,
  sidebarChecks,
  ocrChecks,
  assert,
} from '../../../../scripts/browser-test-support.mjs';
const server = await serve('apps/pwa/dist');
const browser = await launch();
const errors = [];
try {
  const page = await browser.context.newPage();
  page.on('pageerror', (error) => {
    errors.push(error.message);
    console.error(error.message);
  });
  page.on('console', (message) => {
    if (message.type() === 'error') console.error(message.text());
  });
  const assetRequests = [];
  page.on('request', (request) => {
    if (/\/(ocr|identity)\//.test(new URL(request.url()).pathname))
      assetRequests.push(request.url());
  });
  await page.goto(server.url);
  await mkdir('artifacts/web-browser', { recursive: true });
  await sidebarChecks(page, 'Decode Base64', 'Extract text', 360, 'pwa');
  await base64Checks(page, 'Decode Base64', 'Extract text');
  await navigateTool(page, 'Hash password');
  await navigateTool(page, 'Verify password');
  await navigateTool(page, 'Extract text');
  assert.deepEqual(assetRequests, [], 'Unused tools must not load assets');
  assert.equal(await page.getByRole('button', { name: /Prepare/ }).count(), 0);
  await ocrChecks(page, 'Extract text');
  await mkdir('artifacts/web-browser', { recursive: true });
  await page.screenshot({
    path: 'artifacts/web-browser/pwa-desktop.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.screenshot({
    path: 'artifacts/web-browser/pwa-mobile.png',
    fullPage: true,
  });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  const identity = await page.evaluate(identityUiChecks, {
    fixtures,
  });
  const bcrypt = await page.evaluate(bcryptUiChecks);
  const generators = await page.evaluate(secretGenerationUiChecks);
  const json = await page.evaluate(jsonUiChecks);
  await page.screenshot({
    path: 'artifacts/web-browser/pwa-json.png',
    fullPage: true,
  });
  await navigateTool(page, 'Generate JWT signing key');
  await page.screenshot({
    path: 'artifacts/web-browser/pwa-jwt-generator.png',
    fullPage: true,
  });
  console.log('Chromium PWA Identity checks passed.');
  await writeFile(
    'artifacts/web-browser/identity-chromium-pwa.json',
    JSON.stringify(identity),
  );
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  // First use after reload repairs damaged assets through the service worker.
  await page.evaluate(async () => {
    const names = await caches.keys();
    const ocrCache = await caches.open(
      names.find((name) => name.startsWith('swiss-tesseract-')),
    );
    const model = (await ocrCache.keys()).find((request) =>
      request.url.endsWith('/eng.traineddata.gz'),
    );
    await ocrCache.put(model, new Response('damaged model'));
    const name = names.find((name) => name.startsWith('swiss-identity-'));
    const cache = await caches.open(name);
    const requests = await cache.keys();
    const worker = requests.find((request) =>
      request.url.endsWith('/worker.js'),
    );
    await cache.put(
      worker,
      new Response('damaged worker', {
        headers: { 'Content-Type': 'text/javascript' },
      }),
    );
  });
  await page.reload();
  await navigateTool(page, 'Hash password');
  await page
    .getByLabel('Password', { exact: true })
    .fill('synthetic cache repair');
  await page
    .getByRole('button', { name: 'Hash password', exact: true })
    .last()
    .click();
  await page
    .getByText('Hash generated.', { exact: true })
    .waitFor({ timeout: 60_000 });
  assert(
    await page.evaluate(async () => {
      const name = (await caches.keys()).find((name) =>
        name.startsWith('swiss-identity-'),
      );
      const cache = await caches.open(name);
      const request = (await cache.keys()).find((request) =>
        request.url.endsWith('/worker.js'),
      );
      return (await (await cache.match(request)).text()).includes(
        'dotnet.create()',
      );
    }),
  );
  await ocrChecks(page, 'Extract text');
  const session = await browser.context.newCDPSession(page);
  await session.send('Network.enable');
  await session.send('Network.setCacheDisabled', { cacheDisabled: true });
  await server.close();
  await browser.context.setOffline(true);
  await page.reload();
  await navigateTool(page, 'Extract text');
  await ocrChecks(page, 'Extract text');
  await page.evaluate(identityUiChecks, { fixtures, verifyFirst: true });
  await page.evaluate(bcryptUiChecks);
  await page.evaluate(secretGenerationUiChecks);
  await page.evaluate(jsonUiChecks);
  const storage = await page.evaluate(async () => ({
    local: localStorage.length,
    session: sessionStorage.length,
    databases: await indexedDB.databases(),
    caches: await caches.keys(),
  }));
  assert.equal(storage.local, 0);
  assert.equal(storage.session, 0);
  assert(
    !storage.databases.some((database) => database.name?.includes('tesseract')),
  );
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify(
      {
        host: 'pwa',
        browser: browser.context.browser().version(),
        passed: true,
        checks: [
          'Sidebar collapse, mobile drawer, keyboard dismissal/focus and in-memory state',
          'Base64 exact text, binary, invalid input, navigation state',
          'Lazy initialization without preparation controls or downloads for unused tools',
          'Automatic repair of damaged Identity worker and OCR model caches',
          'English OCR crop, invalid region, cancellation and restart',
          '360px and desktop layouts',
          'Fresh offline reload and OCR with server stopped and HTTP cache disabled',
          'No workspace persistence',
          ...bcrypt.checks,
          ...generators.checks,
          ...json.checks,
          ...identity.checks,
          'Identity hashing and verification after a fresh offline reload',
        ],
        storage,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
  await server.close();
}
