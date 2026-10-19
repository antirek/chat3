import * as grpc from '@grpc/grpc-js';
import { listMessageStatuses, AppServiceError } from '@chat3/app-services';
import type { AuthenticatedContext } from '@chat3/app-services';
import { toGrpcMessageStatus } from './grpcMappers.js';

export async function listMessageStatusesHandler(
  call: grpc.ServerUnaryCall<any, any>,
  auth: AuthenticatedContext
): Promise<any> {
  const userId = call.request.user_id;
  const dialogId = call.request.dialog_id;
  const messageId = call.request.message_id;

  if (!userId || !dialogId || !messageId) {
    throw new AppServiceError('VALIDATION', 'user_id, dialog_id and message_id are required');
  }
  if (!auth.tenantId) {
    throw new AppServiceError('VALIDATION', 'tenantId is required');
  }

  const page = call.request.page > 0 ? call.request.page : 1;
  const limit = call.request.limit > 0 ? call.request.limit : 50;

  const result = await listMessageStatuses({
    tenantId: auth.tenantId,
    userId,
    dialogId,
    messageId,
    page,
    limit
  });

  return {
    statuses: (result.data || []).map(toGrpcMessageStatus),
    pagination: {
      page: result.pagination.page,
      limit: result.pagination.limit,
      total: result.pagination.total,
      pages: result.pagination.pages
    }
  };
}
