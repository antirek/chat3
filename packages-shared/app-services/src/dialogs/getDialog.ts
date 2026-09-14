import { Dialog, DialogMember } from '@chat3/models';
import { sanitizeResponse } from '@chat3/utils/responseUtils.js';
import { AppServiceError } from '../errors/AppServiceError.js';
import { loadDialogResult, normalizeUserId } from './dialogHelpers.js';

export interface GetDialogInput {
  tenantId: string;
  dialogId: string;
  /** When set, dialog is returned only if this user is a member. */
  userId?: string;
}

export interface GetDialogResult {
  dialog: {
    dialogId: string;
    tenantId: string;
    createdAt: number;
    meta: Record<string, unknown>;
    memberUserIds: string[];
  };
}

/**
 * Load a dialog by id (meta + members). Optional membership gate via userId.
 */
export async function getDialog(input: GetDialogInput): Promise<GetDialogResult> {
  const tenantId = input.tenantId;
  const dialogId = String(input.dialogId || '').trim();
  const userId = input.userId ? normalizeUserId(input.userId) : '';

  if (!tenantId || !dialogId) {
    throw new AppServiceError('VALIDATION', 'tenantId and dialogId are required');
  }

  const exists = await Dialog.findOne({ tenantId, dialogId }).select('dialogId').lean();
  if (!exists) {
    throw new AppServiceError('NOT_FOUND', `Dialog '${dialogId}' not found`);
  }

  if (userId) {
    const membership = await DialogMember.findOne({ tenantId, dialogId, userId })
      .select('_id')
      .lean();
    if (!membership) {
      throw new AppServiceError('FORBIDDEN', 'User is not a member of this dialog');
    }
  }

  const dialog = await loadDialogResult(tenantId, dialogId);
  return {
    dialog: sanitizeResponse(dialog) as GetDialogResult['dialog']
  };
}
