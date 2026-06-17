import { Event } from '@chat3/models';
import type { EventType, EntityType, ActorType, IEvent, UpdateType } from '@chat3/models';
import { createEventWithOutbox } from './outboxUtils.js';

const EVENT_CONTEXT_VERSION = 3;
const UPDATE_CONTEXT_VERSION = 4;

export type UiTarget = 'messages.list' | 'dialogs.list' | 'users.list';

const UI_TARGET_BY_EVENT_TYPE: Partial<Record<EventType, UiTarget>> = {
  'message.create': 'messages.list',
  'message.changed': 'messages.list',
  'message.status.changed': 'messages.list',
  'message.reaction.changed': 'messages.list',
  'dialog.typing': 'messages.list',
  'dialog.create': 'dialogs.list',
  'dialog.changed': 'dialogs.list',
  'dialog.delete': 'dialogs.list',
  'dialog.member.add': 'dialogs.list',
  'dialog.member.remove': 'dialogs.list',
  'dialog.member.changed': 'dialogs.list',
  'dialog.topic.create': 'dialogs.list',
  'dialog.topic.changed': 'dialogs.list',
  'user.add': 'users.list',
  'user.changed': 'users.list',
  'user.remove': 'users.list',
  'pack.changed': 'dialogs.list'
};

/** UI target для Event.data.context (v3) */
export function resolveUiTargetForEvent(eventType: EventType | string): UiTarget | null {
  return UI_TARGET_BY_EVENT_TYPE[eventType as EventType] ?? null;
}

/** @deprecated use resolveUiTargetForEvent */
export function resolveUiTarget(eventType: string): UiTarget | null {
  return resolveUiTargetForEvent(eventType);
}

/** UI target для Update.data.context (v4) */
export function resolveUiTargetForUpdate(
  updateType: UpdateType,
  sourceEventType: EventType | string
): UiTarget {
  switch (updateType) {
    case 'update.message':
      return 'messages.list';
    case 'update.user':
      return 'users.list';
    case 'update.dialog':
      return sourceEventType === 'dialog.typing' ? 'messages.list' : 'dialogs.list';
    default:
      return 'dialogs.list';
  }
}

/**
 * Финализация Update.data.context (v4): uiTarget + version, без lineage в context.
 */
export function finalizeUpdateContext(
  context: Record<string, unknown>,
  updateType: UpdateType,
  sourceEventType: EventType | string
): Record<string, unknown> {
  const {
    eventType: _dropEventType,
    sourceEventType: _dropSource,
    sourceEventId: _dropEventId,
    uiTarget: explicitUiTarget,
    ...rest
  } = context;

  const uiTarget =
    (explicitUiTarget as UiTarget | undefined)
    ?? resolveUiTargetForUpdate(updateType, sourceEventType);

  return {
    ...rest,
    version: UPDATE_CONTEXT_VERSION,
    uiTarget
  };
}

function uniqueList<T>(values: T[] = []): T[] {
  return Array.from(new Set((values || []).filter(Boolean)));
}

interface BuildEventContextParams {
  eventType: EventType;
  dialogId?: string | null;
  entityId?: string | null;
  messageId?: string | null;
  packId?: string | null;
  userId?: string | null;
  includedSections?: string[];
  updatedFields?: string[];
  uiTarget?: UiTarget | null;
  sourceEventType?: string | null;
  sourceEventId?: string | null;
}

export function buildEventContext({
  eventType,
  dialogId = null,
  entityId = null,
  messageId = null,
  packId = null,
  userId = null,
  includedSections = [],
  updatedFields = [],
  uiTarget = null,
  sourceEventType = null,
  sourceEventId = null
}: BuildEventContextParams): {
  version: number;
  eventType: EventType;
  dialogId: string | null;
  entityId: string | null;
  messageId: string | null;
  packId: string | null;
  userId: string | null;
  includedSections: string[];
  updatedFields: string[];
  uiTarget?: UiTarget;
  sourceEventType?: string;
  sourceEventId?: string;
} {
  const resolvedUiTarget = uiTarget ?? resolveUiTargetForEvent(eventType) ?? undefined;
  return {
    version: EVENT_CONTEXT_VERSION,
    eventType,
    dialogId: dialogId ?? null,
    entityId: entityId ?? null,
    messageId: messageId ?? null,
    packId: packId ?? null,
    userId: userId ?? null,
    includedSections: uniqueList(includedSections),
    updatedFields: uniqueList(updatedFields),
    ...(resolvedUiTarget ? { uiTarget: resolvedUiTarget } : {}),
    ...(sourceEventType ? { sourceEventType } : {}),
    ...(sourceEventId ? { sourceEventId } : {})
  };
}

interface BuildDialogSectionParams {
  dialogId: string;
  tenantId?: string | null;
  createdBy?: string | null;
  createdAt?: number | null;
  meta?: Record<string, unknown>;
}

export function buildDialogSection({
  dialogId,
  tenantId = null,
  createdBy = null,
  createdAt = null,
  meta = {}
}: BuildDialogSectionParams): {
  dialogId: string;
  tenantId: string | null;
  createdBy: string | null;
  createdAt: number | null;
  meta: Record<string, unknown>;
} | null {
  if (!dialogId) {
    return null;
  }

  // Убеждаемся, что meta всегда является объектом (не null, не undefined)
  const metaObject = meta && typeof meta === 'object' && !Array.isArray(meta) ? meta : {};

  return {
    dialogId,
    tenantId,
    createdBy,
    createdAt,
    meta: metaObject
  };
}

interface BuildMemberSectionParams {
  userId: string;
  meta?: Record<string, unknown>;
  state?: {
    unreadCount?: number | null;
    lastSeenAt?: number | null;
    lastMessageAt?: number | null;
  };
}

export function buildMemberSection({
  userId,
  meta = {},
  state = {}
}: BuildMemberSectionParams): {
  userId: string;
  meta: Record<string, unknown>;
  state: {
    unreadCount: number | null;
    lastSeenAt: number | null;
    lastMessageAt: number | null;
  };
} | null {
  if (!userId) {
    return null;
  }

  return {
    userId,
    meta: meta || {},
    state: {
      unreadCount: state.unreadCount ?? null,
      lastSeenAt: state.lastSeenAt ?? null,
      lastMessageAt: state.lastMessageAt ?? null
    }
  };
}

interface BuildTopicSectionParams {
  topicId: string;
  dialogId?: string | null;
  createdAt?: number | null;
  meta?: Record<string, unknown>;
}

export function buildTopicSection({
  topicId,
  dialogId = null,
  createdAt = null,
  meta = {}
}: BuildTopicSectionParams): {
  topicId: string;
  dialogId: string | null;
  createdAt: number | null;
  meta: Record<string, unknown>;
} | null {
  if (!topicId) {
    return null;
  }

  // Убеждаемся, что meta всегда является объектом (не null, не undefined)
  const metaObject = meta && typeof meta === 'object' && !Array.isArray(meta) ? meta : {};

  return {
    topicId,
    dialogId,
    createdAt,
    meta: metaObject
  };
}

interface BuildPackSectionParams {
  packId: string;
  tenantId?: string | null;
  createdAt?: number | null;
  meta?: Record<string, unknown>;
  stats?: {
    dialogCount?: number;
    messageCount?: number;
    uniqueMemberCount?: number;
    sumMemberCount?: number;
    uniqueTopicCount?: number;
    sumTopicCount?: number;
  } | null;
}

export function buildPackSection({
  packId,
  tenantId = null,
  createdAt = null,
  meta = {},
  stats = null
}: BuildPackSectionParams): Record<string, unknown> | null {
  if (!packId) {
    return null;
  }

  const metaObject = meta && typeof meta === 'object' && !Array.isArray(meta) ? meta : {};

  const payload: Record<string, unknown> = {
    packId,
    tenantId,
    createdAt,
    meta: metaObject
  };

  if (stats) {
    payload.stats = {
      dialogCount: stats.dialogCount ?? 0,
      messageCount: stats.messageCount ?? 0,
      uniqueMemberCount: stats.uniqueMemberCount ?? 0,
      sumMemberCount: stats.sumMemberCount ?? 0,
      uniqueTopicCount: stats.uniqueTopicCount ?? 0,
      sumTopicCount: stats.sumTopicCount ?? 0
    };
  }

  return payload;
}

interface BuildPackStatsSectionParams {
  packId: string;
  messageCount?: number | null;
  uniqueMemberCount?: number | null;
  sumMemberCount?: number | null;
  uniqueTopicCount?: number | null;
  sumTopicCount?: number | null;
  dialogCount?: number | null;
  lastUpdatedAt?: number | null;
}

export function buildPackStatsSection({
  packId,
  messageCount = null,
  uniqueMemberCount = null,
  sumMemberCount = null,
  uniqueTopicCount = null,
  sumTopicCount = null,
  dialogCount = null,
  lastUpdatedAt = null
}: BuildPackStatsSectionParams): Record<string, unknown> | null {
  if (!packId) {
    return null;
  }

  return {
    packId,
    messageCount: messageCount ?? 0,
    uniqueMemberCount: uniqueMemberCount ?? 0,
    sumMemberCount: sumMemberCount ?? 0,
    uniqueTopicCount: uniqueTopicCount ?? 0,
    sumTopicCount: sumTopicCount ?? 0,
    dialogCount: dialogCount ?? 0,
    lastUpdatedAt: lastUpdatedAt ?? null
  };
}

/** Элемент массива unreadBySenderType (fromType + countUnread). Совпадает с packStatsUtils.UnreadBySenderTypeItem. */
interface UnreadBySenderTypeItemSection {
  fromType: string;
  countUnread: number;
}

interface BuildUserPackStatsSectionParams {
  tenantId?: string | null;
  packId: string;
  userId: string;
  unreadCount?: number | null;
  lastUpdatedAt?: number | null;
  unreadBySenderType?: UnreadBySenderTypeItemSection[] | null;
}

export function buildUserPackStatsSection({
  tenantId = null,
  packId,
  userId,
  unreadCount = null,
  lastUpdatedAt = null,
  unreadBySenderType = null
}: BuildUserPackStatsSectionParams): Record<string, unknown> | null {
  if (!packId || !userId) return null;
  const section: Record<string, unknown> = {
    tenantId,
    packId,
    userId,
    unreadCount: unreadCount ?? 0,
    lastUpdatedAt: lastUpdatedAt ?? null
  };
  if (unreadBySenderType && unreadBySenderType.length > 0) {
    section.unreadBySenderType = unreadBySenderType;
  }
  return section;
}

interface BuildMessageSectionParams {
  messageId: string;
  dialogId?: string | null;
  senderId?: string | null;
  type?: string | null;
  content?: string | null;
  meta?: Record<string, unknown>;
  quotedMessage?: unknown | null;
  statusUpdate?: unknown | null;
  reactionUpdate?: unknown | null;
  statusMessageMatrix?: unknown | null;
  topicId?: string | null;
  topic?: unknown | null;
}

export function buildMessageSection({
  messageId,
  dialogId = null,
  senderId = null,
  type = null,
  content = null,
  meta = {},
  quotedMessage = null,
  statusUpdate = null,
  reactionUpdate = null,
  statusMessageMatrix = null,
  topicId = null,
  topic = null
}: BuildMessageSectionParams): Record<string, unknown> | null {
  if (!messageId) {
    return null;
  }

  const result: Record<string, unknown> = {
    messageId,
    dialogId,
    senderId,
    type,
    content,
    meta: meta || {},
    topicId: topicId ?? null,
    topic: topic ?? null
  };

  // Добавляем quotedMessage только если он передан
  if (quotedMessage !== null && quotedMessage !== undefined) {
    result.quotedMessage = quotedMessage;
  }

  // Добавляем statusUpdate только если он передан
  if (statusUpdate !== null && statusUpdate !== undefined) {
    result.statusUpdate = statusUpdate;
  }

  // Добавляем reactionUpdate только если он передан (не null и не undefined)
  if (reactionUpdate !== null && reactionUpdate !== undefined) {
    result.reactionUpdate = reactionUpdate;
  }

  // Добавляем statusMessageMatrix только если он передан
  if (statusMessageMatrix !== null && statusMessageMatrix !== undefined) {
    result.statusMessageMatrix = statusMessageMatrix;
  }

  return result;
}

interface BuildTypingSectionParams {
  userId: string;
  expiresInMs?: number | null;
  timestamp?: number | null;
  userInfo?: unknown | null;
}

export function buildTypingSection({
  userId,
  expiresInMs = null,
  timestamp = null,
  userInfo = null
}: BuildTypingSectionParams): {
  userId: string;
  expiresInMs: number | null;
  timestamp: number | null;
  userInfo: unknown | null;
} | null {
  if (!userId) {
    return null;
  }

  return {
    userId,
    expiresInMs,
    timestamp,
    userInfo: userInfo || null
  };
}

interface BuildActorSectionParams {
  actorId: string;
  actorType?: ActorType;
  info?: unknown | null;
}

export function buildActorSection({
  actorId,
  actorType = 'user',
  info = null
}: BuildActorSectionParams): {
  actorId: string;
  actorType: ActorType;
  info: unknown | null;
} | null {
  if (!actorId) {
    return null;
  }

  return {
    actorId,
    actorType,
    info: info || null
  };
}

interface BuildUserSectionParams {
  userId: string;
  type?: string | null;
  meta?: Record<string, unknown>;
  stats?: {
    dialogCount?: number;
    unreadDialogsCount?: number;
    totalUnreadCount?: number;
    totalMessagesCount?: number;
    statsVersion?: number;
    lastUpdatedAt?: number;
    unreadBySenderType?: Array<{ fromType: string; countUnread: number }>;
    'packs.messages.totalUnreadCount'?: number;
    'packs.messages.unreadBySenderType'?: Array<{ fromType: string; countUnread: number }>;
    'packs.messages.lastUpdatedAt'?: number;
  };
}

export function buildUserSection({
  userId,
  type = null,
  meta = {},
  stats = {}
}: BuildUserSectionParams): {
  userId: string;
  type: string | null;
  meta: Record<string, unknown>;
  stats?: {
    dialogCount: number;
    unreadDialogsCount: number;
    totalUnreadCount: number;
    totalMessagesCount: number;
    unreadBySenderType?: Array<{ fromType: string; countUnread: number }>;
  };
} | null {
  if (!userId) {
    return null;
  }

  const metaObject = meta && typeof meta === 'object' && !Array.isArray(meta) ? meta : {};

  const userSection: {
    userId: string;
    type: string | null;
    meta: Record<string, unknown>;
    stats?: {
      dialogCount: number;
      unreadDialogsCount: number;
      totalUnreadCount: number;
      totalMessagesCount: number;
      statsVersion?: number;
      lastUpdatedAt?: number;
      unreadBySenderType?: Array<{ fromType: string; countUnread: number }>;
      'packs.messages.totalUnreadCount'?: number;
      'packs.messages.unreadBySenderType'?: Array<{ fromType: string; countUnread: number }>;
      'packs.messages.lastUpdatedAt'?: number;
    };
  } = {
    userId,
    type,
    meta: metaObject
  };

  if (stats && (stats.dialogCount !== undefined || stats.unreadDialogsCount !== undefined || stats.totalUnreadCount !== undefined || stats.totalMessagesCount !== undefined || stats.statsVersion !== undefined || stats.lastUpdatedAt !== undefined || stats.unreadBySenderType !== undefined || stats['packs.messages.totalUnreadCount'] !== undefined || stats['packs.messages.unreadBySenderType'] !== undefined || stats['packs.messages.lastUpdatedAt'] !== undefined)) {
    userSection.stats = {
      dialogCount: stats.dialogCount ?? 0,
      unreadDialogsCount: stats.unreadDialogsCount ?? 0,
      totalUnreadCount: stats.totalUnreadCount ?? 0,
      totalMessagesCount: stats.totalMessagesCount ?? 0
    };
    if (stats.statsVersion !== undefined) {
      userSection.stats.statsVersion = stats.statsVersion;
    }
    if (stats.lastUpdatedAt !== undefined) {
      userSection.stats.lastUpdatedAt = stats.lastUpdatedAt;
    }
    if (stats.unreadBySenderType && Array.isArray(stats.unreadBySenderType)) {
      userSection.stats.unreadBySenderType = stats.unreadBySenderType;
    }
    if (stats['packs.messages.totalUnreadCount'] !== undefined) {
      userSection.stats['packs.messages.totalUnreadCount'] = stats['packs.messages.totalUnreadCount'];
    }
    if (stats['packs.messages.unreadBySenderType'] && Array.isArray(stats['packs.messages.unreadBySenderType'])) {
      userSection.stats['packs.messages.unreadBySenderType'] = stats['packs.messages.unreadBySenderType'];
    }
    if (stats['packs.messages.lastUpdatedAt'] !== undefined) {
      userSection.stats['packs.messages.lastUpdatedAt'] = stats['packs.messages.lastUpdatedAt'];
    }
  }

  return userSection;
}

interface ComposeEventDataParams {
  context: ReturnType<typeof buildEventContext>;
  dialog?: ReturnType<typeof buildDialogSection> | null;
  member?: ReturnType<typeof buildMemberSection> | null;
  message?: ReturnType<typeof buildMessageSection> | null;
  user?: ReturnType<typeof buildUserSection> | null;
  typing?: ReturnType<typeof buildTypingSection> | null;
  actor?: ReturnType<typeof buildActorSection> | null;
  topic?: ReturnType<typeof buildTopicSection> | null;
  pack?: ReturnType<typeof buildPackSection> | null;
  packStats?: ReturnType<typeof buildPackStatsSection> | null;
  userPackStats?: ReturnType<typeof buildUserPackStatsSection> | null;
  extra?: Record<string, unknown>;
}

export function composeEventData({
  context,
  dialog = null,
  member = null,
  message = null,
  user = null,
  typing = null,
  actor = null,
  topic = null,
  pack = null,
  packStats = null,
  userPackStats = null,
  extra = {}
}: ComposeEventDataParams): Record<string, unknown> {
  if (!context) {
    throw new Error('Event context is required');
  }

  const payload: Record<string, unknown> = {
    context
  };

  if (dialog) {
    payload.dialog = dialog;
    // Убеждаемся, что meta всегда присутствует в dialog
    const dialogObj = dialog as { meta?: unknown };
    if (!dialogObj.meta || typeof dialogObj.meta !== 'object' || Array.isArray(dialogObj.meta)) {
      dialogObj.meta = {};
    }
  }

  if (member) {
    payload.member = member;
  }

  if (message) {
    payload.message = message;
  }

  if (typing) {
    payload.typing = typing;
  }

  if (user) {
    payload.user = user;
  }

  if (actor) {
    payload.actor = actor;
  }

  if (topic) {
    payload.topic = topic;
  }

  if (pack) {
    payload.pack = pack;
  }

  if (packStats) {
    payload.packStats = packStats;
  }

  if (userPackStats) {
    payload.userPackStats = userPackStats;
  }

  return {
    ...payload,
    ...extra
  };
}

interface CreateEventParams {
  tenantId: string;
  eventType: EventType;
  entityType: EntityType;
  entityId: string;
  actorId?: string;
  actorType?: ActorType;
  data?: Record<string, unknown>;
}

/**
 * Создает событие в системе
 */
export async function createEvent({
  tenantId,
  eventType,
  entityType,
  entityId,
  actorId,
  actorType = 'user',
  data = {}
}: CreateEventParams): Promise<IEvent | null> {
  const dataCopy = JSON.parse(JSON.stringify(data)) as Record<string, unknown>;
  const dialogObj = dataCopy.dialog as { meta?: unknown } | undefined;
  if (dialogObj && (!dialogObj.meta || typeof dialogObj.meta !== 'object' || Array.isArray(dialogObj.meta))) {
    dialogObj.meta = {};
  }
  return createEventWithOutbox({
    tenantId,
    eventType,
    entityType,
    entityId,
    actorId,
    actorType,
    data: dataCopy
  });
}

interface GetEntityEventsOptions {
  limit?: number;
  sort?: Record<string, 1 | -1>;
  eventType?: EventType | null;
}

/**
 * Получает события для конкретной сущности
 */
export async function getEntityEvents(
  tenantId: string, 
  entityType: EntityType, 
  entityId: string, 
  options: GetEntityEventsOptions = {}
): Promise<unknown[]> {
  const {
    limit = 50,
    sort = { createdAt: -1 },
    eventType = null
  } = options;

  const query: {
    tenantId: string;
    entityType: EntityType;
    entityId: string;
    eventType?: EventType;
  } = {
    tenantId,
    entityType,
    entityId
  };

  if (eventType) {
    query.eventType = eventType;
  }

  return await Event.find(query)
    .sort(sort)
    .limit(limit)
    .lean();
}

interface GetEventsByTypeOptions {
  limit?: number;
  skip?: number;
  sort?: Record<string, 1 | -1>;
}

/**
 * Получает события определенного типа
 */
export async function getEventsByType(
  tenantId: string, 
  eventType: EventType, 
  options: GetEventsByTypeOptions = {}
): Promise<unknown[]> {
  const {
    limit = 50,
    skip = 0,
    sort = { createdAt: -1 }
  } = options;

  return await Event.find({
    tenantId,
    eventType
  })
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .lean();
}

interface GetUserEventsOptions {
  limit?: number;
  skip?: number;
  sort?: Record<string, 1 | -1>;
  eventType?: EventType | null;
}

/**
 * Получает события пользователя
 */
export async function getUserEvents(
  tenantId: string, 
  actorId: string, 
  options: GetUserEventsOptions = {}
): Promise<unknown[]> {
  const {
    limit = 50,
    skip = 0,
    sort = { createdAt: -1 },
    eventType = null
  } = options;

  const query: {
    tenantId: string;
    actorId: string;
    eventType?: EventType;
  } = {
    tenantId,
    actorId
  };

  if (eventType) {
    query.eventType = eventType;
  }

  return await Event.find(query)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .lean();
}

interface GetAllEventsOptions {
  page?: number;
  limit?: number;
  sort?: Record<string, 1 | -1>;
}

/**
 * Получает все события с фильтрацией и пагинацией
 */
export async function getAllEvents(
  tenantId: string, 
  filters: Record<string, unknown> = {}, 
  options: GetAllEventsOptions = {}
): Promise<{
  events: unknown[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}> {
  const {
    page = 1,
    limit = 50,
    sort = { createdAt: -1 }
  } = options;

  const skip = (page - 1) * limit;

  const query = {
    tenantId,
    ...filters
  };

  const [events, total] = await Promise.all([
    Event.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Event.countDocuments(query)
  ]);

  return {
    events,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
}

/**
 * Удаляет старые события (для очистки истории)
 */
export async function deleteOldEvents(tenantId: string, beforeDate: number): Promise<number> {
  const result = await Event.deleteMany({
    tenantId,
    createdAt: { $lt: beforeDate }
  });

  return result.deletedCount;
}

interface GetEventStatsOptions {
  startDate?: number | null;
  endDate?: number | null;
}

/**
 * Получает статистику по событиям
 */
export async function getEventStats(
  tenantId: string, 
  options: GetEventStatsOptions = {}
): Promise<unknown[]> {
  const {
    startDate = null,
    endDate = null
  } = options;

  const matchStage: {
    tenantId: string;
    createdAt?: {
      $gte?: number;
      $lte?: number;
    };
  } = { tenantId };

  if (startDate) {
    matchStage.createdAt = { $gte: startDate };
  }

  if (endDate) {
    if (!matchStage.createdAt) {
      matchStage.createdAt = {};
    }
    matchStage.createdAt.$lte = endDate;
  }

  return await Event.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$eventType',
        count: { $sum: 1 },
        lastEvent: { $max: '$createdAt' }
      }
    },
    {
      $project: {
        eventType: '$_id',
        count: 1,
        lastEvent: 1,
        _id: 0
      }
    },
    { $sort: { count: -1 } }
  ]);
}

export default {
  createEvent,
  getEntityEvents,
  getEventsByType,
  getUserEvents,
  getAllEvents,
  deleteOldEvents,
  getEventStats,
  buildEventContext,
  buildDialogSection,
  buildMemberSection,
  buildTopicSection,
  buildMessageSection,
  buildTypingSection,
  buildActorSection,
  buildPackSection,
  buildPackStatsSection,
  buildUserPackStatsSection,
  composeEventData
};
