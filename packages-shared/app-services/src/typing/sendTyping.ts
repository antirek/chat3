import { Dialog, DialogMember, User } from '@chat3/models';
import * as eventUtils from '@chat3/utils/eventUtils.js';
import * as metaUtils from '@chat3/utils/metaUtils.js';
import { sanitizeResponse } from '@chat3/utils/responseUtils.js';
import { AppServiceError } from '../errors/AppServiceError.js';

export const DEFAULT_TYPING_EXPIRES_MS = 5000;

export interface SendTypingInput {
  tenantId: string;
  dialogId: string;
  userId: string;
  expiresInMs?: number;
}

export interface SendTypingResult {
  dialogId: string;
  userId: string;
  expiresInMs: number;
}

/**
 * Emit dialog.typing event for a dialog member.
 * Shared by REST and gRPC.
 */
export async function sendTyping(input: SendTypingInput): Promise<SendTypingResult> {
  const { tenantId, dialogId, userId } = input;
  const expiresInMs = input.expiresInMs ?? DEFAULT_TYPING_EXPIRES_MS;

  if (!dialogId) {
    throw new AppServiceError('VALIDATION', 'dialogId is required');
  }
  if (!userId) {
    throw new AppServiceError('VALIDATION', 'userId is required');
  }
  if (!tenantId) {
    throw new AppServiceError('VALIDATION', 'tenantId is required');
  }

  const dialog = await Dialog.findOne({ dialogId, tenantId }).select('dialogId').lean();
  if (!dialog) {
    throw new AppServiceError('NOT_FOUND', 'Dialog not found');
  }

  const member = await DialogMember.findOne({ dialogId, tenantId, userId }).select('userId').lean();
  if (!member) {
    throw new AppServiceError('NOT_FOUND', 'User is not a member of this dialog');
  }

  const user = await User.findOne({ userId, tenantId }).lean();
  const userMeta = await metaUtils.getEntityMeta(tenantId, 'user', userId);
  const actorInfo = sanitizeResponse({
    ...user,
    meta: userMeta
  });

  const fullDialog = await Dialog.findOne({ dialogId, tenantId }).lean();
  if (!fullDialog) {
    throw new AppServiceError('NOT_FOUND', 'Dialog not found');
  }

  const dialogMeta = await metaUtils.getEntityMeta(tenantId, 'dialog', dialogId);
  const dialogSection = eventUtils.buildDialogSection({
    dialogId: fullDialog.dialogId,
    tenantId: fullDialog.tenantId,
    createdBy: (fullDialog as any).createdBy,
    createdAt: fullDialog.createdAt,
    meta: dialogMeta || {}
  });

  const typingSection = eventUtils.buildTypingSection({
    userId,
    expiresInMs,
    timestamp: Date.now(),
    userInfo: actorInfo
  });

  const typingContext = eventUtils.buildEventContext({
    eventType: 'dialog.typing',
    dialogId,
    entityId: dialogId,
    includedSections: ['dialog', 'typing'],
    updatedFields: ['typing']
  });

  await eventUtils.createEvent({
    tenantId,
    eventType: 'dialog.typing',
    entityType: 'dialog',
    entityId: dialogId,
    actorId: userId,
    actorType: 'user',
    data: eventUtils.composeEventData({
      context: typingContext,
      dialog: dialogSection,
      typing: typingSection
    })
  });

  return { dialogId, userId, expiresInMs };
}
