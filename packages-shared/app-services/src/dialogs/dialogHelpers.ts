/** Shared helpers for dialog member mutations (events + membership). */

import {
  Dialog,
  DialogMember,
  Meta,
  User,
  UserDialogActivity,
  UserDialogStats,
  UserDialogUnreadBySenderType
} from '@chat3/models';
import * as eventUtils from '@chat3/utils/eventUtils.js';
import * as metaUtils from '@chat3/utils/metaUtils.js';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';
import { AppServiceError } from '../errors/AppServiceError.js';

export function normalizeUserId(userId: string): string {
  return String(userId || '').trim().toLowerCase();
}

/**
 * Require that actor is already a DialogMember. Throws FORBIDDEN otherwise.
 */
export async function assertActorIsMember(
  tenantId: string,
  dialogId: string,
  actorUserId: string
): Promise<void> {
  const userId = normalizeUserId(actorUserId);
  if (!userId) {
    throw new AppServiceError('VALIDATION', 'userId is required');
  }
  const membership = await DialogMember.findOne({ tenantId, dialogId, userId })
    .select('_id')
    .lean();
  if (!membership) {
    throw new AppServiceError('FORBIDDEN', 'User is not a member of this dialog');
  }
}

export async function ensureUserExists(
  tenantId: string,
  userId: string,
  options: { type?: string } = {}
): Promise<{ userId: string; tenantId: string; type: string; createdAt?: number; created: boolean }> {
  const normalized = normalizeUserId(userId);
  if (!normalized) {
    throw new AppServiceError('VALIDATION', 'userId is required');
  }

  let user = await User.findOne({ tenantId, userId: normalized }).lean();
  if (!user) {
    const created = await User.create({
      tenantId,
      userId: normalized,
      type: options.type || 'user',
      createdAt: generateTimestamp()
    });
    return {
      userId: created.userId,
      tenantId: created.tenantId,
      type: created.type,
      createdAt: created.createdAt,
      created: true
    };
  }

  if (options.type !== undefined && user.type !== options.type) {
    await User.updateOne({ tenantId, userId: normalized }, { $set: { type: options.type } });
    user = { ...user, type: options.type };
  }

  return {
    userId: user.userId,
    tenantId: user.tenantId,
    type: user.type,
    createdAt: user.createdAt,
    created: false
  };
}

export async function addMemberWithEvent(params: {
  tenantId: string;
  dialogId: string;
  memberUserId: string;
  actorId: string;
  actorType?: 'user' | 'api' | 'system';
  userType?: string;
}): Promise<{ added: boolean; userId: string }> {
  const { tenantId, dialogId, actorId } = params;
  const memberUserId = normalizeUserId(params.memberUserId);

  const existing = await DialogMember.findOne({ tenantId, dialogId, userId: memberUserId }).lean();
  if (existing) {
    return { added: false, userId: memberUserId };
  }

  await ensureUserExists(tenantId, memberUserId, { type: params.userType || 'user' });

  await DialogMember.create({ userId: memberUserId, tenantId, dialogId });

  const timestamp = generateTimestamp();
  await UserDialogActivity.findOneAndUpdate(
    { tenantId, userId: memberUserId, dialogId },
    {
      tenantId,
      userId: memberUserId,
      dialogId,
      lastSeenAt: timestamp,
      lastMessageAt: timestamp
    },
    { upsert: true, new: true }
  );

  const dialog = await Dialog.findOne({ tenantId, dialogId }).lean();
  if (!dialog) {
    throw new AppServiceError('NOT_FOUND', 'Dialog not found');
  }

  const dialogMeta = await metaUtils.getEntityMeta(tenantId, 'dialog', dialogId);
  const dialogSection = eventUtils.buildDialogSection({
    dialogId,
    tenantId,
    createdAt: dialog.createdAt,
    meta: dialogMeta || {}
  });

  const memberStats = await UserDialogStats.findOne({ tenantId, userId: memberUserId, dialogId }).lean();
  const memberActivity = await UserDialogActivity.findOne({
    tenantId,
    userId: memberUserId,
    dialogId
  }).lean();

  const memberSection = eventUtils.buildMemberSection({
    userId: memberUserId,
    state: {
      unreadCount: memberStats?.unreadCount || 0,
      lastSeenAt: memberActivity?.lastSeenAt || 0,
      lastMessageAt: memberActivity?.lastMessageAt || 0
    }
  });

  const memberEventContext = eventUtils.buildEventContext({
    eventType: 'dialog.member.add',
    dialogId,
    userId: memberUserId,
    entityId: `${dialogId}:${memberUserId}`,
    includedSections: ['dialog', 'member'],
    updatedFields: ['member']
  });

  await eventUtils.createEvent({
    tenantId,
    eventType: 'dialog.member.add',
    entityType: 'dialogMember',
    entityId: `${dialogId}:${memberUserId}`,
    actorId,
    actorType: params.actorType || 'user',
    data: eventUtils.composeEventData({
      context: memberEventContext,
      dialog: dialogSection,
      member: memberSection
    })
  });

  return { added: true, userId: memberUserId };
}

export async function removeMemberWithEvent(params: {
  tenantId: string;
  dialogId: string;
  memberUserId: string;
  actorId: string;
  actorType?: 'user' | 'api' | 'system';
}): Promise<void> {
  const { tenantId, dialogId, actorId } = params;
  const memberUserId = normalizeUserId(params.memberUserId);

  const dialog = await Dialog.findOne({ tenantId, dialogId }).lean();
  if (!dialog) {
    throw new AppServiceError('NOT_FOUND', 'Dialog not found');
  }

  const existing = await DialogMember.findOne({ tenantId, dialogId, userId: memberUserId }).lean();
  if (!existing) {
    throw new AppServiceError('NOT_FOUND', 'Member not found in dialog');
  }

  const dialogMeta = await metaUtils.getEntityMeta(tenantId, 'dialog', dialogId);
  const dialogSection = eventUtils.buildDialogSection({
    dialogId,
    tenantId,
    createdAt: dialog.createdAt,
    meta: dialogMeta || {}
  });

  const memberStats = await UserDialogStats.findOne({ tenantId, userId: memberUserId, dialogId }).lean();
  const memberActivity = await UserDialogActivity.findOne({
    tenantId,
    userId: memberUserId,
    dialogId
  }).lean();

  const memberSection = eventUtils.buildMemberSection({
    userId: memberUserId,
    state: {
      unreadCount: memberStats?.unreadCount || 0,
      lastSeenAt: memberActivity?.lastSeenAt || 0,
      lastMessageAt: memberActivity?.lastMessageAt || 0
    }
  });

  await UserDialogStats.deleteOne({ tenantId, userId: memberUserId, dialogId });
  await UserDialogUnreadBySenderType.deleteMany({ tenantId, userId: memberUserId, dialogId });
  await UserDialogActivity.deleteOne({ tenantId, userId: memberUserId, dialogId });
  await DialogMember.findOneAndDelete({ userId: memberUserId, tenantId, dialogId });

  const eventContext = eventUtils.buildEventContext({
    eventType: 'dialog.member.remove',
    dialogId,
    userId: memberUserId,
    entityId: `${dialogId}:${memberUserId}`,
    includedSections: ['dialog', 'member'],
    updatedFields: ['member']
  });

  await eventUtils.createEvent({
    tenantId,
    eventType: 'dialog.member.remove',
    entityType: 'dialogMember',
    entityId: `${dialogId}:${memberUserId}`,
    actorId,
    actorType: params.actorType || 'user',
    data: eventUtils.composeEventData({
      context: eventContext,
      dialog: dialogSection,
      member: memberSection
    })
  });
}

export async function loadDialogResult(tenantId: string, dialogId: string): Promise<{
  dialogId: string;
  tenantId: string;
  createdAt: number;
  meta: Record<string, unknown>;
  memberUserIds: string[];
}> {
  const dialog = await Dialog.findOne({ tenantId, dialogId }).lean();
  if (!dialog) {
    throw new AppServiceError('NOT_FOUND', 'Dialog not found');
  }
  const meta = (await metaUtils.getEntityMeta(tenantId, 'dialog', dialogId)) || {};
  const members = await DialogMember.find({ tenantId, dialogId }).select('userId').lean();
  return {
    dialogId: dialog.dialogId,
    tenantId: dialog.tenantId,
    createdAt: dialog.createdAt,
    meta,
    memberUserIds: members.map((m) => m.userId)
  };
}

export async function findDialogIdByMeta(
  tenantId: string,
  metaKey: string,
  metaValue: string
): Promise<string | null> {
  const key = String(metaKey || '').trim();
  const value = String(metaValue ?? '').trim();
  if (!tenantId || !key || value === '') return null;
  const record = await Meta.findOne({
    tenantId,
    entityType: 'dialog',
    key,
    value
  })
    .select('entityId')
    .lean();
  return record?.entityId || null;
}
