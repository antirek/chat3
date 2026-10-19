import * as grpc from '@grpc/grpc-js';
import {
  createTenant,
  ensureTenant,
  getTenant,
  listTenants,
  deleteTenant,
  AppServiceError
} from '@chat3/app-services';
import type { AuthenticatedContext } from '@chat3/app-services';
import { metaFromRequest, structFromObject } from './grpcMappers.js';

function toGrpcTenant(tenant: {
  tenantId: string;
  createdAt: number;
  meta: Record<string, unknown>;
}): any {
  return {
    tenant_id: tenant.tenantId || '',
    created_at: tenant.createdAt || 0,
    meta: structFromObject(tenant.meta)
  };
}

export async function createTenantHandler(
  call: grpc.ServerUnaryCall<any, any>,
  auth: AuthenticatedContext
): Promise<any> {
  const result = await createTenant({
    tenantId: call.request.tenant_id || undefined,
    meta: metaFromRequest(call.request.meta),
    createdBy: auth.apiKey?.name || 'api'
  });
  return {
    tenant: toGrpcTenant(result.tenant),
    created: result.created
  };
}

export async function ensureTenantHandler(
  call: grpc.ServerUnaryCall<any, any>,
  auth: AuthenticatedContext
): Promise<any> {
  const result = await ensureTenant({
    tenantId: call.request.tenant_id || undefined,
    meta: metaFromRequest(call.request.meta),
    createdBy: auth.apiKey?.name || 'api'
  });
  return {
    tenant: toGrpcTenant(result.tenant),
    created: result.created
  };
}

export async function getTenantHandler(
  call: grpc.ServerUnaryCall<any, any>,
  _auth: AuthenticatedContext
): Promise<any> {
  const tenantId = call.request.tenant_id;
  if (!tenantId) {
    throw new AppServiceError('VALIDATION', 'tenant_id is required');
  }
  const result = await getTenant({ tenantId });
  return { tenant: toGrpcTenant(result.tenant) };
}

export async function listTenantsHandler(
  call: grpc.ServerUnaryCall<any, any>,
  _auth: AuthenticatedContext
): Promise<any> {
  const page = call.request.page > 0 ? call.request.page : 1;
  const limit = call.request.limit > 0 ? call.request.limit : 10;
  const sort = call.request.sort || null;

  const result = await listTenants({ page, limit, sort });
  return {
    tenants: (result.data || []).map(toGrpcTenant),
    pagination: {
      page: result.pagination.page,
      limit: result.pagination.limit,
      total: result.pagination.total,
      pages: result.pagination.pages
    }
  };
}

export async function deleteTenantHandler(
  call: grpc.ServerUnaryCall<any, any>,
  _auth: AuthenticatedContext
): Promise<any> {
  const tenantId = call.request.tenant_id;
  if (!tenantId) {
    throw new AppServiceError('VALIDATION', 'tenant_id is required');
  }
  const result = await deleteTenant({ tenantId });
  return {
    tenant_id: result.tenantId,
    deleted: result.deleted
  };
}
