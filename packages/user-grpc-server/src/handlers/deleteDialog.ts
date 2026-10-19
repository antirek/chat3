import * as grpc from '@grpc/grpc-js';
import { deleteDialog, AppServiceError } from '@chat3/app-services';
import type { AuthenticatedContext } from '@chat3/app-services';

export async function deleteDialogHandler(
  call: grpc.ServerUnaryCall<any, any>,
  auth: AuthenticatedContext
): Promise<any> {
  const dialogId = call.request.dialog_id;
  const userId = call.request.user_id || '';

  if (!dialogId) {
    throw new AppServiceError('VALIDATION', 'dialog_id is required');
  }
  if (!auth.tenantId) {
    throw new AppServiceError('VALIDATION', 'tenantId is required');
  }

  const result = await deleteDialog({
    tenantId: auth.tenantId,
    dialogId,
    userId: userId || undefined
  });

  return {
    dialog_id: result.dialogId,
    deleted: result.deleted
  };
}
