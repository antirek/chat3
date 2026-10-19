import * as grpc from '@grpc/grpc-js';
import { upsertUser, AppServiceError } from '@chat3/app-services';
import type { AuthenticatedContext } from '@chat3/app-services';
import { metaFromRequest, toGrpcUser } from './grpcMappers.js';

export async function upsertUserHandler(
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

  const result = await upsertUser({
    tenantId: auth.tenantId,
    userId,
    name: call.request.name || undefined,
    type: call.request.type || undefined,
    meta: metaFromRequest(call.request.meta),
    actorId: userId
  });

  return {
    user: toGrpcUser(result.user),
    created: result.created
  };
}
