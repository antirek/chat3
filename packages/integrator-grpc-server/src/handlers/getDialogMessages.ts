import * as grpc from '@grpc/grpc-js';
import { listUserDialogMessages, AppServiceError } from '@chat3/app-services';
import type { AuthenticatedContext } from '@chat3/app-services';
import { toGrpcMessage } from './grpcMappers.js';

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
    messages: (result.data || []).map(toGrpcMessage),
    pagination: {
      page: result.pagination.page,
      limit: result.pagination.limit,
      total: result.pagination.total,
      pages: result.pagination.pages
    }
  };
}
