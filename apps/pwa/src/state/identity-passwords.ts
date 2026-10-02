import { useEffect, useRef, useState } from 'react';
import {
  createIdentityEngine,
  type IdentityError,
  type VerificationOutcome,
} from '@swiss/core/identity-passwords';
import {
  identityWorkerUrl,
  initializeIdentityAssets,
} from '../platform/identity-assets';

const errors: Record<IdentityError['code'], string> = {
  'invalid-hash': 'Enter a valid ASP.NET Identity password hash.',
  'unsupported-hash':
    'Unsupported hash format or parameters. This tool supports Identity V2/V3 with up to 1,000,000 iterations and 64-byte subkeys.',
  cancelled: 'Verification cancelled.',
  busy: 'Identity is already working. Try again when it finishes.',
};
const outcomes: Record<VerificationOutcome, string> = {
  match: 'Password matches.',
  'match-rehash-needed':
    'Password matches. Identity recommends generating an updated hash.',
  mismatch: 'Password does not match.',
};

export function useIdentityPasswords() {
  const [hashPassword, setHashPassword] = useState('');
  const [generatedHash, setGeneratedHash] = useState('');
  const [hashMessage, setHashMessage] = useState('');
  const [hashBusy, setHashBusy] = useState(false);
  const [showHashPassword, setShowHashPassword] = useState(false);
  const [verifyPassword, setVerifyPassword] = useState('');
  const [storedHash, setStoredHash] = useState('');
  const [verifyMessage, setVerifyMessage] = useState('');
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [showVerifyPassword, setShowVerifyPassword] = useState(false);
  const [paused, setPaused] = useState(false);
  const assetsReady = useRef(false);
  const engine = useRef<ReturnType<typeof createIdentityEngine>>(undefined);
  const hashing = useRef<AbortController>(undefined);
  const verifying = useRef<AbortController>(undefined);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      hashing.current?.abort();
      verifying.current?.abort();
      engine.current?.dispose();
    };
  }, []);

  useEffect(() => {
    setVerifyBusy(false);
    if (paused) return;
    if (!verifyPassword || !storedHash.trim()) {
      setVerifyMessage(
        verifyPassword || storedHash ? 'Enter both a password and a hash.' : '',
      );
      return;
    }
    if (hashBusy) {
      setVerifyMessage('Verification will resume after hashing.');
      return;
    }
    const controller = new AbortController();
    verifying.current = controller;
    setVerifyMessage('Verifying…');
    setVerifyBusy(true);
    const timer = setTimeout(() => {
      void (async () => {
        try {
          await initialize(controller.signal, (value) => {
            if (alive.current && !controller.signal.aborted)
              setVerifyMessage(value);
          });
          controller.signal.throwIfAborted();
          engine.current ??= createIdentityEngine(identityWorkerUrl);
          setVerifyMessage('Verifying…');
          const result = await engine.current.verify(
            storedHash,
            verifyPassword,
            { signal: controller.signal },
          );
          if (alive.current && !controller.signal.aborted)
            setVerifyMessage(
              result.ok ? outcomes[result.value] : errors[result.error.code],
            );
        } catch {
          if (alive.current && !controller.signal.aborted) {
            resetEngine();
            setVerifyMessage(
              'Identity could not start. Check your connection and available storage, then edit an input to retry.',
            );
          }
        } finally {
          if (verifying.current === controller) {
            verifying.current = undefined;
            if (alive.current) setVerifyBusy(false);
          }
        }
      })();
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
      if (verifying.current === controller) verifying.current = undefined;
    };
  }, [verifyPassword, storedHash, hashBusy, paused]);

  async function initialize(
    signal: AbortSignal,
    progress: (value: string) => void,
  ) {
    signal.throwIfAborted();
    if (!assetsReady.current) {
      await initializeIdentityAssets(signal, progress);
      signal.throwIfAborted();
      assetsReady.current = true;
    }
  }
  function resetEngine() {
    assetsReady.current = false;
    engine.current?.dispose();
    engine.current = undefined;
  }
  async function generate() {
    if (hashing.current) return;
    setGeneratedHash('');
    if (!hashPassword) {
      setHashMessage('Enter a password to hash.');
      return;
    }
    verifying.current?.abort();
    const controller = new AbortController();
    hashing.current = controller;
    setHashBusy(true);
    setHashMessage('Hashing…');
    try {
      await initialize(controller.signal, (value) => {
        if (alive.current && !controller.signal.aborted) setHashMessage(value);
      });
      controller.signal.throwIfAborted();
      engine.current ??= createIdentityEngine(identityWorkerUrl);
      setHashMessage('Hashing…');
      const result = await engine.current.hash(hashPassword, {
        signal: controller.signal,
      });
      if (alive.current && !controller.signal.aborted) {
        if (result.ok) {
          setGeneratedHash(result.value);
          setHashMessage('Hash generated.');
        } else setHashMessage(errors[result.error.code]);
      }
    } catch {
      if (alive.current && !controller.signal.aborted) {
        resetEngine();
        setHashMessage(
          'Identity could not start. Check your connection and available storage, then try hashing again.',
        );
      }
    } finally {
      if (hashing.current === controller) {
        hashing.current = undefined;
        if (alive.current) setHashBusy(false);
      }
    }
  }
  function changeHashPassword(value: string) {
    hashing.current?.abort();
    setHashPassword(value);
    setGeneratedHash('');
    setHashMessage('');
  }
  function changeVerifyPassword(value: string) {
    verifying.current?.abort();
    setVerifyPassword(value);
    setVerifyMessage('');
    setPaused(false);
  }
  function changeStoredHash(value: string) {
    verifying.current?.abort();
    setStoredHash(value);
    setVerifyMessage('');
    setPaused(false);
  }
  return {
    hashPassword,
    changeHashPassword,
    generatedHash,
    hashMessage,
    hashBusy,
    showHashPassword,
    setShowHashPassword,
    generate,
    verifyPassword,
    changeVerifyPassword,
    storedHash,
    changeStoredHash,
    verifyMessage,
    verifyBusy,
    showVerifyPassword,
    setShowVerifyPassword,
    cancelHash: () => {
      hashing.current?.abort();
      setHashMessage('Hashing cancelled.');
    },
    cancelVerify: () => {
      verifying.current?.abort();
      setPaused(true);
      setVerifyBusy(false);
      setVerifyMessage('Verification cancelled.');
    },
    clearHash: () => {
      changeHashPassword('');
      setShowHashPassword(false);
    },
    clearVerify: () => {
      changeVerifyPassword('');
      changeStoredHash('');
      setShowVerifyPassword(false);
    },
  };
}
