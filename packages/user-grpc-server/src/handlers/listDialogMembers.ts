import * as grpc from '@grpc/grpc-js';
import { listDialogMembers, AppServiceError } from '@chat3/app-services';
import type { AuthenticatedContext } from '@chat3/app-services';
import { toGrpcDialogMember } from './grpcMappers.js';

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
    limit: call.request.limit,
    userId: call.request.user_id || undefined
  });

  return {
    member_user_ids: result.memberUserIds,
    page: result.page,
    limit: result.limit,
    total: result.total,
    total_pages: result.totalPages,
    members: (result.members || []).map((m) =>
      toGrpcDialogMember({
        userId: m.userId,
        state: {
          unreadCount: 0,
          lastSeenAt: 0,
          lastMessageAt: 0,
          isActive: true,
          joinedAt: m.joinedAt
        }
      })
    )
  };
}
