import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBcryptEngine } from './engine';
import type { BcryptResponse } from './contracts';

class TestWorker {
  onmessage: ((event: { data: BcryptResponse }) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  respond(data: BcryptResponse) {
    this.onmessage?.({ data });
  }
}
function workspace() {
  const workers: TestWorker[] = [];
  const factory = vi.fn(() => {
    const worker = new TestWorker();
    workers.push(worker);
    return worker as unknown as Worker;
  });
  return { engine: createBcryptEngine(factory), workers, factory };
}
afterEach(() => vi.restoreAllMocks());

describe('bcrypt worker lifetime', () => {
  it('rejects invalid, oversized and already-cancelled input before starting a worker', async () => {
    const { engine, factory } = workspace();
    expect(await engine.hash('password', 3)).toEqual({
      ok: false,
      error: { code: 'invalid-cost' },
    });
    expect(await engine.hash('🔐'.repeat(19), 12)).toEqual({
      ok: false,
      error: { code: 'password-too-long' },
    });
    expect(await engine.verify('malformed', 'password')).toEqual({
      ok: false,
      error: { code: 'invalid-hash' },
    });
    expect(
      await engine.hash('password', 12, { signal: AbortSignal.abort() }),
    ).toEqual({ ok: false, error: { code: 'cancelled' } });
    expect(factory).not.toHaveBeenCalled();
  });
  it('bounds concurrency and passes exact inputs to the worker', async () => {
    const { engine, workers } = workspace();
    const first = engine.hash('  café 🔐  ', 20);
    expect(workers[0]!.postMessage).toHaveBeenCalledWith({
      operation: 'hash',
      password: '  café 🔐  ',
      cost: 20,
    });
    expect(await engine.hash('password', 4)).toEqual({
      ok: false,
      error: { code: 'busy' },
    });
    engine.dispose();
    expect(await first).toEqual({ ok: false, error: { code: 'cancelled' } });
    expect(workers[0]!.terminate).toHaveBeenCalledOnce();
  });
  it('terminates high-cost work immediately and restarts after cancellation', async () => {
    const { engine, workers } = workspace();
    const controller = new AbortController();
    const first = engine.hash('test', 20, { signal: controller.signal });
    controller.abort();
    expect(await first).toEqual({ ok: false, error: { code: 'cancelled' } });
    expect(workers[0]!.terminate).toHaveBeenCalledOnce();
    const next = engine.hash('test', 4);
    expect(workers).toHaveLength(2);
    workers[0]!.respond({
      kind: 'result',
      result: { ok: true, value: 'stale' },
    });
    workers[1]!.respond({
      kind: 'result',
      result: { ok: true, value: 'fresh' },
    });
    expect(await next).toEqual({ ok: true, value: 'fresh' });
    engine.dispose();
  });
  it('reuses the worker for completed work and returns validation errors', async () => {
    const { engine, workers } = workspace();
    const first = engine.hash('test', 4);
    workers[0]!.respond({
      kind: 'result',
      result: { ok: true, value: 'hash' },
    });
    await first;
    const second = engine.hash('test', 4);
    expect(workers).toHaveLength(1);
    workers[0]!.respond({
      kind: 'result',
      result: { ok: false, error: { code: 'password-too-long' } },
    });
    expect(await second).toEqual({
      ok: false,
      error: { code: 'password-too-long' },
    });
    engine.dispose();
  });
  it('recovers from worker load/message failures', async () => {
    const { engine, workers } = workspace();
    const first = engine.hash('test', 4);
    const failed = expect(first).rejects.toThrow('Bcrypt worker failed');
    workers[0]!.onerror?.();
    await failed;
    expect(workers[0]!.terminate).toHaveBeenCalledOnce();
    const second = engine.hash('test', 4);
    workers[1]!.respond({
      kind: 'result',
      result: { ok: true, value: 'fresh' },
    });
    expect(await second).toEqual({ ok: true, value: 'fresh' });
    engine.dispose();
  });
});
