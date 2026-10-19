import * as grpc from '@grpc/grpc-js';
import { setMessageDeleted, AppServiceError } from '@chat3/app-services';
import type { AuthenticatedContext } from '@chat3/app-services';

function convertToGrpcMessage(message: any): any {
  if (!message) return undefined;
  return {
    message_id: message.messageId || '',
    dialog_id: message.dialogId || '',
    sender_id: message.senderId || '',
    type: message.type || 'internal.text',
    content: message.content || '',
    meta: message.meta,
    reaction_set: message.reactionSet,
    sender_info: message.senderInfo
      ? {
          user_id: message.senderInfo.userId || '',
          name: message.senderInfo.name || '',
          created_at: message.senderInfo.createdAt || 0,
          meta: message.senderInfo.meta
        }
      : undefined,
    created_at: message.createdAt || 0,
    topic_id: message.topicId || '',
    deleted: message.deleted === true,
    deleted_at: message.deletedAt || 0,
    deleted_by: message.deletedBy || '',
    status_message_matrix: message.statusMessageMatrix,
    edited: message.edited === true,
    edited_at: message.editedAt || 0,
    edited_by: message.editedBy || ''
  };
}

export async function setMessageDeletedHandler(
  call: grpc.ServerUnaryCall<any, any>,
  auth: AuthenticatedContext
): Promise<any> {
  const messageId = call.request.message_id;
  const userId = call.request.user_id;
  const deleted = call.request.deleted === true;
  const deletedBy = call.request.deleted_by || userId || null;

  if (!messageId) {
    throw new AppServiceError('VALIDATION', 'message_id is required');
  }
  if (!auth.tenantId) {
    throw new AppServiceError('VALIDATION', 'tenantId is required');
  }

  const result = await setMessageDeleted({
    tenantId: auth.tenantId,
    messageId,
    deleted,
    deletedBy,
    actorId: auth.apiKey?.name || userId || 'unknown'
  });

  return {
    message: convertToGrpcMessage(result.message)
  };
}
