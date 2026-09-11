import * as grpc from '@grpc/grpc-js';
import { sendMessage, AppServiceError } from '@chat3/app-services';
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
    topic: message.topic,
    deleted: message.deleted === true,
    deleted_at: message.deletedAt || 0,
    deleted_by: message.deletedBy || '',
    status_message_matrix: message.statusMessageMatrix,
    edited: message.edited === true,
    edited_at: message.editedAt || 0,
    edited_by: message.editedBy || ''
  };
}

export async function sendMessageHandler(
  call: grpc.ServerUnaryCall<any, any>,
  auth: AuthenticatedContext
): Promise<any> {
  const userId = call.request.user_id;
  const dialogId = call.request.dialog_id;
  const content = call.request.content;
  const type = call.request.type || 'internal.text';
  const meta = call.request.meta;

  if (!userId || !dialogId) {
    throw new AppServiceError('VALIDATION', 'user_id and dialog_id are required');
  }
  if (!auth.tenantId) {
    throw new AppServiceError('VALIDATION', 'tenantId is required');
  }

  const result = await sendMessage({
    tenantId: auth.tenantId,
    dialogId,
    userId,
    content,
    type,
    meta: meta ? JSON.parse(JSON.stringify(meta)) : undefined
  });

  return { message: convertToGrpcMessage(result.message) };
}
