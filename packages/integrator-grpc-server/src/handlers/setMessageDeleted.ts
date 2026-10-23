import * as grpc from '@grpc/grpc-js';
import { setMessageDeleted, AppServiceError } from '@chat3/app-services';
import type { AuthenticatedContext } from '@chat3/app-services';
import { toGrpcMessage } from './grpcMappers.js';

export async function setMessageDeletedHandler(
  call: grpc.ServerUnaryCall<any, any>,
  auth: AuthenticatedContext
): Promise<any> {
  const messageId = call.request.message_id;
  const userId = call.request.user_id;
  const deleted = call.request.deleted === true;
  const deletedBy = call.request.deleted_by || userId || null;

  if (!messageId) {
    throw new AppServiceError('VALIDATION', 'message_id is required');
  }
  if (!auth.tenantId) {
    throw new AppServiceError('VALIDATION', 'tenantId is required');
  }

  const result = await setMessageDeleted({
    tenantId: auth.tenantId,
    messageId,
    deleted,
    deletedBy,
    actorId: auth.apiKey?.name || userId || 'unknown'
  });

  return {
    message: toGrpcMessage(result.message)
  };
}
