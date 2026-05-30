import { MessageStatus, MessageStatusStats } from '@chat3/models';
import { generateTimestamp } from '../timestampUtils.js';

/**
 * Пересчёт MessageStatusStats по истории MessageStatus для одного сообщения.
 * count = число записей истории с данным status (как прежний hook post-save).
 */
export async function recalculateMessageStatusStats(
  tenantId: string,
  messageId: string
): Promise<void> {
  const agg = await MessageStatus.aggregate<{ _id: string; count: number }>([
    { $match: { tenantId, messageId } },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);

  const now = generateTimestamp();
  const activeStatuses = new Set<string>();

  for (const row of agg) {
    const status = row._id;
    if (!status) continue;
    activeStatuses.add(status);
    await MessageStatusStats.findOneAndUpdate(
      { tenantId, messageId, status },
      {
        $set: { count: row.count, lastUpdatedAt: now },
        $setOnInsert: { createdAt: now }
      },
      { upsert: true, setDefaultsOnInsert: true }
    );
  }

  await MessageStatusStats.deleteMany({
    tenantId,
    messageId,
    ...(activeStatuses.size > 0 ? { status: { $nin: Array.from(activeStatuses) } } : {})
  });
}
