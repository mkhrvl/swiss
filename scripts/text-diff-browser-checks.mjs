// Runs unchanged in Playwright and stock-browser WebDriver BiDi.
export async function textDiffUiChecks() {
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const wait = async (test) => {
    const deadline = Date.now() + 10_000;
    while (!test()) {
      if (Date.now() > deadline)
        throw new Error('Text comparison check timed out');
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
  const field = (side) => document.querySelector(`#text-diff-${side}`);
  const status = () =>
    document.querySelector('#text-diff-feedback').textContent;
  const result = () => document.querySelector('#text-diff-result');
  async function fill(side, value) {
    Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      'value',
    ).set.call(field(side), value);
    field(side).dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  // Wait for the responsive sidebar to finish switching after a viewport change.
  await wait(
    () =>
      Boolean(document.querySelector('[data-slot="sidebar-gap"]')) ===
      matchMedia('(min-width: 768px)').matches,
  );
  await navigate('Compare text');
  if (!button('Clear').disabled) button('Clear').click();
  await wait(() => status() === 'Enter text on either side to compare.');
  assert(button('Swap texts').disabled, 'Empty inputs can be swapped');
  await fill('original', 'The old fox.\n');
  await fill('revised', 'The new fox.\n');
  await wait(() => result()?.querySelector('ins')?.textContent === 'new');
  assert(
    result().querySelector('del').textContent === 'old',
    'Removed word is not highlighted',
  );
  assert(
    status() === '3 characters added · 3 characters removed',
    'Incorrect diff summary',
  );
  assert(
    document.querySelector('#text-diff-output').readOnly,
    'Comparison results must use a selectable read-only field',
  );
  assert(
    getComputedStyle(result()).whiteSpace === 'break-spaces',
    'Diff hides whitespace',
  );
  await navigate('JSON');
  await navigate('Compare text');
  assert(
    field('original').value === 'The old fox.\n' &&
      field('revised').value === 'The new fox.\n',
    'Navigation lost comparison inputs',
  );
  button('Swap texts').click();
  await wait(() => result()?.querySelector('ins')?.textContent === 'old');
  assert(
    field('original').value === 'The new fox.\n',
    'Swap did not reverse inputs',
  );
  await fill('revised', 'The new fox.\n');
  await wait(() => status() === 'Texts are identical.');
  assert(
    !result().querySelector('ins, del'),
    'Identical text contains changes',
  );
  await fill('original', 'a b\n');
  await fill('revised', 'a  b\n');
  await wait(() => result()?.querySelector('ins')?.textContent === ' ');
  const uuid = '96356d0f4a34466a930982ba8a4e0cbe';
  await fill('original', uuid);
  await fill('revised', uuid.slice(0, -1));
  await wait(() => status() === '0 characters added · 1 characters removed');
  assert(
    result().querySelector('del').textContent === 'e',
    'UUID deletion highlighted unchanged characters',
  );
  assert(!result().querySelector('ins'), 'UUID deletion claims text was added');
  assert(
    result().textContent === uuid,
    'UUID deletion duplicated unchanged context',
  );
  await fill('revised', uuid.slice(0, -1) + 'f');
  await wait(() => status() === '1 characters added · 1 characters removed');
  assert(
    result().querySelector('del').textContent === 'e' &&
      result().querySelector('ins').textContent === 'f',
    'UUID replacement highlighted the entire identifier',
  );
  await fill('original', '');
  await fill('revised', '<img src=x onerror=alert(1)>🔑');
  await wait(() =>
    result()?.querySelector('ins')?.textContent.includes('<img'),
  );
  assert(!result().querySelector('img'), 'Diff text was rendered as HTML');
  await fill('original', 'a '.repeat(4000));
  await fill('revised', 'b '.repeat(4000));
  await wait(() =>
    document
      .querySelector('section[aria-labelledby="text-diff-title"]')
      .textContent.includes('Large changes are grouped'),
  );
  await fill('original', 'x'.repeat(32_769));
  await wait(() => field('original').getAttribute('aria-invalid') === 'true');
  assert(!result(), 'Oversized input retained stale diff');
  assert(
    field('original').value.length === 32_769,
    'Oversized input was silently truncated',
  );
  await fill('original', 'x'.repeat(2000));
  await fill('revised', 'y'.repeat(2000));
  await wait(() => result()?.querySelector('ins')?.textContent.length === 2000);
  assert(
    document.documentElement.scrollWidth <= innerWidth,
    'Text comparison overflows the viewport',
  );
  button('Clear').click();
  await wait(
    () => !field('original').value && !field('revised').value && !result(),
  );
  assert(
    localStorage.length === 0 && sessionStorage.length === 0,
    'Comparison persisted workspace text',
  );
  return {
    checks: [
      'Live text comparison: exact character edits within words/UUIDs, whitespace, identical/empty text, escaped markup and bounded large input',
      'Comparison swap, clear, navigation state, narrow layout and offline use without persistence',
    ],
  };
}
