// Runs unchanged through Playwright and stock Firefox/Zen's WebDriver BiDi.
// Fixtures are synthetic test credentials; production has no test hooks.
export async function identityUiChecks({ fixtures, verifyFirst = false }) {
  let phase = 'startup';
  const wait = async (check) => {
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      if (check()) return;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error(
      `Identity UI timed out (${phase}): ` +
        document.querySelector('#identity-feedback')?.textContent,
    );
  };
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const button = (label, scope = document) =>
    [...scope.querySelectorAll('button')].find(
      (button) =>
        (button.getAttribute('aria-label') ?? button.textContent.trim()) ===
        label,
    );
  const navigate = async (label) => {
    if (!document.querySelector('nav')?.getClientRects().length) {
      button('Toggle Sidebar').click();
      await wait(() => document.querySelector('nav')?.getClientRects().length);
    }
    button(label, document.querySelector('nav')).click();
    await wait(() => !document.querySelector('[role="dialog"]'));
    await wait(() => document.querySelector('h1')?.textContent === label);
  };
  const input = (selector, value) => {
    const element = document.querySelector(selector);
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
  const status = () =>
    document.querySelector('#identity-feedback')?.textContent;
  const password = '  café 🔐  ';
  if (verifyFirst) {
    phase = 'first verification';
    await navigate('Verify password');
    const fixture = fixtures.find(
      (fixture) =>
        fixture.expected === 'Success' &&
        fixture.password !== 'test cancellation',
    );
    input('#identity-password', fixture.password);
    input('#identity-hash', fixture.hash);
    await wait(() => status() === 'Password matches.');
    button('Clear').click();
    await wait(() => document.querySelector('#identity-password').value === '');
  }
  phase = 'hash generation';
  await navigate('Hash password');
  assert(
    document.querySelector('#identity-password').value === '' &&
      document.querySelector('#tool-output').value === '',
    'Fresh workspace must not restore passwords or hashes',
  );
  await wait(
    () => !button('Hash password', document.querySelector('section')).disabled,
  );
  assert(
    document.querySelector('#identity-password').type === 'text',
    'Password must be visible',
  );
  assert(
    !button('Show password') && !button('Hide password'),
    'Visibility toggles should be removed',
  );
  input('#identity-password', password);
  await wait(
    () => document.querySelector('#identity-password').value === password,
  );
  button('Hash password', document.querySelector('section')).click();
  await wait(() => button('Cancel'));
  button('Cancel').click();
  await wait(
    () =>
      status() === 'Hashing cancelled.' &&
      !button('Hash password', document.querySelector('section')).disabled,
  );
  assert(
    document.querySelector('#tool-output').value === '',
    'Cancelled hashing left a result',
  );
  const generate = async () => {
    button('Hash password', document.querySelector('section')).click();
    await wait(() => button('Cancel'));
    await wait(
      () =>
        status() === 'Hash generated.' || status()?.includes('could not start'),
    );
    assert(status() === 'Hash generated.', 'Identity runtime failed');
    return document.querySelector('#tool-output').value;
  };
  const first = await generate();
  const second = await generate();
  assert(
    first !== second && first.startsWith('AQ'),
    'Identity V3 must use independent salts',
  );
  await navigate('Verify password');
  assert(
    document.querySelector('#identity-password').type === 'text',
    'Verification password must be visible',
  );
  input('#identity-password', password);
  input('#identity-hash', first);
  await wait(() => status() === 'Password matches.');
  input('#identity-password', 'café 🔐');
  await wait(() => status() === 'Password does not match.');
  input('#identity-password', password);
  await wait(() => status() === 'Password matches.');
  await navigate('Hash password');
  assert(
    document.querySelector('#identity-password').value === password,
    'Navigation lost password',
  );
  assert(
    document.querySelector('#tool-output').value === second,
    'Navigation lost generated hash',
  );
  button('Clear').click();
  await wait(() => document.querySelector('#identity-password').value === '');
  assert(
    document.querySelector('#identity-password').type === 'text',
    'Password remains visible after Clear',
  );
  assert(
    document.querySelector('#tool-output').value === '',
    'Clear must erase generated hash',
  );
  await navigate('Verify password');
  phase = 'native fixtures';
  for (const fixture of fixtures) {
    // The million-iteration fixture is exercised below during active cancellation.
    if (fixture.password === 'test cancellation') continue;
    input('#identity-password', fixture.password);
    input('#identity-hash', fixture.hash);
    await wait(() => status() === 'Verifying…');
    const expected =
      fixture.expected === 'Success'
        ? 'Password matches.'
        : fixture.expected === 'SuccessRehashNeeded'
          ? 'Password matches. Identity recommends generating an updated hash.'
          : 'Unsupported hash format or parameters. This tool supports Identity V2/V3 with up to 1,000,000 iterations and 64-byte subkeys.';
    await wait(() => status() === expected);
  }
  phase = 'malformed hash';
  input('#identity-hash', 'broken!');
  await wait(
    () => status() === 'Enter a valid ASP.NET Identity password hash.',
  );
  phase = 'latest-input mismatch';
  // Change inputs after work has started; a stale success must never replace mismatch.
  const slow = fixtures.find(
    (fixture) => fixture.password === 'test cancellation',
  );
  input('#identity-password', slow.password);
  input('#identity-hash', slow.hash);
  await wait(() => status() === 'Verifying…');
  await new Promise((resolve) => setTimeout(resolve, 275));
  input('#identity-password', 'wrong password');
  await wait(() => status() === 'Password does not match.');
  phase = 'active verification cancellation';
  input('#identity-password', slow.password);
  await wait(() => button('Cancel'));
  button('Cancel').click();
  await wait(() => status() === 'Verification cancelled.');
  phase = 'verification restart';
  input('#identity-password', password);
  input('#identity-hash', first);
  await wait(() => status() === 'Password matches.');
  button('Clear').click();
  await wait(
    () =>
      document.querySelector('#identity-password').value === '' &&
      document.querySelector('#identity-hash').value === '',
  );
  assert(
    document.querySelector('#identity-password').type === 'text',
    'Verification Password remains visible after Clear',
  );
  assert(
    localStorage.length === 0 && sessionStorage.length === 0,
    'Identity must not persist workspace data',
  );
  return {
    hashes: [first, second],
    password,
    checks: [
      'Identity hashing and automatic verification',
      'Native Identity V2/V3 fixtures and upgrade feedback',
      'Exact password spaces and Unicode',
      'Salt independence, mismatch and malformed/unsupported input',
      'Cancellation/restart, latest-input results and navigation state',
      'Visible password inputs, Clear erases fields; no workspace persistence',
    ],
  };
}
