import { jsonUiChecks } from '../../../../scripts/json-browser-checks.mjs';
import { bcryptUiChecks } from '../../../../scripts/bcrypt-browser-checks.mjs';
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
  const bcrypt = await page.evaluate(bcryptUiChecks);
  const generators = await page.evaluate(secretGenerationUiChecks);
  const json = await page.evaluate(jsonUiChecks);
  await page.screenshot({
    path: 'artifacts/web-browser/extension-json.png',
    fullPage: true,
  });
  await navigateTool(page, 'Generate JWT signing key');
  await page.screenshot({
    path: 'artifacts/web-browser/extension-jwt-generator.png',
    fullPage: true,
  });
  console.log('Chromium extension Identity checks passed.');
  await navigateTool(page, 'JSON');
  const jsonSource = '{"id":9007199254740993}';
  await page.getByLabel('JSON input', { exact: true }).fill(jsonSource);
  await page.getByText('Format', { exact: true }).click();
  await page.getByText('4 spaces', { exact: true }).click();
  await page.waitForFunction(() =>
    document.querySelector('#json-output')?.value.includes('\n    "id":'),
  );
  const [jsonTab] = await Promise.all([
    browser.context.waitForEvent('page'),
    page.getByRole('button', { name: 'Open in tab', exact: true }).click(),
  ]);
  await jsonTab.waitForFunction(
    () =>
      document.querySelector('#json-input')?.value ===
      '{"id":9007199254740993}',
  );
  assert.equal(
    await jsonTab.getByLabel('JSON output', { exact: true }).inputValue(),
    '{\n    "id": 9007199254740993\n}',
  );
  assert(!jsonTab.url().includes('9007199254740993'));
  await page.getByLabel('JSON input', { exact: true }).fill('false');
  assert.equal(
    await jsonTab.getByLabel('JSON input', { exact: true }).inputValue(),
    jsonSource,
  );
  await jsonTab.close();
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
    'text',
  );
  assert(!identityTab.url().includes('synthetic'));
  await page.getByLabel('Password', { exact: true }).fill('independent edit');
  assert.equal(
    await identityTab.getByLabel('Password', { exact: true }).inputValue(),
    'synthetic transfer input',
  );
  await identityTab.close();
  await navigateTool(page, 'Generate bcrypt hash');
  await page
    .getByLabel('Password', { exact: true })
    .fill('synthetic bcrypt transfer');
  await page.getByRole('spinbutton', { name: 'Cost factor' }).fill('4');
  await page
    .getByRole('button', { name: 'Generate bcrypt hash', exact: true })
    .last()
    .click();
  await page.waitForFunction(() =>
    document.querySelector('#bcrypt-output')?.value.startsWith('$2b$04$'),
  );
  const [bcryptTab] = await Promise.all([
    browser.context.waitForEvent('page'),
    page.getByRole('button', { name: 'Open in tab', exact: true }).click(),
  ]);
  await bcryptTab.waitForFunction(
    () =>
      document.querySelector('#bcrypt-password')?.value ===
      'synthetic bcrypt transfer',
  );
  assert.equal(
    await bcryptTab
      .getByRole('spinbutton', { name: 'Cost factor' })
      .inputValue(),
    '4',
  );
  assert.equal(
    await bcryptTab.getByLabel('Bcrypt hash', { exact: true }).inputValue(),
    '',
  );
  assert.equal(
    await bcryptTab
      .getByLabel('Password', { exact: true })
      .getAttribute('type'),
    'text',
  );
  assert(!bcryptTab.url().includes('synthetic'));
  await page.getByRole('spinbutton', { name: 'Cost factor' }).fill('12');
  assert.equal(
    await bcryptTab
      .getByRole('spinbutton', { name: 'Cost factor' })
      .inputValue(),
    '4',
  );
  await bcryptTab.close();
  await navigateTool(page, 'Verify bcrypt hash');
  await page.getByLabel('Password', { exact: true }).fill('  café 🔐  ');
  const bcryptFixture =
    '$2b$04$abcdefghijklmnopqrstuuK3nEtR/OYkgNnPTl7gUVWmBqJNnKuJO';
  await page.getByLabel('Stored bcrypt hash').fill(bcryptFixture);
  const [bcryptVerifyTab] = await Promise.all([
    browser.context.waitForEvent('page'),
    page.getByRole('button', { name: 'Open in tab', exact: true }).click(),
  ]);
  await bcryptVerifyTab.waitForFunction(
    () => document.querySelector('#bcrypt-password')?.value === '  café 🔐  ',
  );
  assert.equal(
    await bcryptVerifyTab.getByLabel('Stored bcrypt hash').inputValue(),
    bcryptFixture,
  );
  assert.equal(
    await bcryptVerifyTab.locator('#bcrypt-feedback').textContent(),
    '',
  );
  await bcryptVerifyTab.close();
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
  await page.evaluate(bcryptUiChecks);
  await page.evaluate(secretGenerationUiChecks);
  await page.evaluate(jsonUiChecks);
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
          'JSON input/options transfer and independent output recomputation',
          'Generator tab transfer copies options without generated secrets',
          'Bcrypt tab transfer preserves inputs/cost, shows passwords, and excludes results',
          'Crop, cancel and restart, invalid region',
          '320px layout',
          'Offline reload and recognition from bundled English data',
          ...bcrypt.checks,
          ...generators.checks,
          ...json.checks,
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
