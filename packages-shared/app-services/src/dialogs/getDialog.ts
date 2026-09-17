import { Dialog, DialogMember, DialogStats, UserDialogActivity, UserDialogStats } from '@chat3/models';
import { sanitizeResponse } from '@chat3/utils/responseUtils.js';
import { AppServiceError } from '../errors/AppServiceError.js';
import { loadDialogResult, normalizeUserId } from './dialogHelpers.js';

export interface GetDialogInput {
  tenantId: string;
  dialogId: string;
  /** When set, dialog is returned only if this user is a member; also fills member/stats. */
  userId?: string;
}

export interface DialogMemberContext {
  userId: string;
  state: {
    unreadCount: number;
    lastSeenAt: number;
    lastMessageAt: number;
    isActive: boolean;
    joinedAt: number;
  };
}

export interface DialogStatsLite {
  memberCount: number;
  messageCount: number;
  topicCount: number;
}

export interface GetDialogResult {
  dialog: {
    dialogId: string;
    tenantId: string;
    createdAt: number;
    meta: Record<string, unknown>;
    memberUserIds: string[];
  };
  /** Present when userId was provided and is a member. */
  member?: DialogMemberContext;
  /** Dialog-level counts (always filled when dialog exists). */
  stats?: DialogStatsLite;
}

/**
 * Load a dialog by id (meta + members). Optional membership gate via userId.
 * When userId is set, also returns requester member state (unread, activity).
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

  let membershipDoc: { createdAt?: number } | null = null;
  if (userId) {
    membershipDoc = await DialogMember.findOne({ tenantId, dialogId, userId })
      .select('createdAt')
      .lean();
    if (!membershipDoc) {
      throw new AppServiceError('FORBIDDEN', 'User is not a member of this dialog');
    }
  }

  const dialog = await loadDialogResult(tenantId, dialogId);

  const statsDoc = await DialogStats.findOne({ tenantId, dialogId }).lean();
  const stats: DialogStatsLite = {
    memberCount:
      statsDoc?.memberCount ??
      (Array.isArray(dialog.memberUserIds) ? dialog.memberUserIds.length : 0),
    messageCount: statsDoc?.messageCount ?? 0,
    topicCount: statsDoc?.topicCount ?? 0
  };

  let member: DialogMemberContext | undefined;
  if (userId && membershipDoc) {
    const [uds, activity] = await Promise.all([
      UserDialogStats.findOne({ tenantId, userId, dialogId }).select('unreadCount').lean(),
      UserDialogActivity.findOne({ tenantId, userId, dialogId })
        .select('lastSeenAt lastMessageAt')
        .lean()
    ]);
    member = {
      userId,
      state: {
        unreadCount: uds?.unreadCount ?? 0,
        lastSeenAt: activity?.lastSeenAt ?? 0,
        lastMessageAt: activity?.lastMessageAt ?? 0,
        isActive: true,
        joinedAt: membershipDoc.createdAt ?? 0
      }
    };
  }

  return {
    dialog: sanitizeResponse(dialog) as GetDialogResult['dialog'],
    member,
    stats
  };
}
