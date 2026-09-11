import * as grpc from '@grpc/grpc-js';
import { listUserDialogMessages, AppServiceError } from '@chat3/app-services';
import type { AuthenticatedContext } from '@chat3/app-services';

function mapMessage(msg: any): any {
  return {
    message_id: msg.messageId || '',
    dialog_id: msg.dialogId || '',
    sender_id: msg.senderId || '',
    type: msg.type || '',
    content: msg.content || '',
    meta: msg.meta || {},
    statuses: [],
    reaction_set: msg.reactionSet || {},
    sender_info: msg.senderInfo
      ? {
          user_id: msg.senderInfo.userId || '',
          name: msg.senderInfo.name || '',
          created_at: msg.senderInfo.createdAt || 0,
          meta: msg.senderInfo.meta || {}
        }
      : undefined,
    created_at: msg.createdAt || 0,
    topic_id: msg.topicId || '',
    topic: msg.topic || {},
    deleted: msg.deleted === true,
    deleted_at: msg.deletedAt || 0,
    deleted_by: msg.deletedBy || '',
    status_message_matrix: msg.statusMessageMatrix || {},
    edited: msg.edited === true,
    edited_at: msg.editedAt || 0,
    edited_by: msg.editedBy || ''
  };
}

export async function getDialogMessagesHandler(
  call: grpc.ServerUnaryCall<any, any>,
  auth: AuthenticatedContext
): Promise<any> {
  const userId = call.request.user_id;
  const dialogId = call.request.dialog_id;

  if (!userId) {
    throw new AppServiceError('VALIDATION', 'user_id is required');
  }
  if (!dialogId) {
    throw new AppServiceError('VALIDATION', 'dialog_id is required');
  }
  if (!auth.tenantId) {
    throw new AppServiceError('VALIDATION', 'tenantId is required');
  }

  const page = call.request.page > 0 ? call.request.page : 1;
  const limit = call.request.limit > 0 ? call.request.limit : 50;
  const filter = call.request.filter || null;
  const sort = call.request.sort || null;

  const result = await listUserDialogMessages({
    tenantId: auth.tenantId,
    userId,
    dialogId,
    page,
    limit,
    filter,
    sort
  });

  return {
    messages: (result.data || []).map(mapMessage),
    pagination: {
      page: result.pagination.page,
      limit: result.pagination.limit,
      total: result.pagination.total,
      pages: result.pagination.pages
    }
  };
}
