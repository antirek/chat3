import { Dialog, DialogMember } from '@chat3/models';
import * as eventUtils from '@chat3/utils/eventUtils.js';
import * as metaUtils from '@chat3/utils/metaUtils.js';
import { markDialogMessagesAsReadUntil } from '@chat3/utils/dialogReadTaskUtils.js';
import { applyMarkDialogAllRead } from '@chat3/utils/dialogMemberActivityUtils.js';
import { sanitizeResponse } from '@chat3/utils/responseUtils.js';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';
import { AppServiceError } from '../errors/AppServiceError.js';

export interface MarkDialogAllReadInput {
  tenantId: string;
  userId: string;
  dialogId: string;
  actorId?: string;
  actorType?: 'api' | 'user' | 'system';
}

export interface MarkDialogAllReadResult {
  data: any;
  /** When mark times out after counters updated */
  timedOut?: boolean;
}

export async function markDialogAllRead(
  input: MarkDialogAllReadInput
): Promise<MarkDialogAllReadResult> {
  const { tenantId, userId, dialogId } = input;
  const actorId = input.actorId || 'unknown';
  const actorType = (input.actorType || 'api') as any;

  if (!tenantId || !userId || !dialogId) {
    throw new AppServiceError('VALIDATION', 'tenantId, userId and dialogId are required');
  }

  const dialog = await Dialog.findOne({ tenantId, dialogId }).lean();
  if (!dialog) {
    throw new AppServiceError('NOT_FOUND', 'Dialog not found');
  }

  const member = await DialogMember.findOne({ tenantId, dialogId, userId });
  if (!member) {
    throw new AppServiceError('FORBIDDEN', 'User is not a member of this dialog');
  }

  const readUntil = generateTimestamp();
  const applyResult = await applyMarkDialogAllRead(
    tenantId,
    userId,
    dialogId,
    actorId,
    actorType,
    { lastSeenAt: readUntil }
  );

  const dialogMeta = await metaUtils.getEntityMeta(tenantId, 'dialog', dialog.dialogId);
  const dialogSection = eventUtils.buildDialogSection({
    dialogId: dialog.dialogId,
    tenantId: dialog.tenantId,
    createdAt: dialog.createdAt,
    meta: dialogMeta || {}
  });
  const memberSection = eventUtils.buildMemberSection({
    userId,
    state: {
      unreadCount: applyResult.finalUnreadCount,
      lastSeenAt: applyResult.lastSeenAt,
      lastMessageAt: applyResult.lastMessageAt
    }
  });
  const eventContext = eventUtils.buildEventContext({
    eventType: 'dialog.member.changed',
    dialogId: dialog.dialogId,
    entityId: `${dialog.dialogId}:${userId}`,
    includedSections: ['dialog', 'member'],
    updatedFields: ['member.state.unreadCount', 'member.state.lastSeenAt']
  });

  await eventUtils.createEvent({
    tenantId,
    eventType: 'dialog.member.changed',
    entityType: 'dialogMember',
    entityId: `${dialog.dialogId}:${userId}`,
    actorId,
    actorType,
    data: eventUtils.composeEventData({
      context: eventContext,
      dialog: dialogSection,
      member: memberSection,
      extra: {
        delta: {
          unreadCount: {
            from: applyResult.previousUnreadCount,
            to: applyResult.finalUnreadCount
          }
        }
      }
    })
  });

  let processedCount = 0;
  try {
    const result = await markDialogMessagesAsReadUntil(tenantId, dialogId, userId, readUntil, {
      timeoutMs: 120_000,
      actorId,
      actorType
    });
    processedCount = result.processedCount;
  } catch (err: any) {
    if (err?.message === 'markDialogMessagesAsReadUntil timeout') {
      return {
        timedOut: true,
        data: sanitizeResponse({
          userId,
          dialogId,
          tenantId,
          unreadCount: applyResult.finalUnreadCount,
          lastSeenAt: applyResult.lastSeenAt,
          lastMessageAt: applyResult.lastMessageAt,
          processedMessageCount: processedCount
        })
      };
    }
    throw err;
  }

  return {
    data: sanitizeResponse({
      userId,
      dialogId,
      tenantId,
      unreadCount: applyResult.finalUnreadCount,
      lastSeenAt: applyResult.lastSeenAt,
      lastMessageAt: applyResult.lastMessageAt,
      processedMessageCount: processedCount
    })
  };
}
