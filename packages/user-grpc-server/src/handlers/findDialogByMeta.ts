import * as grpc from '@grpc/grpc-js';
import { findDialogByMeta, AppServiceError } from '@chat3/app-services';
import type { AuthenticatedContext } from '@chat3/app-services';
import { toGrpcDialogInfo } from './grpcMappers.js';

export async function findDialogByMetaHandler(
  call: grpc.ServerUnaryCall<any, any>,
  auth: AuthenticatedContext
): Promise<any> {
  if (!auth.tenantId) {
    throw new AppServiceError('VALIDATION', 'tenantId is required');
  }

  const result = await findDialogByMeta({
    tenantId: auth.tenantId,
    userId: call.request.user_id || undefined,
    metaKey: call.request.meta_key,
    metaValue: call.request.meta_value
  });

  return {
    found: result.found,
    dialog: result.found ? toGrpcDialogInfo(result.dialog) : undefined
  };
}
