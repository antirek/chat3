import * as grpc from '@grpc/grpc-js';
import { createDialog, AppServiceError } from '@chat3/app-services';
import type { AuthenticatedContext } from '@chat3/app-services';
import { metaFromRequest, toGrpcDialogInfo } from './grpcMappers.js';

export async function createDialogHandler(
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

  const result = await createDialog({
    tenantId: auth.tenantId,
    userId,
    memberUserIds: call.request.member_user_ids || [],
    meta: metaFromRequest(call.request.meta)
  });

  return {
    dialog: toGrpcDialogInfo(result.dialog),
    created: result.created
  };
}
