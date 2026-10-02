import { createServer } from 'vite';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { identityUiChecks } from '../../../../scripts/identity-browser-checks.mjs';
const fixtures = JSON.parse(
  await readFile('packages/core/tests/browser/identity-fixtures.json', 'utf8'),
);
import {
  launch,
  navigateTool,
  ocrChecks,
  assert,
} from '../../../../scripts/browser-test-support.mjs';

const server = await createServer({
  root: resolve('apps/pwa'),
  optimizeDeps: { force: true },
  server: { host: '127.0.0.1', port: 0 },
});
await server.listen();
let browser;
let testPage;
try {
  browser = await launch();
  const errors = [];
  const page = await browser.context.newPage();
  testPage = page;
  page.on('pageerror', (error) => {
    errors.push(error.message);
    console.error(error.message);
  });
  await page.goto(server.resolvedUrls.local[0]);
  await navigateTool(page, 'Extract text');
  await ocrChecks(page, 'Extract text');
  await page.evaluate(identityUiChecks, { fixtures });
  assert.deepEqual(errors, []);
  console.log(
    'PWA development OCR and Identity: lazy initialization, processing, cancellation and restart passed.',
  );
} catch (error) {
  if (testPage) console.error(await testPage.locator('body').innerText());
  throw error;
} finally {
  await browser?.close();
  await server.close();
}
