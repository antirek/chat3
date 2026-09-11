import { ApiKey, Tenant } from '@chat3/models';
import { AppServiceError } from '../errors/AppServiceError.js';

export interface AuthenticateApiKeyInput {
  apiKey?: string | null;
  tenantId?: string | null;
  /** If true, skip tenant resolution (tenant creation flow). */
  skipTenant?: boolean;
  /** If true with skipTenant, reject when tenantId header is present. */
  forbidTenantHeader?: boolean;
}

export interface AuthenticatedContext {
  apiKey: any;
  tenantId?: string;
  tenant?: any;
  tenantObjectId?: any;
}

const DEFAULT_TENANT_ID = 'tnt_default';

/**
 * Shared API-key + tenant authentication for REST and gRPC adapters.
 */
export async function authenticateApiKey(
  input: AuthenticateApiKeyInput
): Promise<AuthenticatedContext> {
  const rawKey = input.apiKey;

  if (!rawKey) {
    throw new AppServiceError(
      'UNAUTHORIZED',
      'API key is required. Please provide it in the X-API-Key header.'
    );
  }

  const key = await ApiKey.findOne({ key: rawKey });

  if (!key) {
    throw new AppServiceError('UNAUTHORIZED', 'Invalid API key');
  }

  if (!key.isValid()) {
    throw new AppServiceError('UNAUTHORIZED', 'API key is expired or inactive');
  }

  await key.updateLastUsed();

  if (input.skipTenant) {
    if (input.forbidTenantHeader && input.tenantId) {
      throw new AppServiceError(
        'VALIDATION',
        'X-Tenant-Id header is not allowed when creating a tenant. Tenant creation must be performed outside of any tenant context.'
      );
    }
    return { apiKey: key };
  }

  let tenantId = (input.tenantId || DEFAULT_TENANT_ID).toLowerCase().trim();

  const tenant = await Tenant.findOne({ tenantId });

  if (!tenant) {
    throw new AppServiceError('NOT_FOUND', `Tenant '${tenantId}' not found`);
  }

  return {
    apiKey: key,
    tenantId: tenant.tenantId,
    tenant,
    tenantObjectId: tenant._id
  };
}

export function assertPermission(apiKey: any, permission: string): void {
  if (!apiKey || !Array.isArray(apiKey.permissions) || !apiKey.permissions.includes(permission)) {
    throw new AppServiceError('FORBIDDEN', `Permission '${permission}' is required`);
  }
}
