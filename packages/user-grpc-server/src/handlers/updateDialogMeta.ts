import * as grpc from '@grpc/grpc-js';
import { updateDialogMeta, AppServiceError } from '@chat3/app-services';
import type { AuthenticatedContext } from '@chat3/app-services';
import { metaFromRequest, toGrpcDialogInfo } from './grpcMappers.js';

export async function updateDialogMetaHandler(
  call: grpc.ServerUnaryCall<any, any>,
  auth: AuthenticatedContext
): Promise<any> {
  if (!auth.tenantId) {
    throw new AppServiceError('VALIDATION', 'tenantId is required');
  }

  const meta = metaFromRequest(call.request.meta) || {};
  const result = await updateDialogMeta({
    tenantId: auth.tenantId,
    userId: call.request.user_id,
    dialogId: call.request.dialog_id,
    meta
  });

  return {
    dialog: toGrpcDialogInfo(result.dialog)
  };
}
