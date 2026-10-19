import * as grpc from '@grpc/grpc-js';
import { getMessage, AppServiceError } from '@chat3/app-services';
import type { AuthenticatedContext } from '@chat3/app-services';
import { toGrpcMessage } from './grpcMappers.js';

export async function getMessageHandler(
  call: grpc.ServerUnaryCall<any, any>,
  auth: AuthenticatedContext
): Promise<any> {
  const messageId = call.request.message_id;
  const userId = call.request.user_id || '';

  if (!messageId) {
    throw new AppServiceError('VALIDATION', 'message_id is required');
  }
  if (!auth.tenantId) {
    throw new AppServiceError('VALIDATION', 'tenantId is required');
  }

  const result = await getMessage({
    tenantId: auth.tenantId,
    messageId,
    userId: userId || undefined
  });

  return { message: toGrpcMessage(result.message) };
}
