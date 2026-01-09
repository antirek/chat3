import { DialogReadTask, Message, MessageStatus } from '@chat3/models';
import type { IDialogReadTask } from '@chat3/models';
import { generateTimestamp } from './timestampUtils.js';

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

export default {
  scheduleDialogReadTask,
  runDialogReadTask
};
