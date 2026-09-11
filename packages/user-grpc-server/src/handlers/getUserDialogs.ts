import * as grpc from '@grpc/grpc-js';
import { listUserDialogs, AppServiceError } from '@chat3/app-services';
import type { AuthenticatedContext } from '@chat3/app-services';

function mapLastMessage(msg: any): any | undefined {
  if (!msg) return undefined;
  return {
    message_id: msg.messageId || '',
    dialog_id: msg.dialogId || '',
    sender_id: msg.senderId || '',
    type: msg.type || '',
    content: msg.content || '',
    meta: {},
    statuses: [],
    reaction_set: {},
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
    topic: {},
    deleted: msg.deleted === true,
    deleted_at: msg.deletedAt || 0,
    deleted_by: msg.deletedBy || '',
    status_message_matrix: {},
    edited: false,
    edited_at: 0,
    edited_by: ''
  };
}

function mapDialog(dialog: any): any {
  const context = dialog.context || {};
  return {
    dialog_id: dialog.dialogId || '',
    tenant_id: dialog.tenantId || '',
    name: dialog.name || '',
    created_by: dialog.createdBy || '',
    created_at: dialog.createdAt || 0,
    updated_at: dialog.updatedAt || 0,
    meta: dialog.meta || {},
    member: {
      user_id: context.userId || '',
      meta: {},
      state: {
        unread_count: context.unreadCount || 0,
        last_seen_at: context.lastSeenAt || 0,
        last_message_at: context.lastMessageAt || 0,
        is_active: true
      }
    },
    last_message: mapLastMessage(dialog.lastMessage)
  };
}

export async function getUserDialogsHandler(
  call: grpc.ServerUnaryCall<any, any>,
  auth: AuthenticatedContext
): Promise<any> {
  const userId = call.request.user_id;
  if (!userId) {
    throw new AppServiceError('VALIDATION', 'user_id is required');
  }
  if (!auth.tenantId) {
    throw new AppServiceError('VALIDATION', 'tenantId is required');
  }

  const page = call.request.page > 0 ? call.request.page : 1;
  const limit = call.request.limit > 0 ? call.request.limit : 10;
  const filter = call.request.filter || null;
  const sort = call.request.sort || null;
  const includeLastMessage =
    call.request.include_last_message === undefined
      ? true
      : Boolean(call.request.include_last_message);

  const result = await listUserDialogs({
    tenantId: auth.tenantId,
    userId,
    page,
    limit,
    filter,
    sort,
    includeLastMessage
  });

  return {
    dialogs: (result.data || []).map(mapDialog),
    pagination: {
      page: result.pagination.page,
      limit: result.pagination.limit,
      total: result.pagination.total,
      pages: result.pagination.pages
    }
  };
}
