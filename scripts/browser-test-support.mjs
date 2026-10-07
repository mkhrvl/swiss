import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, stat, mkdtemp, rm } from 'node:fs/promises';
import { resolve, extname, join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';

export { assert };
export async function serve(directory, port = 0, basePath = '/') {
  const root = resolve(directory);
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(
        new URL(request.url, 'http://localhost').pathname,
      );
      if (!pathname.startsWith(basePath)) {
        response.writeHead(404).end();
        return;
      }
      const path = resolve(root, `./${pathname.slice(basePath.length)}`);
      if (path !== root && !path.startsWith(`${root}/`)) {
        response.writeHead(403).end();
        return;
      }
      const file = (await stat(path)).isDirectory()
        ? join(path, 'index.html')
        : path;
      const types = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
        '.webmanifest': 'application/manifest+json',
        '.wasm': 'application/wasm',
        '.json': 'application/json',
      };
      response.setHeader(
        'Content-Type',
        types[extname(file)] ?? 'application/octet-stream',
      );
      response.setHeader('Cache-Control', 'no-store');
      response.end(await readFile(file));
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}${basePath}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
export async function launch(extension) {
  const profile = await mkdtemp(join(tmpdir(), 'swiss-browser-'));
  const context = await chromium.launchPersistentContext(profile, {
    ...(process.env.SWISS_CHROMIUM
      ? { executablePath: process.env.SWISS_CHROMIUM }
      : {}),
    headless: true,
    viewport: { width: 1100, height: 850 },
    args: [
      '--no-sandbox',
      ...(extension
        ? [
            `--disable-extensions-except=${resolve(extension)}`,
            `--load-extension=${resolve(extension)}`,
          ]
        : []),
    ],
  });
  context.setDefaultTimeout(15_000);
  return {
    context,
    close: async () => {
      await context.close();
      await rm(profile, { recursive: true, force: true });
    },
  };
}
export async function fixture(page) {
  const data = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 300;
    const context = canvas.getContext('2d');
    context.fillStyle = 'white';
    context.fillRect(0, 0, 900, 300);
    context.fillStyle = 'black';
    context.font = '48px sans-serif';
    context.fillText('SWISS LOCAL OCR', 30, 95);
    context.fillText('SECOND LINE', 30, 245);
    return canvas.toDataURL().split(',')[1];
  });
  return {
    name: 'english-fixture.png',
    mimeType: 'image/png',
    buffer: Buffer.from(data, 'base64'),
  };
}
export async function navigateTool(page, label) {
  const navigation = page.getByRole('navigation', { name: 'Tools' });
  if (!(await navigation.isVisible())) {
    await page
      .getByRole('button', { name: 'Toggle Sidebar', exact: true })
      .click();
  }
  await navigation.getByRole('button', { name: label, exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Tools' })
    .waitFor({ state: 'hidden' });
}

export async function sidebarChecks(
  page,
  base64Tool,
  ocrTool,
  mobileWidth,
  screenshotPrefix,
) {
  const trigger = page.getByRole('button', {
    name: 'Toggle Sidebar',
    exact: true,
  });
  const navigation = page.getByRole('navigation', { name: 'Tools' });
  await navigateTool(page, base64Tool);
  const identityGroup = navigation.locator('[data-sidebar="group"]').filter({
    has: page.getByRole('heading', { name: 'Identity', exact: true }),
  });
  assert.deepEqual(
    await identityGroup
      .getByRole('button')
      .evaluateAll((buttons) =>
        buttons.map((button) => button.getAttribute('aria-label')),
      ),
    ['Hash password', 'Verify password'],
  );
  await page.getByLabel('Encoded input').fill('SGVsbG8=');
  await trigger.click();
  assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
  await page.waitForFunction(
    () => document.querySelector('nav')?.getBoundingClientRect().width <= 48,
  );
  assert.equal(
    await navigation
      .getByRole('button', { name: base64Tool, exact: true })
      .getAttribute('aria-current'),
    'page',
  );
  await navigateTool(page, ocrTool);
  await navigateTool(page, base64Tool);
  assert.equal(await page.getByLabel('Encoded input').inputValue(), 'SGVsbG8=');
  await page.screenshot({
    path: `artifacts/web-browser/${screenshotPrefix}-collapsed.png`,
    fullPage: true,
  });
  await trigger.click();
  assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
  await page.waitForFunction(
    () => document.querySelector('nav')?.getBoundingClientRect().width > 100,
  );
  await page.setViewportSize({ width: mobileWidth, height: 800 });
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-sidebar="trigger"]')
        ?.getAttribute('aria-expanded') === 'false',
  );
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Tools' });
  await dialog.waitFor();
  await dialog.evaluate(async (element) => {
    await Promise.all(
      element
        .getAnimations({ subtree: true })
        .map((animation) => animation.finished.catch(() => {})),
    );
  });
  assert(
    await dialog.evaluate((element) =>
      element.contains(document.activeElement),
    ),
    'Drawer receives keyboard focus',
  );
  await page.screenshot({
    path: `artifacts/web-browser/${screenshotPrefix}-drawer.png`,
    fullPage: true,
  });
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  await page.waitForFunction(
    () => document.activeElement?.getAttribute('data-sidebar') === 'trigger',
  );
  await navigateTool(page, ocrTool);
  await page.waitForFunction(
    () => document.activeElement?.getAttribute('data-sidebar') === 'trigger',
  );
  await navigateTool(page, base64Tool);
  assert.equal(await page.getByLabel('Encoded input').inputValue(), 'SGVsbG8=');
  await page.getByLabel('Encoded input').fill('YQ=='.repeat(1024));
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    'Long inputs fit narrow workspace',
  );
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await trigger.click();
  await page.getByRole('button', { name: 'Close tools', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  assert.equal(
    await page.evaluate(() => document.cookie),
    '',
    'Sidebar does not write cookies',
  );
  await page.setViewportSize({ width: 1100, height: 850 });
  await navigation.waitFor();
  await page.waitForFunction(
    () => document.querySelector('nav')?.getBoundingClientRect().width > 100,
  );
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: `artifacts/web-browser/${screenshotPrefix}-expanded.png`,
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await trigger.click();
  await navigation
    .getByRole('button', { name: base64Tool, exact: true })
    .hover();
  const tooltip = page.locator('[data-slot="tooltip-content"]').first();
  await tooltip.waitFor();
  assert.equal(
    await tooltip.evaluate(
      (element) => getComputedStyle(element).animationName,
    ),
    'none',
  );
  assert.equal(
    await page
      .locator('[data-slot="sidebar-container"]')
      .evaluate((element) => getComputedStyle(element).transitionDuration),
    '0s',
  );
  await trigger.click();
  await page.setViewportSize({ width: mobileWidth, height: 800 });
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-sidebar="trigger"]')
        ?.getAttribute('aria-expanded') === 'false',
  );
  await trigger.click();
  await dialog.waitFor();
  assert.equal(
    await dialog.evaluate((element) => getComputedStyle(element).animationName),
    'none',
  );
  assert.equal(
    await page
      .locator('[data-slot="sheet-overlay"]')
      .evaluate((element) => getComputedStyle(element).animationName),
    'none',
  );
  assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
  await page.screenshot({
    path: `artifacts/web-browser/${screenshotPrefix}-reduced-motion-drawer.png`,
  });
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  await page.waitForFunction(
    () => document.activeElement?.getAttribute('data-sidebar') === 'trigger',
  );
  await page.setViewportSize({ width: 1100, height: 850 });
  await navigation.waitFor();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  assert.notEqual(
    await page
      .locator('[data-slot="sidebar-container"]')
      .evaluate((element) => getComputedStyle(element).transitionDuration),
    '0s',
  );
}

export async function base64Checks(page, base64Tool, ocrTool) {
  await navigateTool(page, base64Tool);
  await page.getByLabel('Encoded input').fill('ICBjYWbDqSDwn5SQICA=');
  assert.equal(
    await page.getByLabel('Decoded text', { exact: true }).inputValue(),
    '  café 🔐  ',
  );
  await navigateTool(page, ocrTool);
  await navigateTool(page, base64Tool);
  assert.equal(
    await page.getByLabel('Encoded input').inputValue(),
    'ICBjYWbDqSDwn5SQICA=',
  );
  await page.getByLabel('Encoded input').fill('broken!');
  assert.equal(
    await page.getByLabel('Decoded text', { exact: true }).inputValue(),
    '',
  );
  await page.getByLabel('Encoded input').fill('-_8');
  assert.equal(
    await page.getByLabel('Decoded bytes (hex)').inputValue(),
    'fbff',
  );
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  assert.equal(await page.getByLabel('Encoded input').inputValue(), '');
}
export async function ocrChecks(page, tool) {
  await navigateTool(page, tool);
  await page
    .getByLabel('Choose image', { exact: true })
    .setInputFiles(await fixture(page));
  await page.getByLabel('Region height').waitFor();
  await page.waitForFunction(
    () => document.querySelector('.image-preview img')?.naturalWidth === 900,
  );
  const preview = await page.locator('.image-preview').boundingBox();
  assert(preview);
  await page.mouse.move(preview.x + 0.5, preview.y + 0.5);
  await page.mouse.down();
  await page.mouse.move(
    preview.x + preview.width / 2,
    preview.y + preview.height / 2,
    { steps: 4 },
  );
  await page.mouse.up();
  const selectedWidth = Number(
    await page.getByLabel('Region width').inputValue(),
  );
  assert(
    selectedWidth >= 449 && selectedWidth <= 452,
    'Drag should map a half-width selection to source-image pixels',
  );
  await page.getByRole('button', { name: 'Full image', exact: true }).click();
  await page.getByLabel('Region height').fill('145');
  await page
    .getByRole('button', { name: 'Extract text', exact: true })
    .last()
    .click();
  await page.waitForFunction(
    () =>
      document
        .querySelector('#tool-output')
        ?.value.includes('SWISS LOCAL OCR') ||
      document.body.textContent.includes('Could not load OCR.'),
    undefined,
    { timeout: 60_000 },
  );
  assert.match(
    await page.getByLabel('Extracted text').inputValue(),
    /SWISS LOCAL OCR/,
    await page.locator('section .feedback').first().innerText(),
  );
  assert(
    !(await page
      .getByLabel('Extracted text')
      .inputValue()
      .then((text) => text.includes('SECOND LINE'))),
  );
  // A real new job is terminated, and another can recreate its workers.
  await page.getByRole('button', { name: 'Full image', exact: true }).click();
  await page
    .getByRole('button', { name: 'Extract text', exact: true })
    .last()
    .click();
  await page
    .getByRole('button', { name: 'Cancel', exact: true })
    .click({ force: true });
  await page.getByText('Recognition cancelled.', { exact: true }).waitFor();
  await page
    .getByRole('button', { name: 'Extract text', exact: true })
    .last()
    .click();
  await page.waitForFunction(
    () => document.querySelector('#tool-output')?.value.includes('SECOND LINE'),
    undefined,
    { timeout: 60_000 },
  );
  await page.getByLabel('Region x').fill('-1');
  await page
    .getByRole('button', { name: 'Extract text', exact: true })
    .last()
    .click();
  await page
    .getByText('Select a region inside the image.', { exact: true })
    .waitFor();
  assert.equal(await page.getByLabel('Extracted text').inputValue(), '');
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  assert.equal(await page.getByLabel('Extracted text').inputValue(), '');
}
export async function waitUntil(check, milliseconds = 60_000) {
  const deadline = Date.now() + milliseconds;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Browser check timed out');
}
