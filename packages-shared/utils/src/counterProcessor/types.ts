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
}
