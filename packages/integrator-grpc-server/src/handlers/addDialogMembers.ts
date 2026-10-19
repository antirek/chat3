import * as grpc from '@grpc/grpc-js';
import { addDialogMembers, AppServiceError } from '@chat3/app-services';
import type { AuthenticatedContext } from '@chat3/app-services';
import { toGrpcDialogInfo } from './grpcMappers.js';

export async function addDialogMembersHandler(
  call: grpc.ServerUnaryCall<any, any>,
  auth: AuthenticatedContext
): Promise<any> {
  const userId = call.request.user_id;
  const dialogId = call.request.dialog_id;
  if (!userId || !dialogId) {
    throw new AppServiceError('VALIDATION', 'user_id and dialog_id are required');
  }
  if (!auth.tenantId) {
    throw new AppServiceError('VALIDATION', 'tenantId is required');
  }

  const result = await addDialogMembers({
    tenantId: auth.tenantId,
    userId,
    dialogId,
    memberUserIds: call.request.member_user_ids || []
  });

  return {
    dialog: toGrpcDialogInfo(result.dialog),
    added_user_ids: result.addedUserIds
  };
}
