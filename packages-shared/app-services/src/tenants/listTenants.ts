import { Tenant } from '@chat3/models';
import * as metaUtils from '@chat3/utils/metaUtils.js';
import { sanitizeResponse } from '@chat3/utils/responseUtils.js';
import { AppServiceError } from '../errors/AppServiceError.js';
import type { TenantResult } from './createTenant.js';

export interface ListTenantsInput {
  page?: number;
  limit?: number;
  /** JSON sort object, e.g. {"createdAt":-1} */
  sort?: string | null;
}

export interface ListTenantsPagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface ListTenantsResult {
  data: TenantResult[];
  pagination: ListTenantsPagination;
}

function parseSort(sort: string | null | undefined): Record<string, 1 | -1> {
  let sortOptions: Record<string, 1 | -1> = { createdAt: -1 };
  if (!sort) return sortOptions;
  try {
    const parsed = JSON.parse(String(sort));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      sortOptions = {};
      for (const [field, order] of Object.entries(parsed)) {
        const numOrder = Number(order);
        sortOptions[field] = numOrder === 1 ? 1 : -1;
      }
      if (Object.keys(sortOptions).length === 0) {
        sortOptions = { createdAt: -1 };
      }
    }
  } catch {
    throw new AppServiceError('VALIDATION', 'Invalid sort JSON');
  }
  return sortOptions;
}

/**
 * Paginated list of all tenants (+ meta). Admin/ops scope.
 */
export async function listTenants(input: ListTenantsInput = {}): Promise<ListTenantsResult> {
  const page = input.page && input.page > 0 ? input.page : 1;
  const limit = input.limit && input.limit > 0 ? input.limit : 10;
  const skip = (page - 1) * limit;
  const sortOptions = parseSort(input.sort);

  const [tenants, total] = await Promise.all([
    Tenant.find().sort(sortOptions).skip(skip).limit(limit).select('tenantId createdAt').lean(),
    Tenant.countDocuments()
  ]);

  const data = await Promise.all(
    tenants.map(async (tenant) => {
      const meta =
        (await metaUtils.getEntityMeta(tenant.tenantId, 'tenant', tenant.tenantId)) || {};
      return sanitizeResponse({
        tenantId: tenant.tenantId,
        createdAt: tenant.createdAt,
        meta
      }) as TenantResult;
    })
  );

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 0
    }
  };
}
