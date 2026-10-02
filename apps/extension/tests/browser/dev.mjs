import { createServer } from 'wxt';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

// Disable the interactive runner; the existing BiDi harness owns its profile.
const server = await createServer({
  root: resolve('apps/extension'),
  browser: 'firefox',
  webExt: { disabled: true },
});
try {
  await server.start();
  const child = spawn(
    process.execPath,
    [
      'apps/extension/tests/browser/gecko.mjs',
      process.argv[2] ?? 'firefox',
      'extension',
    ],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        SWISS_EXTENSION_DIR: resolve('apps/extension/.output/firefox-mv2-dev'),
      },
    },
  );
  const code = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', resolve);
  });
  if (code !== 0) process.exitCode = 1;
} finally {
  await server.stop();
}
