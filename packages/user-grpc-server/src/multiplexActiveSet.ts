/**
 * Pure active-set + refcount for multiplexed WatchUpdates.
 * AMQP bind/unbind is applied by the caller based on returned ops.
 */
import { userUpdatesBindKey } from './updateRoutingKeys.js';

export type WatchKey = string;

export type ActiveEntry = {
  tenantId: string;
  userType: string;
  userId: string;
  bindKey: string;
  refCount: number;
};

export type MultiplexLimits = {
  maxWatchedKeys: number;
  maxUserIdsPerMessage: number;
};

export const DEFAULT_MULTIPLEX_LIMITS: MultiplexLimits = {
  maxWatchedKeys: 500,
  maxUserIdsPerMessage: 100
};

export function makeWatchKey(tenantId: string, userType: string, userId: string): WatchKey {
  return `${tenantId}\0${userType}\0${userId}`;
}

export function parseWatchKey(key: WatchKey): {
  tenantId: string;
  userType: string;
  userId: string;
} {
  const [tenantId, userType, userId] = key.split('\0');
  return { tenantId, userType, userId };
}

export type WatchBatchResult =
  | {
      ok: true;
      userIds: string[];
      bindKeys: string[];
      watchedCount: number;
    }
  | {
      ok: false;
      error: string;
      watchedCount: number;
    };

/**
 * In-memory multiplex set. Not concurrency-safe — serialize externally.
 */
export class MultiplexActiveSet {
  private active = new Map<WatchKey, ActiveEntry>();

  constructor(private readonly limits: MultiplexLimits = DEFAULT_MULTIPLEX_LIMITS) {}

  get size(): number {
    return this.active.size;
  }

  has(tenantId: string, userType: string, userId: string): boolean {
    return this.active.has(makeWatchKey(tenantId, userType, userId));
  }

  /** Accept update if (tenant,user) is watched (any userType match for that pair). */
  acceptsUpdate(tenantId: string, userId: string, userType?: string): boolean {
    const t = String(tenantId || '').trim();
    const u = String(userId || '').trim();
    if (!t || !u) return true; // control frames / incomplete — let handler decide
    if (userType) {
      return this.active.has(makeWatchKey(t, userType, u));
    }
    for (const entry of this.active.values()) {
      if (entry.tenantId === t && entry.userId === u) return true;
    }
    return false;
  }

  watch(tenantId: string, userIds: string[], userType?: string): WatchBatchResult {
    const t = String(tenantId || '').trim();
    if (!t) {
      return { ok: false, error: 'tenant_id is required', watchedCount: this.size };
    }

    const type = String(userType || 'user').trim() || 'user';
    const ids = dedupeUserIds(userIds);

    if (ids.length === 0) {
      return { ok: false, error: 'user_ids must be non-empty', watchedCount: this.size };
    }
    if (ids.length > this.limits.maxUserIdsPerMessage) {
      return {
        ok: false,
        error: `user_ids exceeds max ${this.limits.maxUserIdsPerMessage} per message`,
        watchedCount: this.size
      };
    }

    // Atomic: count how many NEW keys this batch would add
    let newKeys = 0;
    for (const userId of ids) {
      if (!this.active.has(makeWatchKey(t, type, userId))) newKeys += 1;
    }
    if (this.size + newKeys > this.limits.maxWatchedKeys) {
      return {
        ok: false,
        error: `watched keys would exceed max ${this.limits.maxWatchedKeys}`,
        watchedCount: this.size
      };
    }

    const bindKeys: string[] = [];
    for (const userId of ids) {
      const key = makeWatchKey(t, type, userId);
      const existing = this.active.get(key);
      if (existing) {
        existing.refCount += 1;
      } else {
        const bindKey = userUpdatesBindKey(t, type, userId);
        this.active.set(key, {
          tenantId: t,
          userType: type,
          userId,
          bindKey,
          refCount: 1
        });
        bindKeys.push(bindKey);
      }
    }

    return { ok: true, userIds: ids, bindKeys, watchedCount: this.size };
  }

  unwatch(tenantId: string, userIds: string[], userType?: string): WatchBatchResult {
    const t = String(tenantId || '').trim();
    if (!t) {
      return { ok: false, error: 'tenant_id is required', watchedCount: this.size };
    }

    const type = String(userType || 'user').trim() || 'user';
    const ids = dedupeUserIds(userIds);

    if (ids.length === 0) {
      return { ok: false, error: 'user_ids must be non-empty', watchedCount: this.size };
    }
    if (ids.length > this.limits.maxUserIdsPerMessage) {
      return {
        ok: false,
        error: `user_ids exceeds max ${this.limits.maxUserIdsPerMessage} per message`,
        watchedCount: this.size
      };
    }

    const unbindKeys: string[] = [];
    for (const userId of ids) {
      const key = makeWatchKey(t, type, userId);
      const existing = this.active.get(key);
      if (!existing) continue;
      existing.refCount -= 1;
      if (existing.refCount <= 0) {
        unbindKeys.push(existing.bindKey);
        this.active.delete(key);
      }
    }

    return { ok: true, userIds: ids, bindKeys: unbindKeys, watchedCount: this.size };
  }

  keys(): WatchKey[] {
    return Array.from(this.active.keys());
  }
}

function dedupeUserIds(userIds: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of userIds || []) {
    const id = String(raw || '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}
