import { Dialog } from '@chat3/models';
import { AppServiceError } from '../errors/AppServiceError.js';
import {
  addMemberWithEvent,
  loadDialogResult,
  normalizeUserId
} from './dialogHelpers.js';
import { sanitizeResponse } from '@chat3/utils/responseUtils.js';

export interface AddDialogMembersInput {
  tenantId: string;
  userId: string;
  dialogId: string;
  memberUserIds: string[];
}

export interface AddDialogMembersResult {
  dialog: {
    dialogId: string;
    tenantId: string;
    createdAt: number;
    meta: Record<string, unknown>;
    memberUserIds: string[];
  };
  addedUserIds: string[];
}

export async function addDialogMembers(
  input: AddDialogMembersInput
): Promise<AddDialogMembersResult> {
  const tenantId = input.tenantId;
  const actorId = normalizeUserId(input.userId);
  const dialogId = String(input.dialogId || '').trim();
  const memberUserIds = Array.from(
    new Set((input.memberUserIds || []).map(normalizeUserId).filter(Boolean))
  );

  if (!tenantId || !actorId || !dialogId) {
    throw new AppServiceError('VALIDATION', 'tenantId, userId and dialogId are required');
  }
  if (memberUserIds.length === 0) {
    throw new AppServiceError('VALIDATION', 'memberUserIds must not be empty');
  }

  const dialog = await Dialog.findOne({ tenantId, dialogId }).lean();
  if (!dialog) {
    throw new AppServiceError('NOT_FOUND', 'Dialog not found');
  }

  const addedUserIds: string[] = [];
  for (const memberUserId of memberUserIds) {
    const result = await addMemberWithEvent({
      tenantId,
      dialogId,
      memberUserId,
      actorId,
      actorType: 'user'
    });
    if (result.added) {
      addedUserIds.push(result.userId);
    }
  }

  const loaded = await loadDialogResult(tenantId, dialogId);
  return {
    addedUserIds,
    dialog: sanitizeResponse(loaded) as AddDialogMembersResult["dialog"]
  };
}
