import { AsyncLocalStorage } from 'node:async_hooks';
import mongoose from 'mongoose';

export type UpdateWorkerOutcome = 'success' | 'error';
export type UpdateWorkerReason =
  | 'ok'
  | 'handler_error'
  | 'mongo_unavailable'
  | 'publish_updates_failed'
  | 'internal_error';

export type ProcessOutcome = { outcome: UpdateWorkerOutcome; reason: UpdateWorkerReason };

const outcomeAls = new AsyncLocalStorage<ProcessOutcome>();

export function createProcessOutcome(): ProcessOutcome {
  return { outcome: 'success', reason: 'ok' };
}

export function runWithProcessOutcome<T>(state: ProcessOutcome, fn: () => Promise<T>): Promise<T> {
  return outcomeAls.run(state, fn);
}

export function currentProcessOutcome(): ProcessOutcome | undefined {
  return outcomeAls.getStore();
}

const PRI: Record<UpdateWorkerReason, number> = {
  ok: 0,
  handler_error: 1,
  internal_error: 2,
  publish_updates_failed: 3,
  mongo_unavailable: 4
};

export function noteFailure(state: ProcessOutcome, reason: UpdateWorkerReason): void {
  if (PRI[reason] >= PRI[state.reason]) {
    state.outcome = 'error';
    state.reason = reason;
  }
}

/** Note failure on ALS-bound outcome if present. */
export function noteCurrentFailure(reason: UpdateWorkerReason): void {
  const state = currentProcessOutcome();
  if (state) noteFailure(state, reason);
}

export function isMongoUnavailableError(err: unknown): boolean {
  if (mongoose.connection.readyState !== 1) return true;
  const e = err as { name?: string; message?: string; code?: string | number } | null;
  const name = String(e?.name || '');
  const msg = String(e?.message || '').toLowerCase();
  if (
    [
      'MongoNetworkError',
      'MongoServerSelectionError',
      'MongoTimeoutError',
      'MongoExpiredSessionError',
      'MongooseServerSelectionError'
    ].includes(name)
  ) {
    return true;
  }
  if (e?.code === 'ECONNREFUSED' || e?.code === 'ETIMEDOUT') return true;
  return msg.includes('econnrefused') || msg.includes('server selection timed out');
}

export function classifyCaughtError(err: unknown): UpdateWorkerReason {
  if (isMongoUnavailableError(err)) return 'mongo_unavailable';
  const msg = err instanceof Error ? err.message : String(err);
  if (/publish update/i.test(msg) || /rabbitmq/i.test(msg)) return 'publish_updates_failed';
  return 'internal_error';
}
