import * as grpc from '@grpc/grpc-js';
import {
  authenticateApiKey,
  assertPermission,
  type AuthenticatedContext
} from '@chat3/app-services';
import { toGrpcServiceError } from '../utils/errorMapper.js';

export type AuthenticatedCall = {
  auth: AuthenticatedContext;
};

function metadataValue(metadata: grpc.Metadata, key: string): string | undefined {
  const values = metadata.get(key);
  if (!values || values.length === 0) {
    return undefined;
  }
  const value = values[0];
  return typeof value === 'string' ? value : value.toString();
}

export async function authenticateCall(
  metadata: grpc.Metadata,
  permission: string
): Promise<AuthenticatedContext> {
  const ctx = await authenticateApiKey({
    apiKey: metadataValue(metadata, 'x-api-key'),
    tenantId: metadataValue(metadata, 'x-tenant-id')
  });
  assertPermission(ctx.apiKey, permission);
  return ctx;
}

/**
 * Admin / Tenant service auth: api-key only (no tenant resolution).
 * When forbidTenantHeader=true, reject if x-tenant-id is present (Create/Ensure).
 */
export async function authenticateAdminCall(
  metadata: grpc.Metadata,
  permission: string,
  options: { forbidTenantHeader?: boolean } = {}
): Promise<AuthenticatedContext> {
  const ctx = await authenticateApiKey({
    apiKey: metadataValue(metadata, 'x-api-key'),
    tenantId: metadataValue(metadata, 'x-tenant-id'),
    skipTenant: true,
    forbidTenantHeader: options.forbidTenantHeader === true
  });
  assertPermission(ctx.apiKey, permission);
  return ctx;
}

type UnaryHandler = (
  call: grpc.ServerUnaryCall<any, any>,
  auth: AuthenticatedContext
) => Promise<any>;

export function wrapUnary(permission: string, handler: UnaryHandler) {
  return (call: grpc.ServerUnaryCall<any, any>, callback: grpc.sendUnaryData<any>) => {
    authenticateCall(call.metadata, permission)
      .then((auth) => handler(call, auth))
      .then((response) => callback(null, response))
      .catch((error) => callback(toGrpcServiceError(error)));
  };
}

/** Unary wrapper for Chat3TenantService (skip tenant context). */
export function wrapAdminUnary(
  permission: string,
  handler: UnaryHandler,
  options: { forbidTenantHeader?: boolean } = {}
) {
  return (call: grpc.ServerUnaryCall<any, any>, callback: grpc.sendUnaryData<any>) => {
    authenticateAdminCall(call.metadata, permission, options)
      .then((auth) => handler(call, auth))
      .then((response) => callback(null, response))
      .catch((error) => callback(toGrpcServiceError(error)));
  };
}

type StreamingHandler = (
  call: grpc.ServerWritableStream<any, any>,
  auth: AuthenticatedContext
) => Promise<void>;

export function wrapStreaming(permission: string, handler: StreamingHandler) {
  return (call: grpc.ServerWritableStream<any, any>) => {
    authenticateCall(call.metadata, permission)
      .then((auth) => handler(call, auth))
      .catch((error) => {
        call.destroy(toGrpcServiceError(error));
      });
  };
}
