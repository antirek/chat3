/**
 * AMQP routing helpers for chat3_updates.
 * Publish format: update.{category}.{tenantId}.{userType}.{userId}.{segment}
 */

export type WatchScope =
  | { kind: 'user'; tenantId: string; userId: string; userType?: string }
  | { kind: 'tenants'; tenantIds: string[] }
  | { kind: 'all' };

/** Personal SubscribeUpdates bind. */
export function userUpdatesBindKey(
  tenantId: string,
  userType: string,
  userId: string
): string {
  return `update.*.${tenantId}.${userType}.${userId}.*`;
}

/** Firehose for one tenant. */
export function tenantUpdatesBindKey(tenantId: string): string {
  return `update.*.${tenantId}.*.*.*`;
}

/** Wildcard — all tenants / users. */
export function allUpdatesBindKey(): string {
  return 'update.*.*.*.*.*';
}

/**
 * Resolve bind keys for a watch scope.
 * - user: one personal key
 * - tenants: one key per tenantId (deduped, non-empty)
 * - all: single wildcard
 */
export function bindKeysForWatchScope(scope: WatchScope): string[] {
  if (scope.kind === 'user') {
    const tenantId = String(scope.tenantId || '').trim();
    const userId = String(scope.userId || '').trim();
    const userType = String(scope.userType || 'user').trim() || 'user';
    if (!tenantId || !userId) {
      throw new Error('tenantId and userId are required for user scope');
    }
    return [userUpdatesBindKey(tenantId, userType, userId)];
  }

  if (scope.kind === 'tenants') {
    const ids = Array.from(
      new Set(
        (scope.tenantIds || [])
          .map((id) => String(id || '').trim())
          .filter(Boolean)
      )
    );
    if (ids.length === 0) {
      throw new Error('tenantIds must be non-empty for tenants scope');
    }
    return ids.map(tenantUpdatesBindKey);
  }

  return [allUpdatesBindKey()];
}

/** Stable key for BFF refcount maps. */
export function watchScopeKey(scope: WatchScope): string {
  if (scope.kind === 'user') {
    return `user:${scope.tenantId}:${scope.userId}`;
  }
  if (scope.kind === 'tenants') {
    const ids = Array.from(
      new Set((scope.tenantIds || []).map((id) => String(id).trim()).filter(Boolean))
    ).sort();
    return `tenants:${ids.join(',')}`;
  }
  return 'all';
}
