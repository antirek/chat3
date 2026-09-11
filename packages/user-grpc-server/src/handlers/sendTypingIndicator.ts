import * as grpc from '@grpc/grpc-js';
import { sendTyping } from '@chat3/app-services';
import type { AuthenticatedContext } from '@chat3/app-services';
import { AppServiceError } from '@chat3/app-services';

export async function sendTypingIndicatorHandler(
  call: grpc.ServerUnaryCall<any, any>,
  auth: AuthenticatedContext
): Promise<any> {
  const userId = call.request.user_id;
  const dialogId = call.request.dialog_id;

  if (!userId) {
    throw new AppServiceError('VALIDATION', 'user_id is required');
  }
  if (!dialogId) {
    throw new AppServiceError('VALIDATION', 'dialog_id is required');
  }
  if (!auth.tenantId) {
    throw new AppServiceError('VALIDATION', 'tenantId is required');
  }

  const result = await sendTyping({
    tenantId: auth.tenantId,
    dialogId,
    userId
  });

  return {
    message: 'Typing signal accepted',
    dialog_id: result.dialogId,
    user_id: result.userId,
    expires_in_ms: result.expiresInMs
  };
}
