import { Dialog, DialogMember } from '@chat3/models';
import { AppServiceError } from '../errors/AppServiceError.js';
import {
  assertActorIsMember,
  loadDialogResult,
  normalizeUserId,
  removeMemberWithEvent
} from './dialogHelpers.js';
import { sanitizeResponse } from '@chat3/utils/responseUtils.js';

export interface RemoveDialogMemberInput {
  tenantId: string;
  userId: string;
  dialogId: string;
  memberUserId: string;
}

export interface RemoveDialogMemberResult {
  dialog: {
    dialogId: string;
    tenantId: string;
    createdAt: number;
    meta: Record<string, unknown>;
    memberUserIds: string[];
  };
}

export async function removeDialogMemberService(
  input: RemoveDialogMemberInput
): Promise<RemoveDialogMemberResult> {
  const tenantId = input.tenantId;
  const actorId = normalizeUserId(input.userId);
  const dialogId = String(input.dialogId || '').trim();
  const memberUserId = normalizeUserId(input.memberUserId);

  if (!tenantId || !actorId || !dialogId || !memberUserId) {
    throw new AppServiceError(
      'VALIDATION',
      'tenantId, userId, dialogId and memberUserId are required'
    );
  }

  const dialog = await Dialog.findOne({ tenantId, dialogId }).lean();
  if (!dialog) {
    throw new AppServiceError('NOT_FOUND', 'Dialog not found');
  }

  await assertActorIsMember(tenantId, dialogId, actorId);

  const memberCount = await DialogMember.countDocuments({ tenantId, dialogId });
  if (memberCount <= 1) {
    throw new AppServiceError('FORBIDDEN', 'Cannot remove the last member from a dialog');
  }

  await removeMemberWithEvent({
    tenantId,
    dialogId,
    memberUserId,
    actorId,
    actorType: 'user'
  });

  const loaded = await loadDialogResult(tenantId, dialogId);
  return { dialog: sanitizeResponse(loaded) as RemoveDialogMemberResult["dialog"] };
}
