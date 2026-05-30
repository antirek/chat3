/**
 * Контракт payload события в RabbitMQ после outbox-relay.
 * eventId (evt_...) — основной ключ; _id — legacy при прямой публикации из Mongo.
 */
export function resolveEventIdFromMqPayload(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const payload = raw as Record<string, unknown>;
  if (typeof payload.eventId === 'string' && payload.eventId.length > 0) {
    return payload.eventId;
  }
  if (payload._id != null) {
    return String(payload._id);
  }
  return null;
}

/** Формат, который publishOutboxBatch отправляет в RabbitMQ (без _id). */
export function toOutboxPublishPayload(row: {
  eventId: string;
  tenantId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  actorId?: string;
  actorType?: string;
  data?: Record<string, unknown>;
  createdAt?: number;
}): Record<string, unknown> {
  return {
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
}
