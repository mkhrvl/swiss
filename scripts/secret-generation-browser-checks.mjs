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
      document.body.textContent.includes('All tools run locally.'),
      'Sidebar is missing the local-processing note',
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
    const previous = values();
    button(label, document.querySelector('section')).click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await wait(() =>
      values().every(
        (value, index) => value !== '' && value !== previous[index],
      ),
    );
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
  const changeAndWait = async (change, matches) => {
    const previous = values();
    change();
    await wait(
      () =>
        values().length === 5 &&
        values().every(
          (value, index) => value !== previous[index] && matches(value),
        ),
    );
    assert(status() === '', 'Valid option change left an error');
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
  await changeAndWait(
    () => button('HS512').click(),
    (value) => value !== '' && atob(value).length === 64,
  );
  await changeAndWait(
    () => button('Hex').click(),
    (value) => /^[a-f0-9]{128}$/.test(value),
  );
  const jwtBatch = values();
  fits();
  await navigate('Generate API key');
  assert(
    values().every((value, index) => value === firstBatch[index]) &&
      secret().type === 'text',
    'Navigation lost API state',
  );
  await navigate('Generate JWT signing key');
  assert(
    values().every((value, index) => value === jwtBatch[index]),
    'Returning to JWT changed its current results',
  );
  await navigate('Generate API key');
  const second = await generate('Generate API key');
  assert(
    first !== second && secret().type === 'text',
    'Regeneration must replace the visible secret',
  );
  const byteInput = document.querySelector('#generator-length');
  assert(
    byteInput.getAttribute('role') === 'combobox',
    'Byte presets are not an editable combobox',
  );
  button('Show presets').click();
  await wait(() => document.querySelectorAll('[role="option"]').length === 8);
  const presets = [...document.querySelectorAll('[role="option"]')];
  assert(
    presets.every(
      (item, index) => item.textContent.trim() === `${(index + 1) * 16} bytes`,
    ),
    'Byte presets are not multiples of 16 from 16 to 128',
  );
  fits();
  await changeAndWait(
    () => presets[2].click(),
    (value) => /^[A-Za-z0-9_-]{64}$/.test(value),
  );
  assert(
    byteInput.value === '48',
    'Selecting a preset did not update the byte input',
  );
  await changeAndWait(
    () => input('35'),
    (value) => /^[A-Za-z0-9_-]{47}$/.test(value),
  );
  byteInput.focus();
  button('Generate API key', document.querySelector('section')).focus();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert(byteInput.value === '35', 'Blur discarded a custom byte count');
  await navigate('Generate JWT signing key');
  await navigate('Generate API key');
  assert(
    document.querySelector('#generator-length').value === '35',
    'Navigation discarded a custom byte count',
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
  await wait(
    () => status() === 'Choose a whole number from 16 to 128 random bytes.',
  );
  assert(
    values().every((value) => value === ''),
    'Invalid byte count left old secrets',
  );
  await changeAndWait(
    () => input('64'),
    (value) => /^[A-Za-z0-9_-]{86}$/.test(value),
  );
  await changeAndWait(
    () => button('Hex').click(),
    (value) => /^[a-f0-9]{128}$/.test(value),
  );
  await navigate('Generate password');
  assert(
    document.querySelector('#generator-length').value === '20',
    'Incorrect password default length',
  );
  await wait(
    () => values().length === 5 && values().every((value) => value !== ''),
  );
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
  const slider = document.querySelector('[role="slider"]');
  assert(
    slider?.getAttribute('aria-labelledby') === 'password-length-label' &&
      slider.getAttribute('aria-valuenow') === '20',
    'Password slider is missing its label or default value',
  );
  const sliderKey = (key) => {
    slider.focus();
    slider.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  };
  for (const [key, length] of [
    ['ArrowRight', 21],
    ['Home', 8],
    ['End', 128],
  ]) {
    await changeAndWait(
      () => sliderKey(key),
      (value) => value.length === length,
    );
    assert(
      document.querySelector('#generator-length').value === String(length) &&
        slider.getAttribute('aria-valuenow') === String(length),
      'Slider and numeric length input are out of sync',
    );
  }
  await changeAndWait(
    () => input('20'),
    (value) => value.length === 20,
  );
  assert(
    slider.getAttribute('aria-valuenow') === '20',
    'Numeric length did not update the slider',
  );
  for (const type of ['lowercase', 'digits', 'symbols']) {
    const removedTypes = {
      lowercase: /[a-z]/,
      digits: /[0-9]/,
      symbols: /[^A-Za-z0-9]/,
    };
    await changeAndWait(
      () => document.querySelector(`#characters-${type}`).click(),
      (value) => value.length === 20 && !removedTypes[type].test(value),
    );
  }
  await changeAndWait(
    () => input('16'),
    (value) => /^[A-Z]{16}$/.test(value),
  );
  document.querySelector('#characters-uppercase').click();
  await wait(() => secret().value === '');
  await wait(() => status() === 'Select at least one character type.');
  await changeAndWait(
    () => document.querySelector('#characters-digits').click(),
    (value) => /^[0-9]{16}$/.test(value),
  );
  fits();
  assert(
    !button('Clear', document.querySelector('section')),
    'Generator still has a Clear button',
  );
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
    await changeAndWait(
      () => input('17'),
      (value) => /^[0-9]{17}$/.test(value),
    );
    assert(
      button('Copy Generated password 4').textContent === 'COPY',
      'Option change retained copied feedback',
    );
    write = () =>
      new Promise((resolve) => {
        finish = resolve;
      });
    button('Copy Generated password 1').click();
    await changeAndWait(
      () => input('18'),
      (value) => /^[0-9]{18}$/.test(value),
    );
    finish();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert(
      button('Copy Generated password 1').textContent === 'COPY',
      'Stale copy marked new options as copied',
    );
    await changeAndWait(
      () => input('19'),
      (value) => /^[0-9]{19}$/.test(value),
    );
    await changeAndWait(
      () => input('20'),
      (value) => /^[0-9]{20}$/.test(value),
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
      'Automatic first-open generation and regeneration on every option change',
      'Five visible results, full/inline regeneration, validation and timed copy feedback',
      'Independent tool state, navigation, narrow layout and no workspace persistence',
      'Eight byte presets, custom byte counts and accessible synchronized password slider',
    ],
  };
}
