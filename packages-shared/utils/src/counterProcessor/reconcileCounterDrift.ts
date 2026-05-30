import { MessageStatus, MessageStatusStats, UserDialogStats, UserDialogUnreadBySenderType, UserPackedMessagesUnreadBySenderType, UserStats } from '@chat3/models';
import { countUserDialogUnread } from './recalculateUserDialogUnread.js';
import { getPackedDialogIdsForUser } from '../packStatsUtils.js';

export interface CounterDriftRecord {
  tenantId: string;
  kind: 'userDialogUnread' | 'messageStatusStats' | 'userStatsTotalUnread' | 'userStatsPackedTotalUnread';
  userId?: string;
  dialogId?: string;
  messageId?: string;
  status?: string;
  field: string;
  stored: number;
  expected: number;
}

export interface ReconcileCounterDriftOptions {
  tenantId?: string;
  /** Макс. пар (userId, dialogId) для проверки UserDialogStats.unreadCount */
  maxUserDialogs?: number;
  /** Макс. messageId для проверки MessageStatusStats */
  maxMessages?: number;
  /** Макс. пользователей для проверки UserStats.totalUnreadCount */
  maxUsers?: number;
}

export interface ReconcileCounterDriftResult {
  checkedUserDialogs: number;
  checkedMessageStatus: number;
  checkedUserStats: number;
  driftCount: number;
  drifts: CounterDriftRecord[];
  ok: boolean;
}

const DEFAULT_MAX_USER_DIALOGS = 500;
const DEFAULT_MAX_MESSAGES = 100;
const DEFAULT_MAX_USERS = 200;

async function expectedMessageStatusCounts(
  tenantId: string,
  messageId: string
): Promise<Map<string, number>> {
  const agg = await MessageStatus.aggregate<{ _id: string; count: number }>([
    { $match: { tenantId, messageId } },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);
  const map = new Map<string, number>();
  for (const row of agg) {
    if (row._id) {
      map.set(row._id, row.count);
    }
  }
  return map;
}

/**
 * Сравнивает записанные счётчики с ожидаемыми значениями из Message + MessageStatus.
 * Не исправляет drift — только отчёт (для nightly / controlo / CI).
 */
export async function reconcileCounterDrift(
  options: ReconcileCounterDriftOptions = {}
): Promise<ReconcileCounterDriftResult> {
  const {
    tenantId,
    maxUserDialogs = DEFAULT_MAX_USER_DIALOGS,
    maxMessages = DEFAULT_MAX_MESSAGES,
    maxUsers = DEFAULT_MAX_USERS
  } = options;

  const drifts: CounterDriftRecord[] = [];
  let checkedUserDialogs = 0;
  let checkedMessageStatus = 0;
  let checkedUserStats = 0;

  const userDialogQuery = tenantId ? { tenantId } : {};
  const userDialogCursor = UserDialogStats.find(userDialogQuery)
    .select('tenantId userId dialogId unreadCount')
    .limit(maxUserDialogs)
    .lean()
    .cursor();

  for await (const row of userDialogCursor) {
    checkedUserDialogs++;
    const expected = await countUserDialogUnread(row.tenantId, row.userId, row.dialogId);
    const stored = row.unreadCount ?? 0;
    if (stored !== expected) {
      drifts.push({
        tenantId: row.tenantId,
        kind: 'userDialogUnread',
        userId: row.userId,
        dialogId: row.dialogId,
        field: 'unreadCount',
        stored,
        expected
      });
    }
  }

  const messageStatsQuery = tenantId ? { tenantId } : {};
  const messageIds = await MessageStatusStats.find(messageStatsQuery)
    .distinct('messageId')
    .then((ids: string[]) => ids.slice(0, maxMessages));

  for (const messageId of messageIds) {
    const sample = await MessageStatusStats.findOne({ messageId, ...(tenantId ? { tenantId } : {}) })
      .select('tenantId')
      .lean();
    if (!sample?.tenantId) continue;

    const tid = sample.tenantId;
    const expectedByStatus = await expectedMessageStatusCounts(tid, messageId);
    const storedRows = await MessageStatusStats.find({ tenantId: tid, messageId })
      .select('status count')
      .lean();

    checkedMessageStatus++;
    const seenStatuses = new Set<string>();
    for (const storedRow of storedRows) {
      seenStatuses.add(storedRow.status);
      const expected = expectedByStatus.get(storedRow.status) ?? 0;
      const stored = storedRow.count ?? 0;
      if (stored !== expected) {
        drifts.push({
          tenantId: tid,
          kind: 'messageStatusStats',
          messageId,
          status: storedRow.status,
          field: 'count',
          stored,
          expected
        });
      }
    }

    for (const [status, expected] of expectedByStatus) {
      if (!seenStatuses.has(status) && expected > 0) {
        drifts.push({
          tenantId: tid,
          kind: 'messageStatusStats',
          messageId,
          status,
          field: 'count',
          stored: 0,
          expected
        });
      }
    }
  }

  const userStatsQuery = tenantId ? { tenantId } : {};
  const userStatsCursor = UserStats.find(userStatsQuery)
    .select('tenantId userId totalUnreadCount')
    .limit(maxUsers)
    .lean()
    .cursor();

  for await (const userRow of userStatsCursor) {
    checkedUserStats++;
    const agg = await UserDialogStats.aggregate<{ total: number }>([
      { $match: { tenantId: userRow.tenantId, userId: userRow.userId } },
      { $group: { _id: null, total: { $sum: '$unreadCount' } } }
    ]);
    const expected = agg[0]?.total ?? 0;
    const stored = userRow.totalUnreadCount ?? 0;
    if (stored !== expected) {
      drifts.push({
        tenantId: userRow.tenantId,
        kind: 'userStatsTotalUnread',
        userId: userRow.userId,
        field: 'totalUnreadCount',
        stored,
        expected
      });
    }

    const packedDialogIds = await getPackedDialogIdsForUser(userRow.tenantId, userRow.userId);
    let expectedPackedTotal = 0;
    if (packedDialogIds.length) {
      const packedAgg = await UserDialogUnreadBySenderType.aggregate<{ total: number }>([
        { $match: { tenantId: userRow.tenantId, userId: userRow.userId, dialogId: { $in: packedDialogIds } } },
        { $group: { _id: null, total: { $sum: '$countUnread' } } }
      ]);
      expectedPackedTotal = packedAgg[0]?.total ?? 0;
    }
    const packedRows = await UserPackedMessagesUnreadBySenderType.find({
      tenantId: userRow.tenantId,
      userId: userRow.userId
    }).select('countUnread').lean();
    const storedPackedTotal = packedRows.reduce((s, r) => s + (r.countUnread ?? 0), 0);
    if (storedPackedTotal !== expectedPackedTotal) {
      drifts.push({
        tenantId: userRow.tenantId,
        kind: 'userStatsPackedTotalUnread',
        userId: userRow.userId,
        field: 'packs.messages.totalUnreadCount',
        stored: storedPackedTotal,
        expected: expectedPackedTotal
      });
    }
  }

  return {
    checkedUserDialogs,
    checkedMessageStatus,
    checkedUserStats,
    driftCount: drifts.length,
    drifts,
    ok: drifts.length === 0
  };
}
