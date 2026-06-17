import { DialogReadTask, Message, MessageStatus, UserDialogStats } from '@chat3/models';
import type { IDialogReadTask, ActorType } from '@chat3/models';
import { generateTimestamp } from './timestampUtils.js';
import * as eventUtils from './eventUtils.js';

const DEFAULT_BATCH_SIZE = parseInt(process.env.DIALOG_READ_BATCH_SIZE || '200', 10);
const BATCH_SLEEP_MS = parseInt(process.env.DIALOG_READ_BATCH_SLEEP_MS || '0', 10);

function sleep(ms: number): Promise<void> {
  if (!ms) {
    return Promise.resolve();
  }
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface ScheduleDialogReadTaskParams {
  tenantId: string;
  dialogId: string;
  userId: string;
  readUntil?: number;
  source?: string;
}

export async function scheduleDialogReadTask({ 
  tenantId, 
  dialogId, 
  userId, 
  readUntil, 
  source = 'api' 
}: ScheduleDialogReadTaskParams): Promise<IDialogReadTask> {
  if (!tenantId || !dialogId || !userId) {
    throw new Error('scheduleDialogReadTask: tenantId, dialogId and userId are required');
  }

  const effectiveReadUntil = readUntil || generateTimestamp();

  const existing = await DialogReadTask.findOne({
    tenantId,
    dialogId,
    userId,
    status: { $in: ['pending', 'running'] }
  });

  if (existing) {
    if (!existing.readUntil || effectiveReadUntil > existing.readUntil) {
      existing.readUntil = effectiveReadUntil;
    }
    existing.requestCount = (existing.requestCount || 1) + 1;
    existing.source = source;
    if (existing.status === 'running') {
      // Ничего не меняем, воркер продолжит с обновленным readUntil
    } else {
      existing.status = 'pending';
    }
    await existing.save();
    return existing;
  }

  return DialogReadTask.create({
    tenantId,
    dialogId,
    userId,
    readUntil: effectiveReadUntil,
    status: 'pending',
    source
  });
}

interface RunDialogReadTaskOptions {
  batchSize?: number;
}

export interface PublishBulkReadParams {
  tenantId: string;
  dialogId: string;
  userId: string;
  readUntil: number;
  actorId?: string;
  actorType?: ActorType;
  processedCount?: number;
}

/**
 * Публикует dialog.messages.bulk_read после записи MessageStatus (counter-worker пересчитает stats).
 */
export async function publishDialogMessagesBulkRead({
  tenantId,
  dialogId,
  userId,
  readUntil,
  actorId = 'system',
  actorType = 'system',
  processedCount = 0
}: PublishBulkReadParams): Promise<string | null> {
  const event = await eventUtils.createEvent({
    tenantId,
    eventType: 'dialog.messages.bulk_read',
    entityType: 'dialogMember',
    entityId: `${dialogId}:${userId}`,
    actorId,
    actorType,
    data: eventUtils.composeEventData({
      context: eventUtils.buildEventContext({
        eventType: 'dialog.messages.bulk_read',
        dialogId,
        userId,
        entityId: `${dialogId}:${userId}`,
        includedSections: ['dialog', 'member']
      }),
      dialog: eventUtils.buildDialogSection({ dialogId, tenantId })!,
      member: eventUtils.buildMemberSection({
        userId,
        state: { unreadCount: 0, lastSeenAt: readUntil, lastMessageAt: null }
      })!,
      extra: { readUntil, processedCount }
    })
  });
  return event?.eventId ?? null;
}

export async function runDialogReadTask(
  task: IDialogReadTask, 
  options: RunDialogReadTaskOptions = {}
): Promise<IDialogReadTask> {
  if (!task) {
    throw new Error('runDialogReadTask: task is required');
  }

  const batchSize = parseInt(String(options.batchSize), 10) || DEFAULT_BATCH_SIZE;
  const readTimestamp = task.readUntil || generateTimestamp();

  let hasMore = true;

  while (hasMore) {
    const batch = await fetchNextMessageBatch(task, batchSize);

    if (!batch.length) {
      hasMore = false;
      break;
    }

    const bulkOps = [];
    for (const message of batch) {
      // Обновляем курсоры независимо от того, нужен ли статус для этого сообщения
      task.lastProcessedAt = message.createdAt;
      task.lastProcessedMessageId = message._id;

      if (message.senderId === task.userId) {
        continue;
      }

      bulkOps.push({
        updateOne: {
          filter: {
            tenantId: task.tenantId,
            messageId: message.messageId,
            userId: task.userId
          },
          update: {
            $set: {
              status: 'read',
              readAt: readTimestamp
            },
            $setOnInsert: {
              createdAt: readTimestamp
            }
          },
          upsert: true
        }
      });
    }

    if (bulkOps.length) {
      await MessageStatus.bulkWrite(bulkOps, { ordered: false });
      task.processedCount = (task.processedCount || 0) + bulkOps.length;
    }

    await task.save();
    await sleep(BATCH_SLEEP_MS);
  }

  task.status = 'completed';
  task.finishedAt = generateTimestamp();
  task.error = null;
  await task.save();

  if ((task.processedCount || 0) > 0) {
    await publishDialogMessagesBulkRead({
      tenantId: task.tenantId,
      dialogId: task.dialogId,
      userId: task.userId,
      readUntil: task.readUntil || readTimestamp,
      actorId: 'dialog-read-worker',
      actorType: 'system',
      processedCount: task.processedCount || 0
    });
  }

  return task;
}

async function fetchNextMessageBatch(task: IDialogReadTask, limit: number) {
  const query: {
    tenantId: string;
    dialogId: string;
    createdAt: { $lte: number };
    $or?: Array<{
      createdAt: { $gt: number } | number;
      _id?: { $gt: unknown };
    }>;
  } = {
    tenantId: task.tenantId,
    dialogId: task.dialogId,
    createdAt: { $lte: task.readUntil }
  };

  if (task.lastProcessedAt) {
    query.$or = [
      { createdAt: { $gt: task.lastProcessedAt } },
      { createdAt: task.lastProcessedAt, _id: { $gt: task.lastProcessedMessageId } }
    ];
  }

  return Message.find(query)
    .sort({ createdAt: 1, _id: 1 })
    .limit(limit)
    .select('_id messageId senderId createdAt')
    .lean();
}

const MARK_ALL_READ_TIMEOUT_MS = 120_000; // 2 minutes

export interface MarkDialogMessagesAsReadUntilOptions {
  batchSize?: number;
  timeoutMs?: number;
  /** Если true — эмитить bulk_read даже при processedCount=0 (явный пересчёт). */
  forceBulkReadRecalc?: boolean;
}

/**
 * Синхронно проставить MessageStatus = read для всех сообщений диалога до readUntil (кроме своих).
 * Для использования в API (markAllRead) с таймаутом. Воркер продолжает использовать runDialogReadTask.
 */
export async function markDialogMessagesAsReadUntil(
  tenantId: string,
  dialogId: string,
  userId: string,
  readUntil: number,
  options: MarkDialogMessagesAsReadUntilOptions & {
    actorId?: string;
    actorType?: ActorType;
    emitBulkReadEvent?: boolean;
  } = {}
): Promise<{ processedCount: number; bulkReadEventId: string | null }> {
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const readTimestamp = readUntil || generateTimestamp();
  const timeoutMs = options.timeoutMs ?? MARK_ALL_READ_TIMEOUT_MS;

  const taskLike: Pick<IDialogReadTask, 'tenantId' | 'dialogId' | 'userId' | 'readUntil' | 'lastProcessedAt' | 'lastProcessedMessageId'> = {
    tenantId,
    dialogId,
    userId,
    readUntil: readTimestamp,
    lastProcessedAt: undefined,
    lastProcessedMessageId: undefined
  };

  const emitBulkRead = options.emitBulkReadEvent !== false;
  const actorId = options.actorId ?? 'api';
  const actorType = options.actorType ?? 'api';

  const run = async (): Promise<{ processedCount: number; bulkReadEventId: string | null }> => {
    let processedCount = 0;
    let hasMore = true;

    let forceBulkReadRecalc = options.forceBulkReadRecalc;
    if (forceBulkReadRecalc === undefined) {
      const statsRow = await UserDialogStats.findOne({ tenantId, userId, dialogId })
        .select('unreadCount')
        .lean();
      forceBulkReadRecalc = ((statsRow as { unreadCount?: number } | null)?.unreadCount ?? 0) > 0;
    }

    while (hasMore) {
      const batch = await fetchNextMessageBatch(taskLike as IDialogReadTask, batchSize);
      if (!batch.length) {
        hasMore = false;
        break;
      }

      const bulkOps: Array<{ updateOne: { filter: object; update: object; upsert: boolean } }> = [];
      for (const message of batch) {
        (taskLike as { lastProcessedAt?: number; lastProcessedMessageId?: unknown }).lastProcessedAt = message.createdAt;
        (taskLike as { lastProcessedMessageId?: unknown }).lastProcessedMessageId = message._id;
        if (message.senderId === userId) continue;
        bulkOps.push({
          updateOne: {
            filter: { tenantId, messageId: message.messageId, userId },
            update: {
              $set: { status: 'read', readAt: readTimestamp },
              $setOnInsert: { createdAt: readTimestamp }
            },
            upsert: true
          }
        });
      }

      if (bulkOps.length) {
        await MessageStatus.bulkWrite(bulkOps, { ordered: false });
        processedCount += bulkOps.length;
      }

      await sleep(BATCH_SLEEP_MS);
    }

    let bulkReadEventId: string | null = null;
    if (emitBulkRead && (processedCount > 0 || forceBulkReadRecalc)) {
      bulkReadEventId = await publishDialogMessagesBulkRead({
        tenantId,
        dialogId,
        userId,
        readUntil: readTimestamp,
        actorId,
        actorType,
        processedCount
      });
    }

    return { processedCount, bulkReadEventId };
  };

  if (timeoutMs > 0) {
    return Promise.race([
      run(),
      new Promise<{ processedCount: number; bulkReadEventId: string | null }>((_, rej) =>
        setTimeout(() => rej(new Error('markDialogMessagesAsReadUntil timeout')), timeoutMs)
      )
    ]);
  }

  return run();
}

export default {
  scheduleDialogReadTask,
  runDialogReadTask,
  markDialogMessagesAsReadUntil,
  publishDialogMessagesBulkRead
};
