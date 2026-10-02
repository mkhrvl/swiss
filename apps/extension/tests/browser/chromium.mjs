import { secretGenerationUiChecks } from '../../../../scripts/secret-generation-browser-checks.mjs';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { identityUiChecks } from '../../../../scripts/identity-browser-checks.mjs';
const fixtures = JSON.parse(
  await readFile('packages/core/tests/browser/identity-fixtures.json', 'utf8'),
);
import {
  launch,
  base64Checks,
  navigateTool,
  sidebarChecks,
  ocrChecks,
  assert,
} from '../../../../scripts/browser-test-support.mjs';
const browser = await launch('apps/extension/.output/chrome-mv3');
const errors = [];
let testPage;
try {
  const worker =
    browser.context
      .serviceWorkers()
      .find((worker) => worker.url().endsWith('/background.js')) ??
    (await browser.context.waitForEvent('serviceworker', {
      predicate: (worker) => worker.url().endsWith('/background.js'),
    }));
  const workerUrl = new URL(worker.url());
  const origin = `${workerUrl.protocol}//${workerUrl.host}`;
  const page = await browser.context.newPage();
  testPage = page;
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${origin}/sidepanel.html`);
  await mkdir('artifacts/web-browser', { recursive: true });
  await sidebarChecks(page, 'Base64', 'English OCR', 320, 'extension');
  await base64Checks(page, 'Base64', 'English OCR');
  await page.getByLabel('Encoded input').fill('SGVsbG8=');
  const opened = browser.context.waitForEvent('page');
  await page.getByRole('button', { name: 'Open in tab', exact: true }).click();
  const tab = await opened;
  await tab.waitForLoadState();
  await tab.waitForFunction(
    () => document.querySelector('#base64-input')?.value === 'SGVsbG8=',
  );
  await page.getByLabel('Encoded input').fill('Zg==');
  assert.equal(await tab.getByLabel('Encoded input').inputValue(), 'SGVsbG8=');
  await page.bringToFront();
  await browser.context.setOffline(true);
  await navigateTool(page, 'English OCR');
  await ocrChecks(page, 'English OCR');
  await page.setViewportSize({ width: 320, height: 800 });
  await mkdir('artifacts/web-browser', { recursive: true });
  await page.screenshot({
    path: 'artifacts/web-browser/extension-sidebar.png',
    fullPage: true,
  });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await browser.context.setOffline(true);
  const identity = await page.evaluate(identityUiChecks, {
    fixtures,
  });
  const generators = await page.evaluate(secretGenerationUiChecks);
  await navigateTool(page, 'Generate JWT signing key');
  await page.screenshot({
    path: 'artifacts/web-browser/extension-jwt-generator.png',
    fullPage: true,
  });
  console.log('Chromium extension Identity checks passed.');
  await navigateTool(page, 'Hash password');
  await page
    .getByLabel('Password', { exact: true })
    .fill('synthetic transfer input');
  const [identityTab] = await Promise.all([
    browser.context.waitForEvent('page'),
    page.getByRole('button', { name: 'Open in tab', exact: true }).click(),
  ]);
  await identityTab.waitForFunction(
    () =>
      document.querySelector('#identity-password')?.value ===
      'synthetic transfer input',
  );
  assert.equal(
    await identityTab
      .getByLabel('Password', { exact: true })
      .getAttribute('type'),
    'password',
  );
  assert(!identityTab.url().includes('synthetic'));
  await page.getByLabel('Password', { exact: true }).fill('independent edit');
  assert.equal(
    await identityTab.getByLabel('Password', { exact: true }).inputValue(),
    'synthetic transfer input',
  );
  await identityTab.close();
  await navigateTool(page, 'Generate API key');
  await page.getByLabel('Random bytes').fill('64');
  await page
    .getByRole('button', { name: 'Generate API key', exact: true })
    .last()
    .click();
  await page.waitForFunction(
    () => document.querySelector('#generated-secret-1')?.value.length === 128,
  );
  const [generatorTab] = await Promise.all([
    browser.context.waitForEvent('page'),
    page.getByRole('button', { name: 'Open in tab', exact: true }).click(),
  ]);
  await generatorTab
    .getByRole('heading', { name: 'Generate API key', exact: true })
    .waitFor();
  assert.equal(
    await generatorTab.getByLabel('Random bytes').inputValue(),
    '64',
  );
  await generatorTab.waitForFunction(() => {
    const fields = [
      ...document.querySelectorAll('input[id^="generated-secret-"]'),
    ];
    return (
      fields.length === 5 &&
      fields.every((field) => /^[a-f0-9]{128}$/.test(field.value))
    );
  });
  const sourceValues = await page
    .locator('input[id^="generated-secret-"]')
    .evaluateAll((fields) => fields.map((field) => field.value));
  const tabValues = await generatorTab
    .locator('input[id^="generated-secret-"]')
    .evaluateAll((fields) => fields.map((field) => field.value));
  assert(tabValues.every((value) => !sourceValues.includes(value)));
  await page.getByLabel('Random bytes').fill('32');
  assert.equal(
    await generatorTab.getByLabel('Random bytes').inputValue(),
    '64',
  );
  await generatorTab.close();
  await writeFile(
    'artifacts/web-browser/identity-chromium-extension.json',
    JSON.stringify(identity),
  );
  await page.reload();
  await navigateTool(page, 'English OCR');
  await ocrChecks(page, 'English OCR');
  await page.evaluate(identityUiChecks, { fixtures, verifyFirst: true });
  await page.evaluate(secretGenerationUiChecks);
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify(
      {
        host: 'extension',
        browser: browser.context.browser().version(),
        passed: true,
        checks: [
          'Sidebar collapse, mobile drawer, keyboard dismissal/focus and in-memory state',
          'Base64 and native CSP OCR',
          'One-time tab transfer and independent workspaces',
          'Generator tab transfer copies options without generated secrets',
          'Crop, cancel and restart, invalid region',
          '320px layout',
          'Offline reload and recognition from bundled English data',
          ...generators.checks,
          ...identity.checks,
          'Identity hashing and verification after a fresh extension reload',
        ],
      },
      null,
      2,
    ),
  );
} catch (error) {
  if (testPage) console.error(await testPage.locator('body').innerText());
  throw error;
} finally {
  await browser.close();
}
