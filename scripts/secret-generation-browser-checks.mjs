// Shared DOM checks run in Chromium and stock Firefox/Zen without production hooks.
export async function secretGenerationUiChecks() {
  const wait = async (check) => {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      if (check()) return;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error(
      'Generator UI timed out: ' +
        document.querySelector('#generator-feedback')?.textContent,
    );
  };
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const button = (label, scope = document) =>
    [...scope.querySelectorAll('button')].find(
      (item) =>
        (item.getAttribute('aria-label') ?? item.textContent.trim()) === label,
    );
  const navigate = async (label) => {
    if (!document.querySelector('nav')?.getClientRects().length) {
      button('Toggle Sidebar').click();
      await wait(() => document.querySelector('nav')?.getClientRects().length);
    }
    assert(
      document.body.textContent.includes(
        'All tools run locally. Inputs and results stay in this workspace until it closes.',
      ),
      'Sidebar is missing the local-processing and workspace note',
    );
    button(label, document.querySelector('nav')).click();
    await wait(() => !document.querySelector('[role="dialog"]'));
    await wait(() => document.querySelector('h1')?.textContent === label);
  };
  const input = (value) => {
    const element = document.querySelector('#generator-length');
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    ).set.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const secret = (index = 0) =>
    document.querySelector(`#generated-secret-${index + 1}`);
  const values = () =>
    [...document.querySelectorAll('input[id^="generated-secret-"]')].map(
      (element) => element.value,
    );
  const status = () =>
    document.querySelector('#generator-feedback')?.textContent;
  const generate = async (label) => {
    const previous = secret().value;
    button(label, document.querySelector('section')).click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await wait(() => secret().value !== '' && secret().value !== previous);
    assert(
      values().length === 5 && values().every((value) => value !== ''),
      'Generator did not produce five results',
    );
    assert(
      [...document.querySelectorAll('input[id^="generated-secret-"]')].every(
        (element) => element.type === 'text',
      ),
      'Generated value is hidden',
    );
    assert(status() === '', 'Generator repeated the local-processing note');
    assert(
      !document
        .querySelector('section')
        .textContent.includes(
          'Generated on your device. Kept only in this workspace.',
        ),
      'Generator repeated the workspace note',
    );
    return secret().value;
  };
  const fits = () =>
    assert(
      document.documentElement.scrollWidth <= innerWidth,
      'Generator overflowed its workspace',
    );
  await navigate('Generate API key');
  await wait(
    () => values().length === 5 && values().every((value) => value !== ''),
  );
  assert(
    values().every((value) => /^[A-Za-z0-9_-]{43}$/.test(value)),
    'API key defaults were not generated automatically',
  );
  assert(
    document.querySelector('#generator-length').value === '32',
    'Incorrect API defaults',
  );
  const firstBatch = values();
  const first = secret().value;
  assert(/^[A-Za-z0-9_-]{43}$/.test(first), 'API key format/size incorrect');
  await navigate('Generate JWT signing key');
  await wait(
    () => values().length === 5 && values().every((value) => value !== ''),
  );
  assert(
    values().every((value) => atob(value).length === 32) &&
      !values().includes(first),
    'JWT defaults were not generated independently',
  );
  const jwt = await generate('Generate JWT signing key');
  assert(atob(jwt).length === 32, 'Incorrect default JWT signing key size');
  button('HS512').click();
  await wait(() => secret().value === '');
  button('Hex').click();
  await wait(() => button('Hex').getAttribute('data-state') === 'on');
  const hex = await generate('Generate JWT signing key');
  assert(/^[a-f0-9]{128}$/.test(hex), 'HS512/Hex selection was not applied');
  fits();
  button('Clear').click();
  await wait(() => secret().value === '');
  await navigate('Generate API key');
  assert(
    values().every((value, index) => value === firstBatch[index]) &&
      secret().type === 'text',
    'Navigation lost API state',
  );
  await navigate('Generate JWT signing key');
  assert(
    values().every((value) => value === ''),
    'Returning to a cleared generator refilled it',
  );
  await navigate('Generate API key');
  const second = await generate('Generate API key');
  assert(
    first !== second && secret().type === 'text',
    'Regeneration must replace the visible secret',
  );
  const before = values();
  button('Regenerate API key 3').click();
  await wait(() => secret(2).value !== before[2]);
  assert(
    values().every((value, index) => index === 2 || value === before[index]),
    'Single-row regeneration changed another result',
  );
  button('Copy API key 1').click();
  await wait(
    () =>
      button('Copy API key 1').textContent === 'COPIED' ||
      status()?.startsWith('Copy unavailable.'),
  );
  assert(
    button('Copy API key 2').textContent === 'COPY',
    'Copy feedback leaked to another row',
  );
  if (!status())
    await wait(() => button('Copy API key 1').textContent === 'COPY');
  input('15');
  await wait(() => secret().value === '');
  button('Generate API key', document.querySelector('section')).click();
  await wait(
    () => status() === 'Choose a whole number from 16 to 128 random bytes.',
  );
  assert(
    values().every((value) => value === ''),
    'Invalid byte count left old secrets',
  );
  input('64');
  await wait(() => document.querySelector('#generator-length').value === '64');
  button('Hex').click();
  await wait(() => button('Hex').getAttribute('data-state') === 'on');
  assert(
    /^[a-f0-9]{128}$/.test(await generate('Generate API key')),
    'API options were not applied',
  );
  button('Clear').click();
  await wait(() => secret().value === '');
  await navigate('Generate password');
  assert(
    document.querySelector('#generator-length').value === '20',
    'Incorrect password default length',
  );
  await generate('Generate password');
  assert(
    values().every(
      (password) =>
        password.length === 20 &&
        /[a-z]/.test(password) &&
        /[A-Z]/.test(password) &&
        /[0-9]/.test(password) &&
        /[^A-Za-z0-9]/.test(password),
    ),
    'Password missing selected types',
  );
  for (const type of ['lowercase', 'digits', 'symbols']) {
    document.querySelector(`#characters-${type}`).click();
    await wait(
      () =>
        document
          .querySelector(`#characters-${type}`)
          .getAttribute('data-state') === 'unchecked',
    );
  }
  input('16');
  await wait(() => document.querySelector('#generator-length').value === '16');
  assert(
    /^[A-Z]{16}$/.test(await generate('Generate password')),
    'Password option selection failed',
  );
  document.querySelector('#characters-uppercase').click();
  await wait(() => secret().value === '');
  button('Generate password', document.querySelector('section')).click();
  await wait(() => status() === 'Select at least one character type.');
  document.querySelector('#characters-digits').click();
  await wait(
    () =>
      document
        .querySelector('#characters-digits')
        .getAttribute('data-state') === 'checked',
  );
  await generate('Generate password');
  button('Clear').click();
  await wait(() => secret().value === '' && secret().type === 'text');
  fits();
  assert(
    values().every((value) => value === ''),
    'Clear retained generated results',
  );
  await generate('Generate password');
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
    button('Copy Generated password 2').click();
    await wait(
      () => button('Copy Generated password 2').textContent === 'COPIED',
    );
    assert(copiedValue === secret(1).value, 'Copy used the wrong row');
    assert(
      button('Copy Generated password 1').textContent === 'COPY',
      'Copy feedback affected another row',
    );
    fits();
    await wait(
      () => button('Copy Generated password 2').textContent === 'COPY',
    );

    let finish;
    write = () =>
      new Promise((resolve) => {
        finish = resolve;
      });
    button('Copy Generated password 2').click();
    const old = secret(1).value;
    button('Regenerate Generated password 2').click();
    await wait(() => secret(1).value !== old);
    finish();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert(
      button('Copy Generated password 2').textContent === 'COPY',
      'Stale copy marked a regenerated row as copied',
    );

    write = async () => {
      throw new Error('Clipboard denied');
    };
    button('Copy Generated password 3').click();
    await wait(() => status()?.startsWith('Copy unavailable.'));
    assert(
      button('Copy Generated password 3').textContent === 'COPY',
      'Failed copy claimed success',
    );

    write = async () => {};
    button('Copy Generated password 4').click();
    await wait(
      () => button('Copy Generated password 4').textContent === 'COPIED',
    );
    button('Clear').click();
    await wait(() => values().every((value) => value === ''));
    assert(
      button('Copy Generated password 4').textContent === 'COPY',
      'Clear retained copied feedback',
    );
    assert(
      button('Copy Generated password 4').disabled,
      'Empty result is copyable',
    );
  } finally {
    if (descriptor) Object.defineProperty(navigator, 'clipboard', descriptor);
    else delete navigator.clipboard;
  }
  assert(
    localStorage.length === 0 && sessionStorage.length === 0,
    'Generators persisted workspace data',
  );
  return {
    checks: [
      'Automatic first-open API/JWT/password generation, option changes and validation',
      'Five visible results, independent inline regeneration, timed copy feedback and clear',
      'Independent tool state, navigation, narrow layout and no workspace persistence',
    ],
  };
}
