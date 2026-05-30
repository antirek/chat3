import { DialogMember } from '@chat3/models';
import type { CounterEventPayload } from './types.js';

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function normalizeUserId(userId: string | null | undefined): string {
  return (userId || '').trim().toLowerCase();
}

export function getContext(data: Record<string, unknown> | undefined): Record<string, unknown> | null {
  return asRecord(data?.context);
}

export function getDialogIdFromEvent(data: Record<string, unknown> | undefined): string | null {
  const ctx = getContext(data);
  if (ctx?.dialogId && typeof ctx.dialogId === 'string') {
    return ctx.dialogId;
  }
  const dialog = asRecord(data?.dialog);
  if (dialog?.dialogId && typeof dialog.dialogId === 'string') {
    return dialog.dialogId;
  }
  const message = asRecord(data?.message);
  if (message?.dialogId && typeof message.dialogId === 'string') {
    return message.dialogId;
  }
  return null;
}

export function getMessageIdFromEvent(data: Record<string, unknown> | undefined): string | null {
  const ctx = getContext(data);
  if (ctx?.messageId && typeof ctx.messageId === 'string') {
    return ctx.messageId;
  }
  const message = asRecord(data?.message);
  if (message?.messageId && typeof message.messageId === 'string') {
    return message.messageId;
  }
  return null;
}

export function getSenderIdFromEvent(data: Record<string, unknown> | undefined): string | null {
  const message = asRecord(data?.message);
  if (message?.senderId && typeof message.senderId === 'string') {
    return message.senderId;
  }
  return null;
}

export function getUserIdFromEvent(data: Record<string, unknown> | undefined): string | null {
  const ctx = getContext(data);
  if (ctx?.userId && typeof ctx.userId === 'string') {
    return ctx.userId;
  }
  const member = asRecord(data?.member);
  if (member?.userId && typeof member.userId === 'string') {
    return member.userId;
  }
  const message = asRecord(data?.message);
  const statusUpdate = asRecord(message?.statusUpdate);
  if (statusUpdate?.userId && typeof statusUpdate.userId === 'string') {
    return statusUpdate.userId;
  }
  return null;
}

export function getPackIdFromEvent(data: Record<string, unknown> | undefined): string | null {
  const ctx = getContext(data);
  if (ctx?.packId && typeof ctx.packId === 'string') {
    return ctx.packId;
  }
  const pack = asRecord(data?.pack);
  if (pack?.packId && typeof pack.packId === 'string') {
    return pack.packId;
  }
  return null;
}

export async function getDialogMemberUserIds(
  tenantId: string,
  dialogId: string,
  excludeUserId?: string | null
): Promise<string[]> {
  const members = await DialogMember.find({ tenantId, dialogId }).select('userId').lean();
  const exclude = excludeUserId ? normalizeUserId(excludeUserId) : null;
  const ids = new Set<string>();
  for (const m of members) {
    const uid = normalizeUserId((m as { userId?: string }).userId);
    if (!uid) continue;
    if (exclude && uid === exclude) continue;
    ids.add(uid);
  }
  return Array.from(ids);
}

export function toEventPayload(raw: unknown): CounterEventPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as Record<string, unknown>;
  if (typeof e.eventId !== 'string' || typeof e.tenantId !== 'string' || typeof e.eventType !== 'string') {
    return null;
  }
  return {
    eventId: e.eventId,
    tenantId: e.tenantId,
    eventType: e.eventType as CounterEventPayload['eventType'],
    entityType: String(e.entityType ?? ''),
    entityId: String(e.entityId ?? ''),
    actorId: typeof e.actorId === 'string' ? e.actorId : undefined,
    actorType: typeof e.actorType === 'string' ? e.actorType : undefined,
    data: asRecord(e.data) ?? undefined
  };
}
