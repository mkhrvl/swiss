import { useEffect, useRef, useState } from 'react';
import {
  BCRYPT_DEFAULT_COST,
  createBcryptEngine,
  type BcryptError,
} from '@swiss/core/bcrypt-passwords';
import { createBcryptWorker } from '../platform/bcrypt-worker';

const errors: Record<BcryptError['code'], string> = {
  'invalid-cost': 'Choose a whole-number bcrypt cost from 4 to 20.',
  'invalid-hash':
    'Enter a valid 60-character bcrypt hash ($2a$, $2b$ or $2y$).',
  'unsupported-cost': 'This tool supports verification costs from 4 to 20.',
  'password-too-long':
    'Bcrypt accepts at most 72 UTF-8 bytes. Shorten the password; it will not be truncated.',
  cancelled: 'Operation cancelled.',
  busy: 'A bcrypt operation is already running.',
};
type Operation = 'hash' | 'verify';

export function useBcryptPasswords() {
  const [hashPassword, setHashPassword] = useState('');
  const [cost, setCost] = useState(String(BCRYPT_DEFAULT_COST));
  const [generatedHash, setGeneratedHash] = useState('');
  const [hashMessage, setHashMessage] = useState('');
  const [verifyPassword, setVerifyPassword] = useState('');
  const [storedHash, setStoredHash] = useState('');
  const [verifyMessage, setVerifyMessage] = useState('');
  const [busy, setBusy] = useState<Operation>();
  const engine = useRef<ReturnType<typeof createBcryptEngine>>(undefined);
  const job = useRef<{ operation: Operation; controller: AbortController }>(
    undefined,
  );
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      job.current?.controller.abort();
      engine.current?.dispose();
    };
  }, []);

  function invalidate(operation: Operation) {
    if (job.current?.operation === operation) {
      job.current.controller.abort();
      job.current = undefined;
      setBusy(undefined);
    }
    if (operation === 'hash') {
      setGeneratedHash('');
      setHashMessage('');
    } else setVerifyMessage('');
  }
  async function execute(operation: Operation) {
    if (job.current) return;
    const message = operation === 'hash' ? setHashMessage : setVerifyMessage;
    if (operation === 'hash') setGeneratedHash('');
    const controller = new AbortController();
    job.current = { operation, controller };
    setBusy(operation);
    message(operation === 'hash' ? 'Hashing…' : 'Verifying…');
    try {
      engine.current ??= createBcryptEngine(createBcryptWorker);
      const result =
        operation === 'hash'
          ? await engine.current.hash(hashPassword, Number(cost), {
              signal: controller.signal,
            })
          : await engine.current.verify(storedHash.trim(), verifyPassword, {
              signal: controller.signal,
            });
      if (!alive.current || controller.signal.aborted) return;
      if (!result.ok) message(errors[result.error.code]);
      else if (typeof result.value === 'string') {
        setGeneratedHash(result.value);
        message('Hash generated.');
      } else if (result.value) message('Password matches.');
      else message('Password does not match.');
    } catch {
      if (alive.current && !controller.signal.aborted)
        message(
          'Bcrypt could not run. Secure hashing requires Web Crypto and worker support; try again.',
        );
    } finally {
      finishJob(controller);
    }
  }
  function finishJob(controller: AbortController) {
    if (job.current?.controller !== controller) return;
    job.current = undefined;
    if (alive.current) setBusy(undefined);
  }
  function changeHashPassword(value: string) {
    invalidate('hash');
    setHashPassword(value);
  }
  function changeCost(value: string) {
    invalidate('hash');
    setCost(value);
  }
  function changeVerifyPassword(value: string) {
    invalidate('verify');
    setVerifyPassword(value);
  }
  function changeStoredHash(value: string) {
    invalidate('verify');
    setStoredHash(value);
  }
  function cancel() {
    const operation = job.current?.operation;
    if (!operation) return;
    invalidate(operation);
    const message = operation === 'hash' ? setHashMessage : setVerifyMessage;
    message(
      operation === 'hash' ? 'Hashing cancelled.' : 'Verification cancelled.',
    );
  }
  return {
    hashPassword,
    cost,
    generatedHash,
    hashMessage,
    verifyPassword,
    storedHash,
    verifyMessage,
    changeHashPassword,
    changeCost,
    changeVerifyPassword,
    changeStoredHash,
    busy,
    cancel,
    generate: () => execute('hash'),
    verify: () => execute('verify'),
    clearHash() {
      changeHashPassword('');
    },
    clearVerify() {
      changeVerifyPassword('');
      changeStoredHash('');
    },
  };
}
