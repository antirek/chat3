import * as grpc from '@grpc/grpc-js';
import { getDialog, AppServiceError } from '@chat3/app-services';
import type { AuthenticatedContext } from '@chat3/app-services';
import { toGrpcDialogInfo, toGrpcDialogMember, toGrpcDialogStatsLite } from './grpcMappers.js';

export async function getDialogHandler(
  call: grpc.ServerUnaryCall<any, any>,
  auth: AuthenticatedContext
): Promise<any> {
  if (!auth.tenantId) {
    throw new AppServiceError('VALIDATION', 'tenantId is required');
  }

  const result = await getDialog({
    tenantId: auth.tenantId,
    dialogId: call.request.dialog_id,
    userId: call.request.user_id || undefined
  });

  return {
    dialog: toGrpcDialogInfo(result.dialog),
    member: result.member ? toGrpcDialogMember(result.member) : undefined,
    stats: result.stats ? toGrpcDialogStatsLite(result.stats) : undefined
  };
}
