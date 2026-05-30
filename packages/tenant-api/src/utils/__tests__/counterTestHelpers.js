/**
 * Синхронная обработка counter-событий из outbox в интеграционных тестах
 * (эмуляция counter-worker без RabbitMQ consumer).
 */
import { OutboxEvent, ProcessedCounterEvent } from '@chat3/models';
import { isCounterEventType } from '@chat3/utils/counterProcessor/counterEvents.js';
import { processCounterEvent } from '@chat3/utils/counterProcessor/processCounterEvent.js';
import { toOutboxPublishPayload } from '@chat3/utils/domainEventPayload.js';
import { processUpdateEvent } from '@chat3/utils/updateProcessor/processUpdateEvent.js';

export async function flushCounterEvents() {
  const rows = await OutboxEvent.find({}).sort({ createdAt: 1 }).lean();
  for (const row of rows) {
    if (!isCounterEventType(row.eventType)) {
      continue;
    }
    await processCounterEvent({
      eventId: row.eventId,
      tenantId: row.tenantId,
      eventType: row.eventType,
      entityType: row.entityType,
      entityId: row.entityId,
      actorId: row.actorId,
      actorType: row.actorType,
      data: row.data,
      createdAt: row.createdAt
    });
  }
}

/**
 * Эмуляция update-worker: payload как после outbox-relay (eventId, без _id).
 */
export async function flushUpdateEvents() {
  const rows = await OutboxEvent.find({}).sort({ createdAt: 1 }).lean();
  for (const row of rows) {
    await processUpdateEvent(toOutboxPublishPayload(row));
  }
}

/**
 * E2E-пайплайн: outbox-relay → update-worker (domain MessageUpdate / DialogUpdate / …).
 */
export async function runUpdateStackPipeline(options = {}) {
  const maxRounds = options.maxRounds ?? 10;
  const { publishOutboxBatch } = await import('@chat3/utils/outboxUtils.js');
  const rabbitmqUtils = await import('@chat3/utils/rabbitmqUtils.js');

  const info = rabbitmqUtils.getRabbitMQInfo();
  if (!info.connected) {
    await rabbitmqUtils.initRabbitMQ();
  }

  const unpublishedBefore = await OutboxEvent.countDocuments({ published: false });
  let totalPublished = 0;
  for (let round = 0; round < maxRounds; round++) {
    const n = await publishOutboxBatch();
    totalPublished += n;
    if (n === 0) {
      break;
    }
  }

  await flushUpdateEvents();

  return {
    published: totalPublished,
    unpublishedBefore,
    unpublishedLeft: await OutboxEvent.countDocuments({ published: false })
  };
}

/**
 * E2E-пайплайн: outbox-relay (publishOutboxBatch) → counter-worker (processCounterEvent).
 * RabbitMQ publish проверяется relay; обработка — тем же processCounterEvent, что в counter-worker
 * (consumer path покрыт в counterProcessor / rabbitmqUtils тестах).
 */
export async function runCounterStackPipeline(options = {}) {
  const maxRounds = options.maxRounds ?? 10;
  const { publishOutboxBatch } = await import('@chat3/utils/outboxUtils.js');
  const rabbitmqUtils = await import('@chat3/utils/rabbitmqUtils.js');

  const info = rabbitmqUtils.getRabbitMQInfo();
  if (!info.connected) {
    await rabbitmqUtils.initRabbitMQ();
  }

  const unpublishedBefore = await OutboxEvent.countDocuments({ published: false });
  let totalPublished = 0;
  for (let round = 0; round < maxRounds; round++) {
    const n = await publishOutboxBatch();
    totalPublished += n;
    if (n === 0) {
      break;
    }
  }

  await flushCounterEvents();

  return {
    published: totalPublished,
    unpublishedBefore,
    unpublishedLeft: await OutboxEvent.countDocuments({ published: false })
  };
}

export async function waitForCounterProcessed(eventId, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const row = await ProcessedCounterEvent.findOne({ eventId }).lean();
    if (row) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  return false;
}
