import { Tenant } from '@chat3/models';
import * as metaUtils from '@chat3/utils/metaUtils.js';
import { sanitizeResponse } from '@chat3/utils/responseUtils.js';
import { AppServiceError } from '../errors/AppServiceError.js';

export interface CreateTenantInput {
  tenantId?: string | null;
  meta?: Record<string, unknown>;
  createdBy?: string;
}

export interface TenantResult {
  tenantId: string;
  createdAt: number;
  meta: Record<string, unknown>;
}

export interface CreateTenantResult {
  tenant: TenantResult;
  created: boolean;
}

function inferDataType(value: unknown): 'string' | 'number' | 'boolean' | 'object' | 'array' {
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (Array.isArray(value)) return 'array';
  if (value !== null && typeof value === 'object') return 'object';
  return 'string';
}

function normalizeRequestedTenantId(raw: string | null | undefined): string | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== 'string') return undefined;
  const normalized = raw.trim().toLowerCase();
  return normalized || undefined;
}

async function writeTenantMeta(
  tenantId: string,
  meta: Record<string, unknown>,
  createdBy: string
): Promise<Record<string, unknown>> {
  for (const [key, value] of Object.entries(meta)) {
    await metaUtils.setEntityMeta(
      tenantId,
      'tenant',
      tenantId,
      key,
      value,
      inferDataType(value),
      { createdBy }
    );
  }
  return (await metaUtils.getEntityMeta(tenantId, 'tenant', tenantId)) || {};
}

/**
 * Create a tenant (optional tenantId + opaque meta).
 * Parity with REST POST /api/tenants.
 */
export async function createTenant(input: CreateTenantInput): Promise<CreateTenantResult> {
  const createdBy = input.createdBy || 'api';
  const requestedId = normalizeRequestedTenantId(input.tenantId);
  const metaPayload =
    input.meta && typeof input.meta === 'object' ? { ...input.meta } : {};

  if (requestedId && requestedId.length > 20) {
    throw new AppServiceError('VALIDATION', 'tenantId must be at most 20 characters');
  }

  const createPayload: { tenantId?: string } = {};
  if (requestedId) {
    createPayload.tenantId = requestedId;
  }

  let tenant;
  try {
    tenant = await Tenant.create(createPayload);
  } catch (err: any) {
    if (err?.name === 'ValidationError') {
      throw new AppServiceError('VALIDATION', err.message);
    }
    if (err?.code === 11000) {
      const conflictId = requestedId || 'auto-generated';
      throw new AppServiceError(
        'CONFLICT',
        requestedId
          ? `Tenant with tenantId "${conflictId}" already exists. Please choose a different tenantId or leave it empty for auto-generation.`
          : 'Failed to create tenant. The auto-generated tenantId already exists. Please try again or specify a custom tenantId.'
      );
    }
    throw err;
  }

  let meta: Record<string, unknown> = {};
  if (Object.keys(metaPayload).length > 0) {
    meta = await writeTenantMeta(tenant.tenantId, metaPayload, createdBy);
  }

  return {
    tenant: sanitizeResponse({
      tenantId: tenant.tenantId,
      createdAt: tenant.createdAt,
      meta
    }) as TenantResult,
    created: true
  };
}

/**
 * Idempotent provisioning: return existing tenant by id, or create it.
 * If tenantId is omitted — always creates a new tenant (same as create).
 */
export async function ensureTenant(input: CreateTenantInput): Promise<CreateTenantResult> {
  const requestedId = normalizeRequestedTenantId(input.tenantId);
  if (requestedId) {
    const existing = await Tenant.findOne({ tenantId: requestedId })
      .select('tenantId createdAt')
      .lean();
    if (existing) {
      const meta =
        (await metaUtils.getEntityMeta(existing.tenantId, 'tenant', existing.tenantId)) || {};
      return {
        tenant: sanitizeResponse({
          tenantId: existing.tenantId,
          createdAt: existing.createdAt,
          meta
        }) as TenantResult,
        created: false
      };
    }
  }
  return createTenant(input);
}
