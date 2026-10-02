// Self-contained for Playwright evaluation and stock-browser WebDriver BiDi.
export async function bcryptUiChecks() {
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const wait = async (test) => {
    const deadline = Date.now() + 15_000;
    while (!test()) {
      if (Date.now() > deadline)
        throw new Error('Bcrypt browser check timed out');
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
  async function fill(id, value) {
    const element = document.querySelector(id);
    const prototype =
      element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(
      element,
      value,
    );
    element.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  const feedback = () =>
    document.querySelector('#bcrypt-feedback')?.textContent;
  const hashValue = () => document.querySelector('#bcrypt-output')?.value;
  const action = (label) =>
    button(label, document.querySelector('form')).click();
  const password = '  café 🔐  ';
  const fixture =
    '$2b$04$abcdefghijklmnopqrstuuK3nEtR/OYkgNnPTl7gUVWmBqJNnKuJO';
  await navigate('Generate bcrypt hash');
  assert(
    document.querySelector('#bcrypt-password').type === 'text' &&
      !button('Show password') &&
      !button('Hide password'),
    'Bcrypt passwords should be visible without toggles',
  );
  assert(
    document.querySelector('#bcrypt-cost').value === '12',
    'Default bcrypt cost must be 12',
  );
  assert(
    document.querySelector('#bcrypt-cost').min === '4' &&
      document.querySelector('#bcrypt-cost').max === '20',
    'Bcrypt cost bounds are wrong',
  );
  assert(
    document.querySelector('[role="slider"]').getAttribute('aria-valuenow') ===
      '12',
    'Cost slider is out of sync',
  );
  assert(
    document
      .querySelector('#bcrypt-cost-guidance')
      .textContent.includes('Recommended'),
    'Default cost guidance is missing',
  );
  await fill('#bcrypt-password', password);
  action('Generate bcrypt hash');
  await wait(() => hashValue()?.startsWith('$2b$12$'));
  const defaultHash = hashValue();
  await fill('#bcrypt-cost', '4');
  await wait(() =>
    document.querySelector('#bcrypt-cost-guidance').textContent.includes('Low'),
  );
  await wait(() => hashValue() === '');
  action('Generate bcrypt hash');
  await wait(() => hashValue()?.startsWith('$2b$04$'));
  const hash = hashValue();
  action('Generate bcrypt hash');
  await wait(() => hashValue() !== hash && hashValue()?.length === 60);
  await fill('#bcrypt-cost', '10');
  await wait(() =>
    document
      .querySelector('#bcrypt-cost-guidance')
      .textContent.includes('Acceptable'),
  );
  await fill('#bcrypt-cost', '3');
  await wait(
    () =>
      button('Generate bcrypt hash', document.querySelector('form')).disabled,
  );
  assert(
    document.querySelector('#bcrypt-cost').getAttribute('aria-invalid') ===
      'true',
    'Invalid cost lacks accessible feedback',
  );
  await fill('#bcrypt-cost', '20');
  await wait(() =>
    document
      .querySelector('#bcrypt-cost-guidance')
      .textContent.includes('Very expensive'),
  );
  action('Generate bcrypt hash');
  await wait(() => feedback() === 'Hashing…');
  await new Promise((resolve) => setTimeout(resolve, 200));
  button('Cancel').click();
  await wait(() => feedback() === 'Hashing cancelled.');
  assert(hashValue() === '', 'Cancelled hash leaked a result');
  await fill('#bcrypt-cost', '4');
  action('Generate bcrypt hash');
  await wait(() => hashValue()?.startsWith('$2b$04$'));
  await fill('#bcrypt-password', '🔐'.repeat(19));
  await wait(
    () =>
      button('Generate bcrypt hash', document.querySelector('form')).disabled,
  );
  assert(
    document.querySelector('#bcrypt-password').getAttribute('aria-invalid') ===
      'true',
    'Byte limit is not checked',
  );
  await fill('#bcrypt-password', password);
  await wait(() => document.querySelector('#bcrypt-password').type === 'text');
  await navigate('Verify bcrypt hash');
  await fill('#bcrypt-password', password);
  await fill('#bcrypt-stored-hash', fixture);
  action('Verify bcrypt hash');
  await wait(() => feedback() === 'Password matches.');
  await fill('#bcrypt-password', password.trim());
  await wait(() => feedback() === '');
  action('Verify bcrypt hash');
  await wait(() => feedback() === 'Password does not match.');
  await fill('#bcrypt-password', password);
  for (const version of ['2a', '2y']) {
    await fill('#bcrypt-stored-hash', fixture.replace('2b', version));
    action('Verify bcrypt hash');
    await wait(() => feedback() === 'Password matches.');
  }
  await fill('#bcrypt-stored-hash', 'bad hash');
  action('Verify bcrypt hash');
  await wait(() => feedback()?.includes('valid 60-character'));
  await fill('#bcrypt-stored-hash', fixture.replace('$04$', '$21$'));
  action('Verify bcrypt hash');
  await wait(() => feedback()?.includes('costs from 4 to 20'));
  await fill('#bcrypt-stored-hash', fixture.replace('$04$', '$20$'));
  action('Verify bcrypt hash');
  await wait(() => feedback() === 'Verifying…');
  await new Promise((resolve) => setTimeout(resolve, 200));
  await fill('#bcrypt-password', 'edited during high-cost verification');
  await wait(
    () =>
      feedback() === '' &&
      !button('Verify bcrypt hash', document.querySelector('form')).disabled,
  );
  await fill('#bcrypt-stored-hash', fixture);
  await fill('#bcrypt-password', password);
  action('Verify bcrypt hash');
  await wait(() => feedback() === 'Password matches.');
  button('Clear').click();
  await wait(
    () =>
      document.querySelector('#bcrypt-password').value === '' &&
      document.querySelector('#bcrypt-stored-hash').value === '',
  );
  await navigate('Generate bcrypt hash');
  assert(
    document.querySelector('#bcrypt-password').value === password &&
      document.querySelector('#bcrypt-cost').value === '4',
    'Navigation lost hash inputs',
  );
  button('Clear').click();
  await wait(
    () =>
      document.querySelector('#bcrypt-password').type === 'text' &&
      hashValue() === '',
  );
  assert(
    document.documentElement.scrollWidth <= innerWidth,
    'Bcrypt screen overflows',
  );
  return {
    defaultHash,
    hash,
    checks: [
      'Bcrypt costs 4–20, default 12, synchronized slider and contextual guidance',
      'Salted hashes, independent Python fixtures, exact Unicode and 72-byte limit',
      'High-cost cancellation/restart, stale-result prevention, navigation and visible password inputs',
    ],
  };
}
