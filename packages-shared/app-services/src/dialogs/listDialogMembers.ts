import { Dialog, DialogMember } from '@chat3/models';
import { AppServiceError } from '../errors/AppServiceError.js';

export interface ListDialogMembersInput {
  tenantId: string;
  dialogId: string;
  page?: number;
  limit?: number;
}

export interface ListDialogMembersResult {
  memberUserIds: string[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Paginated list of dialog member userIds.
 */
export async function listDialogMembers(
  input: ListDialogMembersInput
): Promise<ListDialogMembersResult> {
  const tenantId = input.tenantId;
  const dialogId = String(input.dialogId || '').trim();
  const page = Math.max(1, Number(input.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(input.limit) || 50));

  if (!tenantId || !dialogId) {
    throw new AppServiceError('VALIDATION', 'tenantId and dialogId are required');
  }

  const exists = await Dialog.findOne({ tenantId, dialogId }).select('dialogId').lean();
  if (!exists) {
    throw new AppServiceError('NOT_FOUND', `Dialog '${dialogId}' not found`);
  }

  const filter = { tenantId, dialogId };
  const total = await DialogMember.countDocuments(filter);
  const totalPages = Math.max(1, Math.ceil(total / limit) || 1);
  const skip = (page - 1) * limit;

  const rows = await DialogMember.find(filter)
    .select('userId')
    .sort({ userId: 1 })
    .skip(skip)
    .limit(limit)
    .lean();

  return {
    memberUserIds: rows.map((r) => r.userId),
    page,
    limit,
    total,
    totalPages
  };
}
