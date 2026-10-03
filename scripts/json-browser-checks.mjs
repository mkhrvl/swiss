// Shared acceptance checks for Playwright and stock-browser WebDriver BiDi.
export async function jsonUiChecks() {
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const wait = async (test) => {
    const deadline = Date.now() + 10_000;
    while (!test()) {
      if (Date.now() > deadline)
        throw new Error('JSON browser check timed out');
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  };
  const button = (label, scope = document) =>
    [...scope.querySelectorAll('button')].find(
      (item) =>
        (item.getAttribute('aria-label') ?? item.textContent.trim()) === label,
    );
  async function navigate(label) {
    if (!document.querySelector('nav')?.getClientRects().length) {
      button('Toggle Sidebar').click();
      await wait(() => document.querySelector('nav')?.getClientRects().length);
    }
    button(label, document.querySelector('nav')).click();
    await wait(
      () =>
        !document.querySelector('[role="dialog"]') &&
        document.querySelector('h1')?.textContent === label,
    );
  }
  const input = () => document.querySelector('#json-input');
  const output = () => document.querySelector('#json-output').value;
  const status = () => document.querySelector('#json-feedback').textContent;
  async function fill(value) {
    Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      'value',
    ).set.call(input(), value);
    input().dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  await navigate('JSON');
  assert(
    status() === 'Paste JSON to get started.',
    'Empty JSON should be neutral',
  );
  assert(button('Copy json output').disabled, 'Empty JSON output is copyable');
  const source = '{"users":[{"name":"Ada","id":9007199254740993}],"a.b":-0}';
  await fill(source);
  await wait(
    () => status() === 'Valid JSON.' && output().includes('\n  "users":'),
  );
  assert(
    output().includes('9007199254740993') && output().includes('-0'),
    'JSON formatting changed number literals',
  );
  const surface = input().closest('.syntax-surface');
  const outputSurface = document
    .querySelector('#json-output')
    .closest('.syntax-surface');
  assert(
    surface.querySelector('[data-syntax="property"]')?.textContent ===
      '"users"',
    'JSON input keys are not highlighted',
  );
  assert(
    outputSurface.querySelector('[data-syntax="number"]')?.textContent ===
      '9007199254740993',
    'JSON output numbers are not highlighted',
  );
  assert(
    surface.querySelector('pre').getAttribute('aria-hidden') === 'true',
    'Highlighting duplicates accessible input text',
  );
  assert(
    Number.parseFloat(
      getComputedStyle(document.querySelector('#json-output')).paddingRight,
    ) === 12,
    'COPY reserves output text width',
  );
  const numbered = (element) =>
    [...element.closest('.syntax-surface').querySelectorAll('[data-line]')].map(
      (line) => Number(line.dataset.line),
    );
  assert(
    JSON.stringify(numbered(input())) === '[1]',
    'Input should number logical lines, not soft wraps',
  );
  const outputLines = output().split(/\r\n|\r|\n/).length;
  assert(
    numbered(document.querySelector('#json-output')).length === outputLines,
    'Output line numbering is out of sync',
  );
  assert(
    numbered(document.querySelector('#json-output')).at(-1) === outputLines,
    'Output line numbering is not sequential',
  );
  const copyBounds = button('Copy json output').getBoundingClientRect();
  const textBounds = document
    .querySelector('#json-output')
    .getBoundingClientRect();
  assert(
    copyBounds.top >= textBounds.top &&
      copyBounds.top < textBounds.top + 12 &&
      copyBounds.right >= textBounds.right - 24,
    'JSON copy should be at the top right of its text area',
  );
  assert(
    document.querySelector('#json-output').scrollHeight <=
      document.querySelector('#json-output').clientHeight + 1,
    'JSON output should grow to fit its content',
  );
  await fill(source + '\n'.repeat(20));
  assert(
    numbered(input()).length === 21,
    'Trailing empty input lines must be numbered',
  );
  await wait(() => input().clientHeight > 300);
  await fill(source);
  await wait(() => input().clientHeight < 200);
  button('4 spaces').click();
  await wait(() => output().includes('\n    "users":'));
  button('Tabs').click();
  await wait(() => output().includes('\n\t"users":'));
  button('Minify').click();
  await wait(() => output() === source);
  assert(
    numbered(document.querySelector('#json-output')).length === 1,
    'Minified JSON should have one numbered line',
  );
  assert(button('Tabs').disabled, 'Minify should disable indentation');
  button('Format').click();
  await wait(() => output().includes('\n\t"users":'));
  assert(!document.querySelector('#json-path'), 'Cursor path feature remains');
  const descriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  let write;
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: (value) => write(value) },
  });
  try {
    let copiedValue;
    write = async (value) => {
      copiedValue = value;
    };
    button('Copy json output').click();
    await wait(() => button('Copy json output').textContent === 'COPIED');
    assert(copiedValue === output(), 'Copied the wrong JSON output');
    await wait(() => button('Copy json output').textContent === 'COPY');
    let finish;
    write = () =>
      new Promise((resolve) => {
        finish = resolve;
      });
    button('Copy json output').click();
    button('Minify').click();
    await wait(() => output() === source);
    finish();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert(
      button('Copy json output').textContent === 'COPY',
      'Stale copy marked new JSON output as copied',
    );
    write = async () => {
      throw new Error('Clipboard denied');
    };
    button('Copy json output').click();
    await wait(() =>
      document
        .querySelector('#json-output-copy-feedback')
        .textContent.startsWith('Copy unavailable.'),
    );
    assert(
      button('Copy json output').textContent === 'COPY',
      'Failed copy claimed success',
    );
  } finally {
    if (descriptor) Object.defineProperty(navigator, 'clipboard', descriptor);
    else delete navigator.clipboard;
  }
  await navigate('Generate API key');
  await navigate('JSON');
  assert(
    input().value === source && output() === source,
    'Navigation lost JSON input/options',
  );
  await fill('{\r\n"a":\r\n}');
  await wait(() => status().includes('Line 3, column 1.'));
  assert(
    input().getAttribute('aria-invalid') === 'true' && output() === '',
    'Invalid JSON retained stale results',
  );
  button('Go to error').click();
  assert(
    document.activeElement === input() &&
      input().value[input().selectionStart] === '}',
    'Go to error did not select the error',
  );
  await fill('{"x":1,}');
  await wait(() => input().getAttribute('aria-invalid') === 'true');
  await fill('{"text":"<img src=x onerror=alert(1)>","ok":true,"nil":null}');
  await wait(() => status() === 'Valid JSON.');
  assert(
    !document.querySelector('.syntax-surface img'),
    'JSON was rendered as HTML',
  );
  assert(
    document
      .querySelector('#json-output')
      .closest('.syntax-surface')
      .querySelector('[data-syntax="keyword"]')?.textContent === 'true',
    'JSON keywords are not highlighted',
  );
  await fill('null');
  await wait(() => status() === 'Valid JSON.' && output() === 'null');
  assert(
    document.querySelector('#json-output').readOnly,
    'JSON results must be selectable read-only fields',
  );
  assert(
    document.documentElement.scrollWidth <= innerWidth,
    'JSON screen overflows',
  );
  assert(
    localStorage.length === 0 && sessionStorage.length === 0,
    'JSON persisted workspace data',
  );
  return {
    checks: [
      'Live strict JSON validation, error selection, lossless formatting/minifying and indentation',
      'Line numbering, timed copy feedback/failure, stale-copy suppression and navigation state',
      'Selectable results, narrow layout and offline use without workspace persistence',
      'Local syntax highlighting, native editing, escaped HTML and floating COPY without reserved width',
    ],
  };
}
