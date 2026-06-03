import * as updateUtils from '../updateUtils.js';
import { resolveEventIdFromMqPayload } from '../domainEventPayload.js';

export interface UpdateEventPayload {
  eventId?: unknown;
  _id?: unknown;
  tenantId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  actorId?: string;
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Идемпотентная обработка доменного события для update-worker (только domain Updates, без stats).
 */
export async function processUpdateEvent(eventData: UpdateEventPayload): Promise<void> {
  const {
    tenantId,
    eventType,
    entityType,
    entityId,
    data = {}
  } = eventData;

  const eventId = resolveEventIdFromMqPayload(eventData);
  if (!eventId) {
    console.warn(`⚠️ Missing eventId in event payload: ${eventType} (${entityId})`);
    return;
  }

  const context = (data.context || {}) as Record<string, unknown>;
  const dialogPayload = (data.dialog || {}) as Record<string, unknown>;
  const memberPayload = (data.member || {}) as Record<string, unknown>;
  const messagePayload = (data.message || {}) as Record<string, unknown>;
  const typingPayload = (data.typing || {}) as Record<string, unknown>;

  console.log(`📩 Processing event: ${eventType} (${entityId})`);

  if (eventType === 'pack.changed') {
    const packPayload = (data.pack || {}) as Record<string, unknown>;
    const ctx = data.context as Record<string, unknown> | undefined;
    const packId: string | null =
      (typeof packPayload.packId === 'string' ? packPayload.packId : null) ||
      (typeof ctx?.packId === 'string' ? ctx.packId : null) ||
      (entityType === 'pack' && typeof entityId === 'string' ? entityId : null);
    if (packId) {
      await updateUtils.createDialogUpdatesForPackChanged(tenantId, packId, eventId, data);
      console.log(`✅ Created DialogUpdates for pack.changed ${packId}`);
    } else {
      console.warn(`⚠️ No packId for pack.changed event ${eventId}`);
    }
    return;
  }

  const shouldUpdate = updateUtils.shouldCreateUpdate(eventType);

  if (shouldUpdate.dialog) {
    let dialogId = (context.dialogId || dialogPayload.dialogId) as string | undefined;

    if (!dialogId && entityType === 'dialog') {
      dialogId = entityId;
    } else if (!dialogId && entityType === 'dialogMember') {
      dialogId = entityId;
    }

    if (dialogId) {
      await updateUtils.createDialogUpdate(tenantId, dialogId, eventId, eventType, data);
      console.log(`✅ Created DialogUpdate for event ${eventId}`);
    } else {
      console.warn(`⚠️ No dialogId found for event ${eventId}`);
    }
  }

  if (shouldUpdate.dialogMember) {
    const dialogId = (context.dialogId || dialogPayload.dialogId) as string | undefined;
    const userId = (memberPayload.userId || data.userId) as string | undefined;

    if (dialogId && userId) {
      await updateUtils.createDialogMemberUpdate(tenantId, dialogId, userId, eventId, eventType, data);
      console.log(`✅ Created DialogMemberUpdate for user ${userId} in event ${eventId}`);
    } else {
      console.warn(`⚠️ No dialogId or userId found for event ${eventId}`);
    }
  }

  if (shouldUpdate.message) {
    let dialogId = (context.dialogId || dialogPayload.dialogId || messagePayload.dialogId) as string | undefined;
    let messageId = (context.messageId || messagePayload.messageId) as string | undefined;

    if (!dialogId && entityType === 'message') {
      dialogId = entityId;
    }
    if (!messageId && entityType === 'message') {
      messageId = entityId;
    }

    if (dialogId && messageId) {
      await updateUtils.createMessageUpdate(tenantId, dialogId, messageId, eventId, eventType, data);
      console.log(`✅ Created MessageUpdate for event ${eventId}`);
    } else {
      console.warn(`⚠️ No dialogId or messageId found for event ${eventId}`);
    }
  }

  if (shouldUpdate.typing) {
    const dialogId = (context.dialogId || dialogPayload.dialogId || entityId) as string | undefined;
    const typingUserId = (typingPayload.userId || memberPayload.userId || eventData.actorId) as string | undefined;

    if (dialogId && typingUserId) {
      await updateUtils.createTypingUpdate(tenantId, dialogId, typingUserId, eventId, eventType, data);
      console.log(`✅ Created TypingUpdate for dialog ${dialogId}`);
    } else {
      console.warn(`⚠️ Missing dialogId or userId for typing event ${eventId}`);
    }
  }

  if (shouldUpdate.user) {
    const userPayload = (data.user || {}) as Record<string, unknown>;
    const userId = (userPayload.userId || eventData.actorId || entityId) as string | undefined;

    if (userId) {
      await updateUtils.createUserUpdate(tenantId, userId, eventId, eventType, data);
      console.log(`✅ Created UserUpdate for user ${userId} from event ${eventId}`);
    } else {
      console.warn(`⚠️ No userId found for user event ${eventId}`);
    }
  }

  if (!shouldUpdate.dialog && !shouldUpdate.dialogMember && !shouldUpdate.message && !shouldUpdate.typing && !shouldUpdate.user) {
    console.log(`ℹ️ Event ${eventType} does not require update creation`);
  }
}
