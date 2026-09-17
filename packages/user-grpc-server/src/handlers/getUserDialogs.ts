import * as grpc from '@grpc/grpc-js';
import { listUserDialogs, AppServiceError } from '@chat3/app-services';
import type { AuthenticatedContext } from '@chat3/app-services';
import { toGrpcDialogFromListRow } from './grpcMappers.js';

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
    dialogs: (result.data || []).map(toGrpcDialogFromListRow),
    pagination: {
      page: result.pagination.page,
      limit: result.pagination.limit,
      total: result.pagination.total,
      pages: result.pagination.pages
    }
  };
}
