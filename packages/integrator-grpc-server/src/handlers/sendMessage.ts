import * as grpc from '@grpc/grpc-js';
import { sendMessage, AppServiceError } from '@chat3/app-services';
import type { AuthenticatedContext } from '@chat3/app-services';
import { toGrpcMessage } from './grpcMappers.js';

export async function sendMessageHandler(
  call: grpc.ServerUnaryCall<any, any>,
  auth: AuthenticatedContext
): Promise<any> {
  const userId = call.request.user_id;
  const dialogId = call.request.dialog_id;
  const content = call.request.content;
  const type = call.request.type || 'internal.text';
  const meta = call.request.meta;

  if (!userId || !dialogId) {
    throw new AppServiceError('VALIDATION', 'user_id and dialog_id are required');
  }
  if (!auth.tenantId) {
    throw new AppServiceError('VALIDATION', 'tenantId is required');
  }

  const result = await sendMessage({
    tenantId: auth.tenantId,
    dialogId,
    userId,
    content,
    type,
    meta: meta ? JSON.parse(JSON.stringify(meta)) : undefined
  });

  return { message: toGrpcMessage(result.message) };
}
