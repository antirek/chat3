import * as grpc from '@grpc/grpc-js';
import { searchMessages, AppServiceError } from '@chat3/app-services';
import type { AuthenticatedContext } from '@chat3/app-services';
import { toGrpcMessage } from './grpcMappers.js';

export async function searchMessagesHandler(
  call: grpc.ServerUnaryCall<any, any>,
  auth: AuthenticatedContext
): Promise<any> {
  if (!auth.tenantId) {
    throw new AppServiceError('VALIDATION', 'tenantId is required');
  }

  const page = call.request.page > 0 ? call.request.page : 1;
  const limit = call.request.limit > 0 ? call.request.limit : 10;
  const filter = call.request.filter || null;
  const sort = call.request.sort || null;

  const result = await searchMessages({
    tenantId: auth.tenantId,
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
