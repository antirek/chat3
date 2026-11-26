import { AsyncLocalStorage } from 'node:async_hooks';

type OutboxFailHook = () => void;

const als = new AsyncLocalStorage<OutboxFailHook>();

export function runWithOutboxFailHook(hook: OutboxFailHook, fn: () => void): void {
  als.run(hook, fn);
}

export function notifyOutboxWriteFailed(): void {
  try {
    als.getStore()?.();
  } catch {
    // never break createEvent path
  }
}
