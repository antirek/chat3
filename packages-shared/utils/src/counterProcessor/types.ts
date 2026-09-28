import type { EventType } from '@chat3/models';

export interface CounterEventPayload {
  eventId: string;
  tenantId: string;
  eventType: EventType;
  entityType: string;
  entityId: string;
  actorId?: string;
  actorType?: string;
  data?: Record<string, unknown>;
  createdAt?: number;
}

export interface CounterSlice {
  tenantId: string;
  dialogIds: string[];
  messageIds: string[];
  userIds: string[];
  userDialogs: Array<{ userId: string; dialogId: string }>;
  packIds: string[];
  senderId?: string | null;
  sourceEventId: string;
  sourceEventType: EventType;
  actorId?: string;
  actorType?: string;
  /** message.status.changed: статус из payload, чтобы не сканировать историю. */
  statusHint?: string | null;
  /** Верхняя граница Message.createdAt для полного пересчёта этого события. */
  sourceEventCreatedAt?: number;
}
