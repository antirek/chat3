import * as grpc from '@grpc/grpc-js';
import { getUser, AppServiceError } from '@chat3/app-services';
import type { AuthenticatedContext } from '@chat3/app-services';
import { toGrpcUser } from './grpcMappers.js';

export async function getUserHandler(
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

  const result = await getUser({
    tenantId: auth.tenantId,
    userId
  });

  return { user: toGrpcUser(result.user) };
}
