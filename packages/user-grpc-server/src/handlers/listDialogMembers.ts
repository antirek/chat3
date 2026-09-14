import * as grpc from '@grpc/grpc-js';
import { listDialogMembers, AppServiceError } from '@chat3/app-services';
import type { AuthenticatedContext } from '@chat3/app-services';

export async function listDialogMembersHandler(
  call: grpc.ServerUnaryCall<any, any>,
  auth: AuthenticatedContext
): Promise<any> {
  if (!auth.tenantId) {
    throw new AppServiceError('VALIDATION', 'tenantId is required');
  }

  const result = await listDialogMembers({
    tenantId: auth.tenantId,
    dialogId: call.request.dialog_id,
    page: call.request.page,
    limit: call.request.limit
  });

  return {
    member_user_ids: result.memberUserIds,
    page: result.page,
    limit: result.limit,
    total: result.total,
    total_pages: result.totalPages
  };
}
