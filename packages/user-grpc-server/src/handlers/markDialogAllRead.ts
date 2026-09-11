import * as grpc from '@grpc/grpc-js';
import { markDialogAllRead, AppServiceError } from '@chat3/app-services';
import type { AuthenticatedContext } from '@chat3/app-services';

export async function markDialogAllReadHandler(
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

  const result = await markDialogAllRead({
    tenantId: auth.tenantId,
    userId,
    dialogId,
    actorId: auth.apiKey?.name || 'unknown',
    actorType: 'api'
  });

  if (result.timedOut) {
    throw new AppServiceError(
      'INTERNAL',
      'Mark all read timed out (2 minutes). Counters were updated; some message statuses may still be processing.'
    );
  }

  return {
    message: 'All messages marked as read',
    dialog_id: dialogId,
    user_id: userId
  };
}
