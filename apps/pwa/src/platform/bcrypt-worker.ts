export function createBcryptWorker() {
  return new Worker(
    new URL(
      '../../../../packages/core/src/bcrypt-passwords/worker-entry.ts',
      import.meta.url,
    ),
    { type: 'module' },
  );
}
