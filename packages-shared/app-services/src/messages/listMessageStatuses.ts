import { DialogMember, Message, MessageStatus } from '@chat3/models';
import { sanitizeResponse } from '@chat3/utils/responseUtils.js';
import { AppServiceError } from '../errors/AppServiceError.js';
import { normalizeUserId } from '../dialogs/dialogHelpers.js';

export interface ListMessageStatusesInput {
  tenantId: string;
  userId: string;
  dialogId: string;
  messageId: string;
  page?: number;
  limit?: number;
}

export interface ListMessageStatusesPagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface ListMessageStatusesResult {
  data: any[];
  pagination: ListMessageStatusesPagination;
}

/**
 * Paginated message status history. Requester must be a dialog member.
 */
export async function listMessageStatuses(
  input: ListMessageStatusesInput
): Promise<ListMessageStatusesResult> {
  const tenantId = input.tenantId;
  const userId = normalizeUserId(input.userId);
  const dialogId = String(input.dialogId || '').trim().toLowerCase();
  const messageId = String(input.messageId || '').trim().toLowerCase();

  if (!tenantId || !userId || !dialogId || !messageId) {
    throw new AppServiceError(
      'VALIDATION',
      'tenantId, userId, dialogId and messageId are required'
    );
  }

  const page = input.page && input.page > 0 ? input.page : 1;
  const limit = input.limit && input.limit > 0 ? input.limit : 50;
  const skip = (page - 1) * limit;

  const member = await DialogMember.findOne({ tenantId, dialogId, userId })
    .select('userId')
    .lean();
  if (!member) {
    throw new AppServiceError('FORBIDDEN', 'User is not a member of this dialog');
  }

  const message = await Message.findOne({ tenantId, dialogId, messageId })
    .select('messageId')
    .lean();
  if (!message) {
    throw new AppServiceError('NOT_FOUND', 'Message not found');
  }

  const [total, statuses] = await Promise.all([
    MessageStatus.countDocuments({ tenantId, messageId }),
    MessageStatus.find({ tenantId, messageId })
      .select('messageId userId userType tenantId status createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
  ]);

  return {
    data: sanitizeResponse(statuses) as any[],
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 0
    }
  };
}
