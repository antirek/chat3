/**
 * Синхронная обработка counter-событий из outbox в интеграционных тестах
 * (эмуляция counter-worker без RabbitMQ consumer).
 */
import { OutboxEvent } from '@chat3/models';
import { isCounterEventType } from '@chat3/utils/counterProcessor/counterEvents.js';
import { processCounterEvent } from '@chat3/utils/counterProcessor/processCounterEvent.js';

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
