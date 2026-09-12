import * as grpc from '@grpc/grpc-js';
import { removeDialogMemberService, AppServiceError } from '@chat3/app-services';
import type { AuthenticatedContext } from '@chat3/app-services';
import { toGrpcDialogInfo } from './grpcMappers.js';

export async function removeDialogMemberHandler(
  call: grpc.ServerUnaryCall<any, any>,
  auth: AuthenticatedContext
): Promise<any> {
  const userId = call.request.user_id;
  const dialogId = call.request.dialog_id;
  const memberUserId = call.request.member_user_id;
  if (!userId || !dialogId || !memberUserId) {
    throw new AppServiceError(
      'VALIDATION',
      'user_id, dialog_id and member_user_id are required'
    );
  }
  if (!auth.tenantId) {
    throw new AppServiceError('VALIDATION', 'tenantId is required');
  }

  const result = await removeDialogMemberService({
    tenantId: auth.tenantId,
    userId,
    dialogId,
    memberUserId
  });

  return { dialog: toGrpcDialogInfo(result.dialog) };
}
