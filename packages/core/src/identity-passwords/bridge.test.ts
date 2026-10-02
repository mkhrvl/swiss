import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createIdentityEngine } from './index';
import type { IdentityResponse } from './contracts';

class TestWorker {
  static instances: TestWorker[] = [];
  onmessage: ((event: { data: IdentityResponse }) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() {
    TestWorker.instances.push(this);
  }
  respond(data: IdentityResponse) {
    this.onmessage?.({ data });
  }
}

beforeEach(() => {
  TestWorker.instances = [];
  vi.stubGlobal('Worker', TestWorker);
});
afterEach(() => vi.unstubAllGlobals());

describe('Identity bridge boundaries', () => {
  it('does not start a worker for an already cancelled request', async () => {
    const engine = createIdentityEngine('unused');
    expect(
      await engine.hash('password', { signal: AbortSignal.abort() }),
    ).toEqual({
      ok: false,
      error: { code: 'cancelled' },
    });
  });
  it('keeps input exact and waits for runtime readiness', async () => {
    const engine = createIdentityEngine('local-worker');
    const result = engine.hash('  café 🔐  ');
    const worker = TestWorker.instances[0]!;
    expect(worker.postMessage).not.toHaveBeenCalled();
    worker.respond({ kind: 'ready' });
    expect(worker.postMessage).toHaveBeenCalledWith({
      operation: 'hash',
      password: '  café 🔐  ',
    });
    worker.respond({ kind: 'result', value: 'synthetic salted hash' });
    expect(await result).toEqual({ ok: true, value: 'synthetic salted hash' });
    engine.dispose();
  });
  it('bounds concurrency without starting a second worker', async () => {
    const engine = createIdentityEngine('local-worker');
    const first = engine.hash('password');
    expect(await engine.verify('hash', 'password')).toEqual({
      ok: false,
      error: { code: 'busy' },
    });
    expect(TestWorker.instances).toHaveLength(1);
    engine.dispose();
    expect(await first).toEqual({ ok: false, error: { code: 'cancelled' } });
  });
  it('terminates active work and creates a fresh runtime after cancellation', async () => {
    const engine = createIdentityEngine('local-worker');
    const controller = new AbortController();
    const first = engine.hash('password', { signal: controller.signal });
    const worker = TestWorker.instances[0]!;
    worker.respond({ kind: 'ready' });
    controller.abort();
    expect(await first).toEqual({ ok: false, error: { code: 'cancelled' } });
    expect(worker.terminate).toHaveBeenCalledOnce();
    const second = engine.verify('hash', 'password');
    const fresh = TestWorker.instances[1]!;
    expect(fresh.postMessage).not.toHaveBeenCalled();
    fresh.respond({ kind: 'ready' });
    fresh.respond({ kind: 'result', value: 'Success' });
    expect(await second).toEqual({ ok: true, value: 'match' });
    engine.dispose();
  });
  it('recovers after runtime initialization fails', async () => {
    const engine = createIdentityEngine('local-worker');
    const first = engine.hash('password');
    const failure = expect(first).rejects.toThrow('Identity runtime failed');
    TestWorker.instances[0]!.respond({ kind: 'failure' });
    await failure;
    expect(TestWorker.instances[0]!.terminate).toHaveBeenCalledOnce();
    const second = engine.hash('password');
    const fresh = TestWorker.instances[1]!;
    fresh.respond({ kind: 'ready' });
    fresh.respond({ kind: 'result', value: 'synthetic hash' });
    expect(await second).toEqual({ ok: true, value: 'synthetic hash' });
    engine.dispose();
  });
  it('reuses a ready runtime without requiring another handshake', async () => {
    const engine = createIdentityEngine('local-worker');
    const first = engine.hash('password');
    const worker = TestWorker.instances[0]!;
    worker.respond({ kind: 'ready' });
    worker.respond({ kind: 'result', value: 'hash' });
    await first;
    const second = engine.verify('hash', 'password');
    expect(TestWorker.instances).toHaveLength(1);
    expect(worker.postMessage).toHaveBeenLastCalledWith({
      operation: 'verify',
      hash: 'hash',
      password: 'password',
    });
    worker.respond({ kind: 'result', value: 'SuccessRehashNeeded' });
    expect(await second).toEqual({ ok: true, value: 'match-rehash-needed' });
    engine.dispose();
  });
});
