import { Tenant } from '@chat3/models';
import * as metaUtils from '@chat3/utils/metaUtils.js';
import { sanitizeResponse } from '@chat3/utils/responseUtils.js';
import { AppServiceError } from '../errors/AppServiceError.js';
import type { TenantResult } from './createTenant.js';

export interface GetTenantInput {
  tenantId: string;
}

export interface GetTenantResult {
  tenant: TenantResult;
}

/**
 * Load one tenant by tenantId (+ meta).
 */
export async function getTenant(input: GetTenantInput): Promise<GetTenantResult> {
  const tenantId = String(input.tenantId || '').trim().toLowerCase();
  if (!tenantId) {
    throw new AppServiceError('VALIDATION', 'tenantId is required');
  }

  const tenant = await Tenant.findOne({ tenantId }).select('tenantId createdAt').lean();
  if (!tenant) {
    throw new AppServiceError('NOT_FOUND', `Tenant with tenantId "${tenantId}" not found`);
  }

  const meta = (await metaUtils.getEntityMeta(tenant.tenantId, 'tenant', tenant.tenantId)) || {};

  return {
    tenant: sanitizeResponse({
      tenantId: tenant.tenantId,
      createdAt: tenant.createdAt,
      meta
    }) as TenantResult
  };
}
