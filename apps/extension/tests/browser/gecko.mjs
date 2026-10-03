import { jsonUiChecks } from '../../../../scripts/json-browser-checks.mjs';
import { bcryptUiChecks } from '../../../../scripts/bcrypt-browser-checks.mjs';
import { secretGenerationUiChecks } from '../../../../scripts/secret-generation-browser-checks.mjs';
// Stock Firefox/Zen use WebDriver BiDi; Playwright's patched Firefox is not Zen.
import { spawn } from 'node:child_process';
import { cp, readFile, writeFile, mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { identityUiChecks } from '../../../../scripts/identity-browser-checks.mjs';
const fixtures = JSON.parse(
  await readFile('packages/core/tests/browser/identity-fixtures.json', 'utf8'),
);
import {
  serve,
  waitUntil,
  assert,
} from '../../../../scripts/browser-test-support.mjs';

const browserName = process.argv[2] ?? 'firefox';
const extension = process.argv[3] === 'extension';
const binary = process.env.SWISS_GECKO;
if (!binary)
  throw new Error('Set SWISS_GECKO to the Firefox or Zen executable path.');
const port = browserName === 'zen' ? 9347 : 9346;
const temporary = await mkdtemp(join(tmpdir(), `swiss-${browserName}-`));
const profile = join(temporary, 'profile');
await mkdir(profile);
await writeFile(
  join(profile, 'user.js'),
  [
    'user_pref("browser.shell.checkDefaultBrowser", false);',
    'user_pref("browser.aboutwelcome.enabled", false);',
    'user_pref("datareporting.policy.dataSubmissionEnabled", false);',
    'user_pref("browser.cache.disk.enable", false);',
    'user_pref("browser.cache.memory.enable", false);',
  ].join('\n'),
);
const server = await serve('apps/pwa/dist');
const child = spawn(
  binary,
  [
    '--headless',
    '--no-remote',
    '-remote-allow-system-access',
    '--profile',
    profile,
    '--remote-debugging-port',
    String(port),
    'about:blank',
  ],
  { stdio: ['ignore', 'ignore', 'pipe'] },
);
let browserLog = '';
child.stderr.on('data', (bytes) => {
  browserLog = (browserLog + bytes.toString()).slice(-3000);
});
let socket;
try {
  await waitUntil(async () => {
    const candidate = new WebSocket(`ws://127.0.0.1:${port}/session`);
    const opened = await new Promise((resolve) => {
      candidate.onopen = () => resolve(true);
      candidate.onerror = () => resolve(false);
    });
    if (opened) {
      socket = candidate;
      return true;
    }
    candidate.close();
    return false;
  }, 30_000);
  let id = 0;
  const requests = new Map();
  const errors = [];
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const pending = requests.get(message.id);
      requests.delete(message.id);
      clearTimeout(pending.timer);
      if (message.type === 'error')
        pending.reject(new Error(`${message.error}: ${message.message}`));
      else pending.resolve(message.result);
    } else if (
      message.method === 'log.entryAdded' &&
      message.params.level === 'error'
    )
      errors.push(message.params.text.slice(0, 300));
  };
  const call = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const requestId = ++id;
      const timer = setTimeout(() => {
        requests.delete(requestId);
        reject(new Error(`BiDi ${method} timed out`));
      }, 180_000);
      requests.set(requestId, { resolve, reject, timer });
      socket.send(JSON.stringify({ id: requestId, method, params }));
    });
  const session = await call('session.new', {
    capabilities: { alwaysMatch: {} },
  });
  await call('session.subscribe', { events: ['log.entryAdded'] });
  let { context } = await call('browsingContext.create', { type: 'tab' });
  if (extension) {
    const target = join(temporary, 'extension');
    await cp(
      resolve(
        process.env.SWISS_EXTENSION_DIR ?? 'apps/extension/.output/firefox-mv2',
      ),
      target,
      {
        recursive: true,
      },
    );
    const manifest = JSON.parse(
      await readFile(join(target, 'manifest.json'), 'utf8'),
    );
    // Test-only bootstrap opens a real built workspace; production entrypoints are unchanged.
    manifest.background.scripts.push('test-bootstrap.js');
    await writeFile(join(target, 'manifest.json'), JSON.stringify(manifest));
    await writeFile(
      join(target, 'test-bootstrap.js'),
      "browser.runtime.onInstalled.addListener(() => browser.tabs.create({url: browser.runtime.getURL('/workspace.html')}));",
    );
    await call('webExtension.install', {
      extensionData: { type: 'path', path: target },
    });
    await waitUntil(async () => {
      const tree = await call('browsingContext.getTree');
      const page = tree.contexts.find(
        (item) =>
          item.url.startsWith('moz-extension:') &&
          item.url.endsWith('/workspace.html'),
      );
      if (page) {
        context = page.context;
        return true;
      }
    }, 30_000);
  } else
    await call('browsingContext.navigate', {
      context,
      url: server.url,
      wait: 'complete',
    });
  // Stock Gecko cannot resize privileged extension contexts through BiDi.
  if (!extension) {
    await call('browsingContext.setViewport', {
      context,
      viewport: { width: 360, height: 800 },
    });
  }
  const evaluate = async (expression) => {
    const evaluation = await call('script.evaluate', {
      expression,
      target: { context },
      awaitPromise: true,
    });
    if (evaluation.type === 'exception')
      throw new Error(JSON.stringify(evaluation.exceptionDetails));
    return evaluation.result?.value;
  };
  async function uiChecks() {
    const result = await evaluate(
      `(${async function () {
        const wait = async (check) => {
          const end = Date.now() + 60_000;
          while (Date.now() < end) {
            if (check()) return;
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
          throw new Error(
            'UI check timed out: ' + document.body.innerText.slice(-700),
          );
        };
        const assert = (condition, message) => {
          if (!condition) throw new Error(message);
        };
        const button = (label) =>
          [...document.querySelectorAll('button')].find(
            (button) =>
              (button.getAttribute('aria-label') ??
                button.textContent.trim()) === label,
          );
        const navigate = async (index) => {
          if (!document.querySelector('nav')?.getClientRects().length) {
            button('Toggle Sidebar').click();
            await wait(
              () => document.querySelector('nav')?.getClientRects().length,
            );
          }
          document.querySelectorAll('nav button')[index].click();
          await wait(() => !document.querySelector('[role="dialog"]'));
        };
        const input = (element, value) => {
          const prototype =
            element instanceof HTMLTextAreaElement
              ? HTMLTextAreaElement.prototype
              : HTMLInputElement.prototype;
          Object.getOwnPropertyDescriptor(prototype, 'value').set.call(
            element,
            value,
          );
          element.dispatchEvent(new Event('input', { bubbles: true }));
        };
        await wait(() => document.querySelector('#base64-input'));
        input(document.querySelector('#base64-input'), 'ICBjYWbDqSDwn5SQICA=');
        await wait(
          () => document.querySelector('#tool-output').value === '  café 🔐  ',
        );
        await navigate(1);
        await wait(() => document.querySelector('#image-input'));
        await navigate(0);
        await wait(
          () =>
            document.querySelector('#base64-input')?.value ===
            'ICBjYWbDqSDwn5SQICA=',
        );
        input(document.querySelector('#base64-input'), 'broken!');
        await wait(() => document.querySelector('#tool-output').value === '');
        await navigate(1);
        await wait(() => document.querySelector('#image-input'));
        const canvas = document.createElement('canvas');
        canvas.width = 900;
        canvas.height = 300;
        const drawing = canvas.getContext('2d');
        drawing.fillStyle = 'white';
        drawing.fillRect(0, 0, 900, 300);
        drawing.fillStyle = 'black';
        drawing.font = '48px sans-serif';
        drawing.fillText('SWISS LOCAL OCR', 30, 95);
        drawing.fillText('SECOND LINE', 30, 245);
        const blob = await new Promise((resolve) => canvas.toBlob(resolve));
        const transfer = new DataTransfer();
        transfer.items.add(
          new File([blob], 'english-fixture.png', { type: 'image/png' }),
        );
        document.querySelector('#image-input').files = transfer.files;
        document
          .querySelector('#image-input')
          .dispatchEvent(new Event('change', { bubbles: true }));
        await wait(() =>
          document.querySelector('[aria-label="Region height"]'),
        );
        input(document.querySelector('[aria-label="Region height"]'), '145');
        await new Promise((resolve) => setTimeout(resolve, 50));
        button('Extract text').click();
        await wait(() =>
          document
            .querySelector('#tool-output')
            .value.includes('SWISS LOCAL OCR'),
        );
        assert(
          !document.querySelector('#tool-output').value.includes('SECOND LINE'),
          'Crop included unselected text',
        );
        button('Full image').click();
        await new Promise((resolve) => setTimeout(resolve, 50));
        button('Extract text').click();
        await wait(() => button('Cancel'));
        button('Cancel').click();
        await wait(() =>
          document.body.textContent.includes('Recognition cancelled.'),
        );
        button('Extract text').click();
        await wait(() =>
          document.querySelector('#tool-output').value.includes('SECOND LINE'),
        );
        return JSON.stringify({
          passed: true,
          checks: [
            'Base64 exact text and invalid input',
            'Tool navigation preserves input state',
            'Real English OCR and source-pixel crop',
            'Worker cancellation and restart',
          ],
        });
      }.toString()})()`,
    );
    return JSON.parse(result);
  }
  const result = await uiChecks();
  const identity = JSON.parse(
    await evaluate(
      `(async () => JSON.stringify(await (${identityUiChecks.toString()})(${JSON.stringify({ fixtures })})))()`,
    ),
  );
  result.checks.push(...identity.checks);
  const bcrypt = JSON.parse(
    await evaluate(
      `(async () => JSON.stringify(await (${bcryptUiChecks.toString()})()))()`,
    ),
  );
  result.checks.push(...bcrypt.checks);
  const generators = JSON.parse(
    await evaluate(
      `(async () => JSON.stringify(await (${secretGenerationUiChecks.toString()})()))()`,
    ),
  );
  result.checks.push(...generators.checks);
  const json = JSON.parse(
    await evaluate(
      `(async () => JSON.stringify(await (${jsonUiChecks.toString()})()))()`,
    ),
  );
  result.checks.push(...json.checks);
  await mkdir('artifacts/web-browser', { recursive: true });
  await writeFile(
    `artifacts/web-browser/identity-${browserName}-${extension ? 'extension' : 'pwa'}.json`,
    JSON.stringify(identity),
  );
  // BiDi cannot capture privileged extension pages; Chromium covers extension layout.
  if (!extension) {
    const screenshot = await call('browsingContext.captureScreenshot', {
      context,
      origin: 'document',
    });
    await writeFile(
      `artifacts/web-browser/${browserName}-pwa.png`,
      Buffer.from(screenshot.data, 'base64'),
    );
  }
  if (!extension) {
    await evaluate('(async () => { await navigator.serviceWorker.ready; })()');
    await waitUntil(
      async () => await evaluate('!!navigator.serviceWorker.controller'),
    );
    await server.close();
    await call('browsingContext.reload', { context, wait: 'complete' });
    await uiChecks();
    result.checks.push(
      'Fresh offline reload and OCR with server stopped and both HTTP caches disabled',
    );
  } else {
    await call('browsingContext.reload', { context, wait: 'complete' });
    await uiChecks();
    result.checks.push(
      'Fresh extension reload and recognition from bundled model data under native CSP',
    );
  }
  assert.deepEqual(errors, []);
  await evaluate(
    `(async () => JSON.stringify(await (${identityUiChecks.toString()})(${JSON.stringify({ fixtures, verifyFirst: true })})))()`,
  );
  await evaluate(`(${bcryptUiChecks.toString()})()`);
  await evaluate(`(${secretGenerationUiChecks.toString()})()`);
  await evaluate(`(${jsonUiChecks.toString()})()`);
  const evidence = {
    browser: browserName,
    version: session.capabilities.browserVersion,
    host: extension ? 'extension' : 'pwa',
    ...result,
    errors,
  };
  console.log(JSON.stringify(evidence, null, 2));
  await writeFile(
    `artifacts/web-browser/${browserName}-${extension ? 'extension' : 'pwa'}.json`,
    JSON.stringify(evidence, null, 2),
  );
  await call('session.end');
} catch (error) {
  console.error(browserLog.slice(-1000));
  throw error;
} finally {
  socket?.close();
  child.kill('SIGTERM');
  await server.close();
  await new Promise((resolve) =>
    child.exitCode !== null ? resolve() : child.once('exit', resolve),
  );
  await rm(temporary, { recursive: true, force: true });
}
