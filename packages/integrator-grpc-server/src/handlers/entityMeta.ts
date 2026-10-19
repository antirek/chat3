import * as grpc from '@grpc/grpc-js';
import {
  setEntityMetaService,
  getEntityMetaService,
  deleteEntityMetaService,
  AppServiceError
} from '@chat3/app-services';
import type { AuthenticatedContext } from '@chat3/app-services';
import { structFromObject, valueFromProtobuf } from './grpcMappers.js';

export async function setMetaHandler(
  call: grpc.ServerUnaryCall<any, any>,
  auth: AuthenticatedContext
): Promise<any> {
  if (!auth.tenantId) {
    throw new AppServiceError('VALIDATION', 'tenantId is required');
  }

  const entityType = call.request.entity_type;
  const entityId = call.request.entity_id;
  const key = call.request.key;
  if (!entityType || !entityId || !key) {
    throw new AppServiceError('VALIDATION', 'entity_type, entity_id and key are required');
  }

  const value = valueFromProtobuf(call.request.value);
  const result = await setEntityMetaService({
    tenantId: auth.tenantId,
    entityType,
    entityId,
    key,
    value,
    dataType: call.request.data_type || undefined,
    userId: call.request.user_id || undefined
  });

  return { meta: structFromObject(result.meta) };
}

export async function getMetaHandler(
  call: grpc.ServerUnaryCall<any, any>,
  auth: AuthenticatedContext
): Promise<any> {
  if (!auth.tenantId) {
    throw new AppServiceError('VALIDATION', 'tenantId is required');
  }

  const entityType = call.request.entity_type;
  const entityId = call.request.entity_id;
  if (!entityType || !entityId) {
    throw new AppServiceError('VALIDATION', 'entity_type and entity_id are required');
  }

  const result = await getEntityMetaService({
    tenantId: auth.tenantId,
    entityType,
    entityId,
    key: call.request.key || undefined
  });

  return { meta: structFromObject(result.meta) };
}

export async function deleteMetaHandler(
  call: grpc.ServerUnaryCall<any, any>,
  auth: AuthenticatedContext
): Promise<any> {
  if (!auth.tenantId) {
    throw new AppServiceError('VALIDATION', 'tenantId is required');
  }

  const entityType = call.request.entity_type;
  const entityId = call.request.entity_id;
  const key = call.request.key;
  if (!entityType || !entityId || !key) {
    throw new AppServiceError('VALIDATION', 'entity_type, entity_id and key are required');
  }

  const result = await deleteEntityMetaService({
    tenantId: auth.tenantId,
    entityType,
    entityId,
    key,
    userId: call.request.user_id || undefined
  });

  return { deleted: result.deleted };
}
