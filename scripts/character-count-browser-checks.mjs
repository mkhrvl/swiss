// Shared acceptance checks for Playwright and stock-browser WebDriver BiDi.
export async function characterCountUiChecks() {
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const wait = async (test) => {
    const deadline = Date.now() + 10_000;
    while (!test()) {
      if (Date.now() > deadline)
        throw new Error('Character count check timed out');
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
  const input = () => document.querySelector('#character-count-input');
  const result = () =>
    document.querySelector('#character-count-result').textContent;
  async function fill(value) {
    Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      'value',
    ).set.call(input(), value);
    input().dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  // Let the responsive sidebar finish switching before using its trigger.
  await wait(
    () =>
      Boolean(document.querySelector('[data-slot="sidebar-gap"]')) ===
      matchMedia('(min-width: 768px)').matches,
  );
  await navigate('Count characters');
  assert(result() === '0 characters', 'Empty text should count as zero');
  assert(button('Clear').disabled, 'Empty text should disable Clear');
  await fill('👨‍👩‍👧‍👦e\u0301 \n');
  await wait(() => result() === '4 characters');
  await navigate('JSON');
  await navigate('Count characters');
  assert(
    input().value === '👨‍👩‍👧‍👦e\u0301 \n' && result() === '4 characters',
    'Navigation lost character input',
  );
  await fill('x'.repeat(262_145));
  await wait(() => input().getAttribute('aria-invalid') === 'true');
  assert(
    result().includes('Shorten it to count.'),
    'Oversized input shows a misleading count',
  );
  assert(
    input().value.length === 262_145,
    'Oversized input was silently truncated',
  );
  await fill('x'.repeat(10_000));
  await wait(() => input().getAttribute('aria-invalid') === 'false');
  assert(
    document.documentElement.scrollWidth <= innerWidth,
    'Character counter overflows',
  );
  button('Clear').click();
  await wait(() => result() === '0 characters' && input().value === '');
  await fill('👍🏽');
  await wait(() => result() === '1 character');
  button('Clear').click();
  await wait(() => result() === '0 characters');
  assert(
    localStorage.length === 0 && sessionStorage.length === 0,
    'Character counter persisted text',
  );
  return {
    checks: [
      'Live Unicode character counts, whitespace, Clear, navigation, input bounds and offline use',
    ],
  };
}
