import mongoose from 'mongoose';
import { OutboxEvent, Event } from '@chat3/models';
import type { EventType, EntityType, ActorType, IEvent } from '@chat3/models';
import { generateTimestamp } from './timestampUtils.js';
import * as rabbitmqUtils from './rabbitmqUtils.js';
import { toOutboxPublishPayload } from './domainEventPayload.js';
import { context, SpanStatusCode, trace } from '@opentelemetry/api';
import { count, recordSeconds } from './otel/metrics.js';
import { isEnabled } from './otel/state.js';
import { captureTraceContext, restoreTraceContext } from './otel/traceContext.js';
import { notifyOutboxWriteFailed } from './otel/outboxFailHook.js';

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
  const w3c = captureTraceContext();
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
    traceparent: w3c.traceparent,
    tracestate: w3c.tracestate,
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
      const w3c = captureTraceContext();

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
            traceparent: w3c.traceparent,
            tracestate: w3c.tracestate,
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
    notifyOutboxWriteFailed();
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
    const payload = toOutboxPublishPayload(row);
    const attemptKind = (row.publishAttempts ?? 0) === 0 ? 'first' : 'retry';
    const eventType = String(row.eventType || 'other');
    const t0 = process.hrtime.bigint();
    const parentCtx = restoreTraceContext({
      traceparent: (row as { traceparent?: string | null }).traceparent,
      tracestate: (row as { tracestate?: string | null }).tracestate
    });

    try {
      const ok = await context.with(parentCtx, async () => {
        return trace.getTracer('chat3').startActiveSpan('outbox.publish', async (span) => {
          try {
            const publishedOk = await rabbitmqUtils.publishEvent(payload);
            if (!publishedOk) {
              span.setStatus({ code: SpanStatusCode.ERROR, message: 'publishEvent returned false' });
            }
            return publishedOk;
          } finally {
            span.end();
          }
        });
      });
      const dur = Number(process.hrtime.bigint() - t0) / 1e9;
      if (!ok) {
        const reason = rabbitmqUtils.isRabbitMQConnected()
          ? 'publish_failed'
          : 'rabbitmq_unavailable';
        if (isEnabled()) {
          count('outbox_publish_attempts_total', {
            outcome: 'error',
            attempt_kind: attemptKind,
            reason,
            event_type: eventType
          });
          recordSeconds('outbox_publish_duration_seconds', dur, {
            outcome: 'error',
            attempt_kind: attemptKind,
            event_type: eventType
          });
        }
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

      // Metrics only after successful mark published
      if (isEnabled()) {
        count('outbox_publish_attempts_total', {
          outcome: 'success',
          attempt_kind: attemptKind,
          reason: 'ok',
          event_type: eventType
        });
        recordSeconds('outbox_publish_duration_seconds', dur, {
          outcome: 'success',
          attempt_kind: attemptKind,
          event_type: eventType
        });
        const createdAt = Number(row.createdAt);
        if (Number.isFinite(createdAt)) {
          recordSeconds('outbox_event_delivery_lag_seconds', (Date.now() - createdAt) / 1000, {
            attempt_kind: attemptKind,
            event_type: eventType
          });
        }
      }
      published += 1;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (isEnabled()) {
        const dur = Number(process.hrtime.bigint() - t0) / 1e9;
        count('outbox_publish_attempts_total', {
          outcome: 'error',
          attempt_kind: attemptKind,
          reason: 'publish_exception',
          event_type: eventType
        });
        recordSeconds('outbox_publish_duration_seconds', dur, {
          outcome: 'error',
          attempt_kind: attemptKind,
          event_type: eventType
        });
      }
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
