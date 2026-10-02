import { spawnSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { readdir, readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { IDENTITY_ASSETS } from '../packages/core/src/identity-passwords/assets.ts';

const feature = 'packages/core/src/identity-passwords';
const publish = resolve('artifacts/identity-publish');
// Publish into an empty output so old fingerprinted assemblies cannot accumulate.
await rm(publish, { recursive: true, force: true });
// Use the developer's installed SDK; this local build runs with their privileges.
const result = spawnSync(
  'dotnet',
  [
    'publish',
    `${feature}/dotnet/Swiss.Identity.Browser/Swiss.Identity.Browser.csproj`,
    '-c',
    'Release',
    '-o',
    publish,
    '-p:TreatWarningsAsErrors=true',
  ],
  { stdio: 'inherit' },
);
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

const { version, directory } = IDENTITY_ASSETS;
const source = join(publish, 'wwwroot/_framework');
const files = new Map([['worker.js', await readFile(`${feature}/worker.mjs`)]]);
// Code-unit ordering keeps manifests identical across machine locales.
for (const name of (await readdir(source)).sort()) {
  // Runtime config references raw assets. Compressed alternatives are unnecessary.
  if (/\.(js|json|wasm|dat)$/.test(name))
    files.set(`_framework/${name}`, await readFile(join(source, name)));
}
const manifest = [...files].map(([path, bytes]) => ({
  path,
  bytes: bytes.length,
  sha256: createHash('sha256').update(bytes).digest('hex'),
}));
files.set(
  'assets.json',
  Buffer.from(JSON.stringify({ version, files: manifest })),
);
for (const host of ['pwa', 'extension']) {
  const identityRoot = resolve(`apps/${host}/public/identity`);
  await mkdir(identityRoot, { recursive: true });
  for (const entry of await readdir(identityRoot, { withFileTypes: true }))
    if (
      entry.isDirectory() &&
      entry.name.startsWith('identity-') &&
      entry.name !== version
    )
      await rm(join(identityRoot, entry.name), { recursive: true });
  const destination = resolve(`apps/${host}/public/${directory}`);
  await mkdir(join(destination, '_framework'), { recursive: true });
  for (const name of await readdir(join(destination, '_framework')))
    if (!files.has(`_framework/${name}`))
      await rm(join(destination, '_framework', name));
  for (const [name, bytes] of files) {
    const target = join(destination, name);
    const previous = await readFile(target).catch(() => undefined);
    // Repeated asset preparation must not reload an active development extension.
    if (!previous?.equals(bytes)) await writeFile(target, bytes);
  }
}
console.log(
  `Prepared bundled Identity runtime (${manifest.reduce((sum, file) => sum + file.bytes, 0).toLocaleString()} bytes).`,
);
