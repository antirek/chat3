import mongoose from 'mongoose';
import { OutboxEvent, Event } from '@chat3/models';
import type { EventType, EntityType, ActorType, IEvent } from '@chat3/models';
import { generateTimestamp } from './timestampUtils.js';
import * as rabbitmqUtils from './rabbitmqUtils.js';

const DEFAULT_BATCH_SIZE = Number(process.env.OUTBOX_BATCH_SIZE || 100);

export interface EnqueueOutboxParams {
  eventId: string;
  tenantId: string;
  eventType: EventType;
  entityType: EntityType;
  entityId: string;
  actorId?: string;
  actorType?: ActorType;
  data?: Record<string, unknown>;
}

function isTransactionUnsupportedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('Transaction numbers are only allowed on a replica set') ||
    message.includes('mongos')
  );
}

async function createEventWithOutboxSequential(params: {
  tenantId: string;
  eventType: EventType;
  entityType: EntityType;
  entityId: string;
  actorId?: string;
  actorType?: ActorType;
  data?: Record<string, unknown>;
}): Promise<IEvent | null> {
  const dataCopy = params.data ? JSON.parse(JSON.stringify(params.data)) : {};
  const event = await Event.create({
    tenantId: params.tenantId,
    eventType: params.eventType,
    entityType: params.entityType,
    entityId: params.entityId,
    actorId: params.actorId,
    actorType: params.actorType ?? 'user',
    data: dataCopy
  });

  await enqueueOutboxEvent({
    eventId: event.eventId,
    tenantId: event.tenantId,
    eventType: event.eventType,
    entityType: event.entityType,
    entityId: event.entityId,
    actorId: event.actorId,
    actorType: event.actorType,
    data: dataCopy
  });

  return event;
}

export async function enqueueOutboxEvent(params: EnqueueOutboxParams): Promise<void> {
  const dataCopy = params.data ? JSON.parse(JSON.stringify(params.data)) : {};
  await OutboxEvent.create({
    eventId: params.eventId,
    tenantId: params.tenantId,
    eventType: params.eventType,
    entityType: params.entityType,
    entityId: params.entityId,
    actorId: params.actorId,
    actorType: params.actorType ?? 'user',
    data: dataCopy,
    published: false,
    publishAttempts: 0,
    createdAt: generateTimestamp()
  });
}

/**
 * Создаёт Event в журнале и ставит в outbox (без прямого publish в RabbitMQ).
 */
export async function createEventWithOutbox(params: {
  tenantId: string;
  eventType: EventType;
  entityType: EntityType;
  entityId: string;
  actorId?: string;
  actorType?: ActorType;
  data?: Record<string, unknown>;
}): Promise<IEvent | null> {
  const session = await mongoose.startSession();
  try {
    const dataCopy = params.data ? JSON.parse(JSON.stringify(params.data)) : {};
    let created: IEvent | null = null;

    await session.withTransaction(async () => {
      const [event] = await Event.create(
        [
          {
            tenantId: params.tenantId,
            eventType: params.eventType,
            entityType: params.entityType,
            entityId: params.entityId,
            actorId: params.actorId,
            actorType: params.actorType ?? 'user',
            data: dataCopy
          }
        ],
        { session }
      );
      created = event;

      await OutboxEvent.create(
        [
          {
            eventId: event.eventId,
            tenantId: event.tenantId,
            eventType: event.eventType,
            entityType: event.entityType,
            entityId: event.entityId,
            actorId: event.actorId,
            actorType: event.actorType ?? 'user',
            data: dataCopy,
            published: false,
            publishAttempts: 0,
            createdAt: generateTimestamp()
          }
        ],
        { session }
      );
    });

    return created;
  } catch (error) {
    if (isTransactionUnsupportedError(error)) {
      console.warn(
        'createEventWithOutbox: transactions unavailable (standalone MongoDB), using sequential write'
      );
      return createEventWithOutboxSequential(params);
    }
    console.error('Error createEventWithOutbox:', error);
    return null;
  } finally {
    await session.endSession();
  }
}

export async function publishOutboxBatch(batchSize = DEFAULT_BATCH_SIZE): Promise<number> {
  const pending = await OutboxEvent.find({ published: false })
    .sort({ createdAt: 1 })
    .limit(batchSize)
    .lean();

  let published = 0;
  for (const row of pending) {
    const payload = {
      eventId: row.eventId,
      tenantId: row.tenantId,
      eventType: row.eventType,
      entityType: row.entityType,
      entityId: row.entityId,
      actorId: row.actorId,
      actorType: row.actorType,
      data: row.data,
      createdAt: row.createdAt
    };

    try {
      const ok = await rabbitmqUtils.publishEvent(payload);
      if (!ok) {
        await OutboxEvent.updateOne(
          { eventId: row.eventId },
          {
            $inc: { publishAttempts: 1 },
            $set: { lastError: 'publishEvent returned false' }
          }
        );
        continue;
      }

      await OutboxEvent.updateOne(
        { eventId: row.eventId },
        {
          $set: {
            published: true,
            publishedAt: generateTimestamp(),
            lastError: null
          }
        }
      );
      published += 1;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      await OutboxEvent.updateOne(
        { eventId: row.eventId },
        {
          $inc: { publishAttempts: 1 },
          $set: { lastError: message }
        }
      );
    }
  }

  return published;
}
