import { Dialog, DialogMember } from '@chat3/models';
import { AppServiceError } from '../errors/AppServiceError.js';
import { assertActorIsMember, normalizeUserId } from './dialogHelpers.js';

export interface ListDialogMembersInput {
  tenantId: string;
  dialogId: string;
  page?: number;
  limit?: number;
  /** When set, requester must be a member. */
  userId?: string;
}

export interface ListDialogMemberRow {
  userId: string;
  joinedAt: number;
}

export interface ListDialogMembersResult {
  memberUserIds: string[];
  members: ListDialogMemberRow[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Paginated list of dialog members (userIds + joinedAt).
 */
export async function listDialogMembers(
  input: ListDialogMembersInput
): Promise<ListDialogMembersResult> {
  const tenantId = input.tenantId;
  const dialogId = String(input.dialogId || '').trim();
  const page = Math.max(1, Number(input.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(input.limit) || 50));
  const requesterId = input.userId ? normalizeUserId(input.userId) : '';

  if (!tenantId || !dialogId) {
    throw new AppServiceError('VALIDATION', 'tenantId and dialogId are required');
  }

  const exists = await Dialog.findOne({ tenantId, dialogId }).select('dialogId').lean();
  if (!exists) {
    throw new AppServiceError('NOT_FOUND', `Dialog '${dialogId}' not found`);
  }

  if (requesterId) {
    await assertActorIsMember(tenantId, dialogId, requesterId);
  }

  const filter = { tenantId, dialogId };
  const total = await DialogMember.countDocuments(filter);
  const totalPages = Math.max(1, Math.ceil(total / limit) || 1);
  const skip = (page - 1) * limit;

  const rows = await DialogMember.find(filter)
    .select('userId createdAt')
    .sort({ userId: 1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const members: ListDialogMemberRow[] = rows.map((r) => ({
    userId: r.userId,
    joinedAt: r.createdAt || 0
  }));

  return {
    memberUserIds: members.map((m) => m.userId),
    members,
    page,
    limit,
    total,
    totalPages
  };
}
