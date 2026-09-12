import { DialogMember, Meta } from '@chat3/models';
import { sanitizeResponse } from '@chat3/utils/responseUtils.js';
import { AppServiceError } from '../errors/AppServiceError.js';
import { loadDialogResult, normalizeUserId } from './dialogHelpers.js';

export interface FindDialogByMetaInput {
  tenantId: string;
  /** When set, dialog is returned only if this user is a member. */
  userId?: string;
  metaKey: string;
  metaValue: string;
}

export interface FindDialogByMetaResult {
  found: boolean;
  dialog?: {
    dialogId: string;
    tenantId: string;
    createdAt: number;
    meta: Record<string, unknown>;
    memberUserIds: string[];
  };
}

/**
 * Find a dialog by a single meta key/value (tenant-scoped).
 * Product layers (e.g. local-chat DM) use this for idempotent lookups.
 */
export async function findDialogByMeta(
  input: FindDialogByMetaInput
): Promise<FindDialogByMetaResult> {
  const tenantId = input.tenantId;
  const metaKey = String(input.metaKey || '').trim();
  const metaValue = String(input.metaValue ?? '').trim();
  const userId = input.userId ? normalizeUserId(input.userId) : '';

  if (!tenantId || !metaKey) {
    throw new AppServiceError('VALIDATION', 'tenantId and metaKey are required');
  }
  if (metaValue === '') {
    throw new AppServiceError('VALIDATION', 'metaValue is required');
  }

  const record = await Meta.findOne({
    tenantId,
    entityType: 'dialog',
    key: metaKey,
    value: metaValue
  })
    .select('entityId')
    .lean();

  if (!record?.entityId) {
    return { found: false };
  }

  if (userId) {
    const membership = await DialogMember.findOne({
      tenantId,
      dialogId: record.entityId,
      userId
    })
      .select('_id')
      .lean();
    if (!membership) {
      return { found: false };
    }
  }

  const dialog = await loadDialogResult(tenantId, record.entityId);
  return {
    found: true,
    dialog: sanitizeResponse(dialog) as FindDialogByMetaResult['dialog']
  };
}
