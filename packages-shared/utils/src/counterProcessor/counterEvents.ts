import type { EventType } from '@chat3/models';

/** Доменные события, влияющие на unread / pack / dialog stats. */
export const COUNTER_EVENT_TYPES: ReadonlySet<EventType> = new Set([
  'message.create',
  'message.status.changed',
  'dialog.messages.bulk_read',
  'dialog.member.add',
  'dialog.member.remove',
  'dialog.member.changed',
  'dialog.topic.create',
  'pack.dialog.add',
  'pack.dialog.remove'
]);

export function isCounterEventType(eventType: string): eventType is EventType {
  return COUNTER_EVENT_TYPES.has(eventType as EventType);
}
