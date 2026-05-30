import { Message, UserDialogStats, UserDialogUnreadBySenderType } from '@chat3/models';
import type { PipelineStage } from 'mongoose';
import { generateTimestamp } from '../timestampUtils.js';
import { getUserType } from '../userTypeUtils.js';
import { PACK_UNREAD_SENDER_TYPES, normalizeSenderType } from '../packUnreadSenderTypes.js';
import { messageReadLookupPipeline, unreadMessageMatchExtras } from './isUnreadForUser.js';

/**
 * Ожидаемый unread для пары (userId, dialogId) без записи в БД (A12).
 */
export async function countUserDialogUnread(
  tenantId: string,
  userId: string,
  dialogId: string
): Promise<number> {
  const uid = (userId || '').trim().toLowerCase();

  const unreadCountPipeline: PipelineStage[] = [
    {
      $match: {
        tenantId,
        dialogId,
        ...unreadMessageMatchExtras(uid)
      }
    },
    ...(messageReadLookupPipeline(tenantId, uid) as unknown as PipelineStage[]),
    { $count: 'unreadCount' }
  ];
  const unreadCountResult = await Message.aggregate(unreadCountPipeline) as Array<{ unreadCount: number }>;

  const unreadCount = unreadCountResult[0]?.unreadCount ?? 0;
  return unreadCount;
}

/**
 * Пересчёт unread для одной пары (userId, dialogId) из Message + MessageStatus (A12).
 */
export async function recalculateUserDialogUnread(
  tenantId: string,
  userId: string,
  dialogId: string
): Promise<number> {
  const uid = (userId || '').trim().toLowerCase();
  const unreadCount = await countUserDialogUnread(tenantId, uid, dialogId);

  const now = generateTimestamp();
  await UserDialogStats.findOneAndUpdate(
    { tenantId, userId: uid, dialogId },
    {
      $set: { unreadCount, lastUpdatedAt: now },
      $setOnInsert: { createdAt: now }
    },
    { upsert: true, setDefaultsOnInsert: true }
  );

  const bySenderPipeline: PipelineStage[] = [
    {
      $match: {
        tenantId,
        dialogId,
        ...unreadMessageMatchExtras(uid)
      }
    },
    ...(messageReadLookupPipeline(tenantId, uid) as unknown as PipelineStage[]),
    { $group: { _id: '$senderId', count: { $sum: 1 } } }
  ];
  const unreadBySenderAgg = await Message.aggregate(bySenderPipeline) as Array<{ _id: string; count: number }>;

  const byType: Record<string, number> = {};
  for (const t of PACK_UNREAD_SENDER_TYPES) {
    byType[t] = 0;
  }
  for (const row of unreadBySenderAgg) {
    const fromType = normalizeSenderType(await getUserType(tenantId, row._id));
    byType[fromType] = (byType[fromType] ?? 0) + row.count;
  }

  for (const fromType of PACK_UNREAD_SENDER_TYPES) {
    await UserDialogUnreadBySenderType.findOneAndUpdate(
      { tenantId, userId: uid, dialogId, fromType },
      {
        $set: { countUnread: byType[fromType] ?? 0, lastUpdatedAt: now },
        $setOnInsert: { createdAt: now }
      },
      { upsert: true, setDefaultsOnInsert: true }
    );
  }

  return unreadCount;
}
