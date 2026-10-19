import * as grpc from '@grpc/grpc-js';
import { setMessageStatus, AppServiceError } from '@chat3/app-services';
import type { AuthenticatedContext } from '@chat3/app-services';

export async function setMessageStatusHandler(
  call: grpc.ServerUnaryCall<any, any>,
  auth: AuthenticatedContext
): Promise<any> {
  const userId = call.request.user_id;
  const dialogId = call.request.dialog_id;
  const messageId = call.request.message_id;
  const status = call.request.status;

  if (!userId || !dialogId || !messageId || !status) {
    throw new AppServiceError(
      'VALIDATION',
      'user_id, dialog_id, message_id and status are required'
    );
  }
  if (!auth.tenantId) {
    throw new AppServiceError('VALIDATION', 'tenantId is required');
  }

  const result = await setMessageStatus({
    tenantId: auth.tenantId,
    userId,
    dialogId,
    messageId,
    status
  });

  const st = result.status || {};
  return {
    status: {
      user_id: st.userId || userId,
      status: st.status || status,
      read_at: st.readAt || 0,
      created_at: st.createdAt || 0
    }
  };
}
