import { Message } from '@chat3/models';
import { getPackIdsForDialog } from '../packStatsUtils.js';
import { CounterProcessorError } from './errors.js';
import type { CounterEventPayload, CounterSlice } from './types.js';
import {
  getDialogIdFromEvent,
  getDialogMemberUserIds,
  getMessageIdFromEvent,
  getPackIdFromEvent,
  getSenderIdFromEvent,
  getUserIdFromEvent
} from './eventPayload.js';

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function addUserDialog(
  pairs: Array<{ userId: string; dialogId: string }>,
  userId: string,
  dialogId: string
): void {
  if (!userId || !dialogId) return;
  pairs.push({ userId, dialogId });
}

export async function resolveSlice(event: CounterEventPayload): Promise<CounterSlice> {
  const { tenantId, eventType, eventId, entityId, data, actorId, actorType } = event;
  const dialogIds: string[] = [];
  const messageIds: string[] = [];
  const userIds: string[] = [];
  const userDialogs: Array<{ userId: string; dialogId: string }> = [];
  const packIds: string[] = [];
  let senderId: string | null = getSenderIdFromEvent(data);

  const dialogId = getDialogIdFromEvent(data);
  const eventUserId = getUserIdFromEvent(data, entityId);
  const eventMessageId = getMessageIdFromEvent(data);

  switch (eventType) {
    case 'message.create': {
      if (eventMessageId) {
        messageIds.push(eventMessageId);
      }
      if (dialogId) {
        dialogIds.push(dialogId);
        const recipients = await getDialogMemberUserIds(tenantId, dialogId, senderId);
        for (const uid of recipients) {
          userIds.push(uid);
          addUserDialog(userDialogs, uid, dialogId);
        }
        if (senderId) {
          userIds.push(senderId);
        }
        const packs = await getPackIdsForDialog(tenantId, dialogId);
        packIds.push(...packs);
      }
      break;
    }
    case 'message.status.changed': {
      if (eventMessageId) {
        messageIds.push(eventMessageId);
      }
      if (dialogId && eventUserId) {
        dialogIds.push(dialogId);
        userIds.push(eventUserId);
        addUserDialog(userDialogs, eventUserId, dialogId);
        const packs = await getPackIdsForDialog(tenantId, dialogId);
        packIds.push(...packs);
      }
      break;
    }
    case 'dialog.messages.bulk_read': {
      if (dialogId && eventUserId) {
        dialogIds.push(dialogId);
        userIds.push(eventUserId);
        addUserDialog(userDialogs, eventUserId, dialogId);
        const packs = await getPackIdsForDialog(tenantId, dialogId);
        packIds.push(...packs);
        const dialogMessageIds = await Message.find({ tenantId, dialogId })
          .select('messageId')
          .lean();
        for (const m of dialogMessageIds as Array<{ messageId: string }>) {
          if (m.messageId) messageIds.push(m.messageId);
        }
      }
      break;
    }
    case 'dialog.member.add':
    case 'dialog.member.remove':
    case 'dialog.member.changed': {
      if (dialogId && eventUserId) {
        dialogIds.push(dialogId);
        userIds.push(eventUserId);
        addUserDialog(userDialogs, eventUserId, dialogId);
        const packs = await getPackIdsForDialog(tenantId, dialogId);
        packIds.push(...packs);
      }
      break;
    }
    case 'dialog.topic.create': {
      if (dialogId) {
        dialogIds.push(dialogId);
      }
      break;
    }
    case 'pack.dialog.add':
    case 'pack.dialog.remove': {
      const packId = getPackIdFromEvent(data);
      if (packId) {
        packIds.push(packId);
      }
      if (dialogId) {
        dialogIds.push(dialogId);
        const members = await getDialogMemberUserIds(tenantId, dialogId);
        for (const uid of members) {
          userIds.push(uid);
          addUserDialog(userDialogs, uid, dialogId);
        }
      }
      break;
    }
    default:
      break;
  }

  if (eventType === 'dialog.member.remove') {
    if (!dialogId || !eventUserId) {
      throw new CounterProcessorError(
        `dialog.member.remove: missing dialogId or userId in event payload (eventId=${eventId})`,
        false
      );
    }
  }

  return {
    tenantId,
    dialogIds: uniqueStrings(dialogIds),
    messageIds: uniqueStrings(messageIds),
    userIds: uniqueStrings(userIds.map(u => u.trim().toLowerCase())),
    userDialogs,
    packIds: uniqueStrings(packIds),
    senderId,
    sourceEventId: eventId,
    sourceEventType: eventType,
    actorId,
    actorType
  };
}
