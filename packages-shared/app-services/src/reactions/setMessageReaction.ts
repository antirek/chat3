import { Dialog, Message, MessageReaction } from '@chat3/models';
import * as eventUtils from '@chat3/utils/eventUtils.js';
import * as metaUtils from '@chat3/utils/metaUtils.js';
import { sanitizeResponse } from '@chat3/utils/responseUtils.js';
import { buildReactionSet } from '@chat3/utils/userDialogUtils.js';
import { AppServiceError } from '../errors/AppServiceError.js';

export type ReactionAction = 'set' | 'unset';

export interface SetMessageReactionInput {
  tenantId: string;
  userId: string;
  messageId: string;
  reaction: string;
  action: ReactionAction;
}

export interface SetMessageReactionResult {
  /** HTTP-oriented status hint for REST adapter */
  httpStatus: number;
  data: any;
  message: string;
  reactionSet?: any;
}

async function buildDialogSectionForMessage(tenantId: string, dialogId: string) {
  const dialog = await Dialog.findOne({ dialogId, tenantId }).lean();
  if (!dialog) {
    throw new AppServiceError('NOT_FOUND', 'Dialog not found');
  }
  const dialogMeta = await metaUtils.getEntityMeta(tenantId, 'dialog', dialog.dialogId);
  return eventUtils.buildDialogSection({
    dialogId: dialog.dialogId,
    tenantId: dialog.tenantId,
    createdAt: dialog.createdAt,
    meta: dialogMeta || {}
  });
}

export async function setMessageReaction(
  input: SetMessageReactionInput
): Promise<SetMessageReactionResult> {
  const { tenantId, messageId, reaction, action } = input;
  const userId = input.userId;

  if (!tenantId || !userId || !messageId || !reaction) {
    throw new AppServiceError('VALIDATION', 'tenantId, userId, messageId and reaction are required');
  }
  if (action !== 'set' && action !== 'unset') {
    throw new AppServiceError('VALIDATION', 'action must be set or unset');
  }
  if (typeof reaction !== 'string' || reaction.trim().length === 0) {
    throw new AppServiceError('VALIDATION', 'Reaction is required');
  }
  if (reaction.length > 50) {
    throw new AppServiceError('VALIDATION', 'reaction is too long (maximum 50 characters)');
  }

  const message = await Message.findOne({ messageId, tenantId });
  if (!message) {
    throw new AppServiceError('NOT_FOUND', 'Message not found');
  }

  try {
    if (action === 'set') {
      const existingReaction = await MessageReaction.findOne({
        tenantId,
        messageId,
        userId,
        reaction
      });

      if (existingReaction) {
        return {
          httpStatus: 200,
          data: existingReaction,
          message: 'Reaction already exists'
        };
      }

      const reactionDoc = new MessageReaction({
        tenantId,
        messageId,
        userId,
        reaction
      });
      await reactionDoc.save();

      const dialogSection = await buildDialogSectionForMessage(tenantId, message.dialogId);
      const reactionSet = await buildReactionSet(tenantId, messageId, userId);

      const messageSection = eventUtils.buildMessageSection({
        messageId,
        dialogId: message.dialogId,
        senderId: message.senderId,
        type: message.type,
        content: message.content,
        reactionUpdate: {
          userId,
          reaction,
          oldReaction: null,
          reactionSet
        }
      });

      const reactionContext = eventUtils.buildEventContext({
        eventType: 'message.reaction.changed',
        dialogId: message.dialogId,
        entityId: messageId,
        messageId,
        includedSections: ['dialog', 'message'],
        updatedFields: ['message.reaction']
      });

      await eventUtils.createEvent({
        tenantId,
        eventType: 'message.reaction.changed',
        entityType: 'messageReaction',
        entityId: messageId,
        actorId: userId,
        actorType: 'user',
        data: eventUtils.composeEventData({
          context: reactionContext,
          dialog: dialogSection,
          message: messageSection
        })
      });

      return {
        httpStatus: 201,
        data: sanitizeResponse({ reaction: reactionDoc }),
        message: 'Reaction set successfully',
        reactionSet
      };
    }

    const reactionToDelete = await MessageReaction.findOne({
      tenantId,
      messageId,
      userId,
      reaction
    });

    if (!reactionToDelete) {
      throw new AppServiceError('NOT_FOUND', 'Reaction not found');
    }

    await reactionToDelete.deleteOne();

    const dialogSection = await buildDialogSectionForMessage(tenantId, message.dialogId);
    const reactionSet = await buildReactionSet(tenantId, messageId, userId);

    const removeContext = eventUtils.buildEventContext({
      eventType: 'message.reaction.changed',
      dialogId: message.dialogId,
      entityId: messageId,
      messageId,
      includedSections: ['dialog', 'message'],
      updatedFields: ['message.reaction']
    });

    const removeMessageSection = eventUtils.buildMessageSection({
      messageId,
      dialogId: message.dialogId,
      senderId: message.senderId,
      type: message.type,
      content: message.content,
      reactionUpdate: {
        userId,
        reaction: null,
        oldReaction: reactionToDelete.reaction,
        reactionSet
      }
    });

    await eventUtils.createEvent({
      tenantId,
      eventType: 'message.reaction.changed',
      entityType: 'messageReaction',
      entityId: messageId,
      actorId: userId,
      actorType: 'user',
      data: eventUtils.composeEventData({
        context: removeContext,
        dialog: dialogSection,
        message: removeMessageSection
      })
    });

    return {
      httpStatus: 200,
      data: sanitizeResponse({}),
      message: 'Reaction unset successfully',
      reactionSet
    };
  } catch (error: any) {
    if (isAppServiceErrorLike(error)) {
      throw error;
    }
    if (error?.name === 'CastError') {
      throw new AppServiceError('VALIDATION', 'Invalid message ID');
    }
    if (error?.code === 11000) {
      throw new AppServiceError('CONFLICT', 'Reaction already exists for this user and message');
    }
    throw error;
  }
}

function isAppServiceErrorLike(error: any): boolean {
  return error instanceof AppServiceError;
}
