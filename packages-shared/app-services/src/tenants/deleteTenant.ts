import { Meta, Tenant } from '@chat3/models';
import { AppServiceError } from '../errors/AppServiceError.js';

export interface DeleteTenantInput {
  tenantId: string;
}

export interface DeleteTenantResult {
  tenantId: string;
  deleted: boolean;
}

/**
 * Delete tenant document + its entity meta only (no cascade of users/dialogs).
 * Parity with REST DELETE /api/tenants/:id.
 */
export async function deleteTenant(input: DeleteTenantInput): Promise<DeleteTenantResult> {
  const tenantId = String(input.tenantId || '').trim().toLowerCase();
  if (!tenantId) {
    throw new AppServiceError('VALIDATION', 'tenantId is required');
  }

  const tenant = await Tenant.findOneAndDelete({ tenantId });
  if (!tenant) {
    throw new AppServiceError('NOT_FOUND', `Tenant with tenantId "${tenantId}" not found`);
  }

  await Meta.deleteMany({
    tenantId: tenant.tenantId,
    entityType: 'tenant',
    entityId: tenant.tenantId
  });

  return {
    tenantId: tenant.tenantId,
    deleted: true
  };
}
