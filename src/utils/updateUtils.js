import mongoose from 'mongoose';
import { Dialog, Message, DialogMember, Meta, MessageStatus, User } from '../models/index.js';
import Update from '../models/Update.js';
import * as metaUtils from './metaUtils.js';
import * as rabbitmqUtils from './rabbitmqUtils.js';
import { sanitizeResponse } from './responseUtils.js';
import { generateTimestamp } from './timestampUtils.js';

const DEFAULT_TYPING_EXPIRES_MS = 5000;

const DIALOG_UPDATE_EVENTS = [
  'dialog.create',
  'dialog.update',
  'dialog.delete',
  'dialog.member.add',
  'dialog.member.remove'
];

const DIALOG_MEMBER_UPDATE_EVENTS = [
  'dialog.member.update'
];

const MESSAGE_UPDATE_EVENTS = [
  'message.create',
  'message.update',
  'message.delete',
  'message.reaction.add',
  'message.reaction.update',
  'message.reaction.remove',
  'message.status.create',
  'message.status.update'
];

const TYPING_EVENTS = [
  'dialog.typing'
];

function buildDialogSection(dialog, dialogMeta = {}) {
  if (!dialog) {
    return null;
  }

  return {
    dialogId: dialog.dialogId,
    tenantId: dialog.tenantId,
    name: dialog.name,
    createdBy: dialog.createdBy,
    createdAt: dialog.createdAt,
    updatedAt: dialog.updatedAt,
    meta: dialogMeta || {}
  };
}

function buildMemberSection(member, memberMeta = {}, overrides = {}) {
  if (!member) {
    return null;
  }

  const state = {
    unreadCount: overrides.unreadCount ?? member.unreadCount ?? null,
    lastSeenAt: overrides.lastSeenAt ?? member.lastSeenAt ?? null,
    lastMessageAt: overrides.lastMessageAt ?? member.lastMessageAt ?? null,
    isActive: overrides.isActive ?? member.isActive ?? null
  };

  return {
    userId: member.userId,
    meta: memberMeta || {},
    state
  };
}

function buildContextSection({
  eventType,
  dialogId,
  entityId,
  messageId = null,
  reason = null,
  includedSections = [],
  updatedFields = []
}) {
  const context = {
    eventType,
    dialogId,
    entityId,
    includedSections,
    updatedFields
  };

  if (messageId) {
    context.messageId = messageId;
  }

  if (reason) {
    context.reason = reason;
  }

  return context;
}

function cloneSection(section) {
  if (!section) {
    return null;
  }

  if (typeof structuredClone === 'function') {
    return structuredClone(section);
  }

  return JSON.parse(JSON.stringify(section));
}

async function getSenderInfo(tenantId, senderId, cache = new Map()) {
  if (!senderId) {
    return null;
  }

  if (cache.has(senderId)) {
    return cache.get(senderId);
  }

  const user = await User.findOne({
    tenantId,
    userId: senderId
  })
    .select('userId name lastActiveAt createdAt updatedAt')
    .lean();

  const userMeta = await metaUtils.getEntityMeta(tenantId, 'user', senderId);

  if (!user && (!userMeta || Object.keys(userMeta).length === 0)) {
    cache.set(senderId, null);
    return null;
  }

  const senderInfo = {
    userId: senderId,
    name: user?.name || null,
    lastActiveAt: user?.lastActiveAt ?? null,
    createdAt: user?.createdAt ?? null,
    updatedAt: user?.updatedAt ?? null,
    meta: userMeta
  };

  cache.set(senderId, senderInfo);
  return senderInfo;
}

async function buildFullMessagePayload(tenantId, message, senderCache = new Map()) {
  if (!message) {
    return null;
  }

  const messageObj = message.toObject ? message.toObject() : message;

  const meta = (await metaUtils.getEntityMeta(tenantId, 'message', messageObj.messageId)) || {};

  const statuses = await MessageStatus.find({
    tenantId,
    messageId: messageObj.messageId
  })
    .select('userId status readAt deliveredAt createdAt updatedAt')
    .sort({ createdAt: -1 })
    .lean();

  const senderInfo = await getSenderInfo(tenantId, messageObj.senderId, senderCache);

  return {
    ...messageObj,
    meta,
    statuses,
    senderInfo: senderInfo || null
  };
}

/**
 * Формирует DialogUpdate для всех участников диалога
 */
export async function createDialogUpdate(tenantId, dialogId, eventId, eventType) {
  try {
    // dialogId всегда приходит как строка dlg_*
    // Находим Dialog по строковому dialogId
    const dialog = await Dialog.findOne({ 
      dialogId: dialogId, 
      tenantId: tenantId 
    });
    
    if (!dialog) {
      console.error(`Dialog with dialogId ${dialogId} not found for update`);
      return;
    }

    // Получаем метаданные диалога (используем dialogId строку)
    const dialogMeta = await metaUtils.getEntityMeta(tenantId, 'dialog', dialogId);

    // Получаем всех участников диалога (используем dialog.dialogId строка)
    const dialogMembers = await DialogMember.find({
      tenantId: tenantId,
      dialogId: dialog.dialogId, // DialogMember.dialogId - это строка dlg_*
      isActive: true
    }).lean();

    if (dialogMembers.length === 0) {
      console.log(`No active members found for dialog ${dialogId}`);
      return;
    }

    const dialogSection = buildDialogSection(dialog, dialogMeta);
    const memberMetaEntries = await Promise.all(
      dialogMembers.map(async member => {
        const memberId = `${dialog.dialogId}:${member.userId}`;
        const memberMeta = await metaUtils.getEntityMeta(tenantId, 'dialogMember', memberId);
        return { userId: member.userId, meta: memberMeta || {} };
      })
    );
    const memberMetaMap = new Map(memberMetaEntries.map(entry => [entry.userId, entry.meta]));

    const updates = dialogMembers.map((member) => {
      const memberSection = buildMemberSection(member, memberMetaMap.get(member.userId));

      const data = {
        dialog: dialogSection,
        member: memberSection,
        context: buildContextSection({
          eventType,
          dialogId: dialog.dialogId,
          entityId: dialog.dialogId,
          includedSections: ['dialog', 'member']
        })
      };

      return {
        tenantId: tenantId,
        userId: member.userId,
        dialogId: dialog.dialogId,
        entityId: dialog.dialogId,
        eventId: eventId,
        eventType: eventType,
        data,
        published: false
      };
    });

    // Сохраняем updates в БД
    const savedUpdates = await Update.insertMany(updates);

    // Публикуем updates в RabbitMQ асинхронно
    savedUpdates.forEach(update => {
      publishUpdate(update).catch(err => {
        console.error(`Error publishing update ${update._id}:`, err);
      });
    });

    console.log(`Created ${savedUpdates.length} DialogUpdate for dialog ${dialogId}`);
  } catch (error) {
    console.error('Error creating DialogUpdate:', error);
  }
}

/**
 * Формирует DialogMemberUpdate для конкретного участника диалога
 * Используется для событий, которые касаются только одного участника (например, изменение unreadCount)
 */
export async function createDialogMemberUpdate(tenantId, dialogId, userId, eventId, eventType, eventData = {}) {
  try {
    // dialogId всегда приходит как строка dlg_*
    // Находим Dialog по строковому dialogId
    const dialog = await Dialog.findOne({ 
      dialogId: dialogId, 
      tenantId: tenantId 
    });
    
    if (!dialog) {
      console.error(`Dialog with dialogId ${dialogId} not found for update`);
      return;
    }

    // Получаем метаданные диалога
    const dialogMeta = await metaUtils.getEntityMeta(tenantId, 'dialog', dialogId);

    // Получаем конкретного участника
    const member = await DialogMember.findOne({
      tenantId: tenantId,
      dialogId: dialog.dialogId,
      userId: userId,
      isActive: true
    }).lean();

    if (!member) {
      console.log(`Member ${userId} not found in dialog ${dialogId}`);
      return;
    }

    const memberId = `${dialog.dialogId}:${member.userId}`;
    const memberMeta = await metaUtils.getEntityMeta(tenantId, 'dialogMember', memberId);
    const memberSection = buildMemberSection(member, memberMeta, {
      unreadCount: eventData.unreadCount,
      lastSeenAt: eventData.lastSeenAt
    });
    const updatedFields = [];
    if (Object.prototype.hasOwnProperty.call(eventData, 'unreadCount')) {
      updatedFields.push('member.state.unreadCount');
    }
    if (Object.prototype.hasOwnProperty.call(eventData, 'lastSeenAt')) {
      updatedFields.push('member.state.lastSeenAt');
    }

    const dialogSection = buildDialogSection(dialog, dialogMeta);

    const data = {
      dialog: dialogSection,
      member: memberSection,
      context: buildContextSection({
        eventType,
        dialogId: dialog.dialogId,
        entityId: dialog.dialogId,
        reason: eventData.reason || eventData.source,
        includedSections: ['dialog', 'member'],
        updatedFields
      })
    };

    const updateData = {
      tenantId: tenantId,
      userId: userId,
      dialogId: dialog.dialogId,
      entityId: dialog.dialogId,
      eventId: eventId,
      eventType: eventType,
      data,
      published: false
    };

    // Сохраняем update в БД
    const savedUpdate = await Update.create(updateData);

    // Публикуем update в RabbitMQ
    await publishUpdate(savedUpdate).catch(err => {
      console.error(`Error publishing update ${savedUpdate._id}:`, err);
    });

    console.log(`Created DialogMemberUpdate for user ${userId} in dialog ${dialogId}`);
  } catch (error) {
    console.error('Error creating DialogMemberUpdate:', error);
  }
}

/**
 * Формирует MessageUpdate для всех участников диалога
 */
export async function createMessageUpdate(tenantId, dialogId, messageId, eventId, eventType, eventData = {}) {
  try {
    // Получаем сообщение по messageId (строка msg_*)
    const message = await Message.findOne({ messageId: messageId, tenantId: tenantId });
    if (!message) {
      console.error(`Message ${messageId} not found for update`);
      return;
    }

    // dialogId приходит как строка dlg_*
    // Находим Dialog чтобы получить его _id (ObjectId)
    const dialog = await Dialog.findOne({ 
      dialogId: dialogId, 
      tenantId: tenantId 
    });
    
    if (!dialog) {
      console.error(`Dialog with dialogId ${dialogId} not found for update`);
      return;
    }

    // Получаем всех участников диалога (используем dialog.dialogId строка)
    const dialogMembers = await DialogMember.find({
      tenantId: tenantId,
      dialogId: dialog.dialogId, // DialogMember.dialogId - это строка dlg_*
      isActive: true
    }).select('userId').lean();

    if (dialogMembers.length === 0) {
      console.log(`No active members found for dialog ${dialogId}`);
      return;
    }

    const includeFullMessage = ['message.create', 'message.update', 'message.delete'].includes(eventType);
    let messageSection = {
      messageId: message.messageId,
      dialogId: dialog.dialogId,
      senderId: message.senderId,
      type: message.type
    };
    const includedSections = ['dialog', 'member'];
    const updatedFields = [];

    if (includeFullMessage) {
      const senderCache = new Map();
      const fullMessage = await buildFullMessagePayload(tenantId, message, senderCache);
      if (!fullMessage) {
        console.error(`Failed to build message payload for ${messageId}`);
        return;
      }

      if (eventData.reactionCounts) {
        fullMessage.reactionCounts = eventData.reactionCounts;
      } else {
        fullMessage.reactionCounts = message.reactionCounts || {};
      }

      fullMessage.dialogId = dialog.dialogId;
      messageSection = fullMessage;
      includedSections.push('message.full');
      updatedFields.push('message');
    }

    if (eventType.startsWith('message.status.')) {
      messageSection.statusUpdate = {
        userId: eventData.userId,
        status: eventData.newStatus,
        oldStatus: eventData.oldStatus ?? null
      };
      includedSections.push('message.status');
      updatedFields.push('message.status');
    }

    if (eventType.startsWith('message.reaction.')) {
      messageSection.reactionUpdate = {
        userId: eventData.userId,
        reaction: eventData.reaction,
        oldReaction: eventData.oldReaction ?? null,
        counts: eventData.reactionCounts ?? null
      };
      includedSections.push('message.reaction');
      updatedFields.push('message.reaction');
    }

    const dialogMeta = await metaUtils.getEntityMeta(tenantId, 'dialog', dialogId);
    const dialogSection = buildDialogSection(dialog, dialogMeta);
    const memberMetaEntries = await Promise.all(
      dialogMembers.map(async member => {
        const memberId = `${dialog.dialogId}:${member.userId}`;
        const memberMeta = await metaUtils.getEntityMeta(tenantId, 'dialogMember', memberId);
        return { userId: member.userId, meta: memberMeta || {} };
      })
    );
    const memberMetaMap = new Map(memberMetaEntries.map(entry => [entry.userId, entry.meta]));

    const reason =
      eventData.reason ||
      (eventType.startsWith('message.status.') ? 'message_status' :
        eventType.startsWith('message.reaction.') ? 'message_reaction' : null);

    const updates = dialogMembers.map(member => {
      const memberSection = buildMemberSection(member, memberMetaMap.get(member.userId));
      const data = {
        dialog: dialogSection,
        member: memberSection,
        message: cloneSection(messageSection),
        context: buildContextSection({
          eventType,
          dialogId: dialog.dialogId,
          entityId: message.messageId,
          messageId: message.messageId,
          reason,
          includedSections: [...includedSections],
          updatedFields: [...updatedFields]
        })
      };

      return {
        tenantId: tenantId,
        userId: member.userId,
        dialogId: dialog.dialogId,
        entityId: message.messageId,
        eventId: eventId,
        eventType: eventType,
        data,
        published: false
      };
    });

    // Сохраняем updates в БД
    const savedUpdates = await Update.insertMany(updates);

    // Публикуем updates в RabbitMQ асинхронно
    savedUpdates.forEach(update => {
      publishUpdate(update).catch(err => {
        console.error(`Error publishing update ${update._id}:`, err);
      });
    });

    console.log(`Created ${savedUpdates.length} MessageUpdate for message ${messageId}`);
  } catch (error) {
    console.error('Error creating MessageUpdate:', error);
  }
}

/**
 * Формирует TypingUpdate для всех участников диалога (кроме инициатора)
 */
export async function createTypingUpdate(tenantId, dialogId, typingUserId, eventId, eventType, eventData = {}) {
  try {
    const dialog = await Dialog.findOne({
      dialogId,
      tenantId
    });

    if (!dialog) {
      console.error(`Dialog with dialogId ${dialogId} not found for typing update`);
      return;
    }

    const dialogMembers = await DialogMember.find({
      tenantId,
      dialogId: dialog.dialogId,
      isActive: true
    }).lean();

    if (dialogMembers.length === 0) {
      console.log(`No active members found for typing update in dialog ${dialogId}`);
      return;
    }

    const expiresInMs = eventData.expiresInMs || DEFAULT_TYPING_EXPIRES_MS;
    const timestamp = eventData.timestamp || Date.now();
    const userInfo = eventData.userInfo || null;

    // Получаем метаданные диалога для dialogInfo
    const dialogMeta = await metaUtils.getEntityMeta(tenantId, 'dialog', dialogId);
    const dialogSection = buildDialogSection(dialog, dialogMeta);
    const memberMetaEntries = await Promise.all(
      dialogMembers.map(async member => {
        const meta = await metaUtils.getEntityMeta(tenantId, 'dialogMember', `${dialog.dialogId}:${member.userId}`);
        return { userId: member.userId, meta: meta || {} };
      })
    );
    const memberMetaMap = new Map(memberMetaEntries.map(entry => [entry.userId, entry.meta]));

    const typingSection = {
      userId: typingUserId,
      expiresInMs,
      timestamp,
      userInfo
    };

    const updatesPayload = dialogMembers
      .filter(member => member.userId !== typingUserId)
      .map(member => {
        const memberSection = buildMemberSection(member, memberMetaMap.get(member.userId));

        return {
          tenantId,
          userId: member.userId,
          dialogId: dialog.dialogId,
          entityId: dialog.dialogId,
          eventId,
          eventType,
          data: {
            dialog: dialogSection,
            member: memberSection,
            typing: typingSection,
            context: buildContextSection({
              eventType,
              dialogId: dialog.dialogId,
              entityId: dialog.dialogId,
              reason: eventData.reason || 'typing',
              includedSections: ['dialog', 'member', 'typing']
            })
          },
          published: false
        };
      });

    if (updatesPayload.length === 0) {
      console.log(`No recipients for typing update in dialog ${dialogId}`);
      return;
    }

    const savedUpdates = await Update.insertMany(updatesPayload);

    savedUpdates.forEach(update => {
      publishUpdate(update).catch(err => {
        console.error(`Error publishing typing update ${update._id}:`, err);
      });
    });

    console.log(`Created ${savedUpdates.length} TypingUpdate for dialog ${dialogId}`);
  } catch (error) {
    console.error('Error creating TypingUpdate:', error);
  }
}

/**
 * Публикует update в RabbitMQ
 */
async function publishUpdate(update) {
  try {
    const updateObj = update.toObject ? update.toObject() : update;
    
    // Сохраняем _id для логирования и обновления статуса
    const updateId = updateObj._id;
    
    // Очищаем update от _id, id и __v, включая вложенные объекты в data
    const sanitizedUpdate = sanitizeResponse(updateObj);
    
    // Определяем тип update из eventType
    const updateType = getUpdateTypeFromEventType(sanitizedUpdate.eventType);
    if (!updateType) {
      console.error(`Cannot determine update type for eventType: ${sanitizedUpdate.eventType}`);
      return;
    }
    
    // Публикуем в exchange chat3_updates с routing key user.{userId}.{updateType}
    const routingKey = `user.${sanitizedUpdate.userId}.${updateType.toLowerCase()}`;
    
    const published = await rabbitmqUtils.publishUpdate(sanitizedUpdate, routingKey);
    
    if (!published) {
      console.error(`❌ Failed to publish update ${updateId} to RabbitMQ (routing key: ${routingKey})`);
      throw new Error('Failed to publish update to RabbitMQ');
    }

    // Обновляем статус published только если публикация успешна
    await Update.updateOne(
      { _id: updateId },
      { 
        $set: { 
          published: true,
          publishedAt: generateTimestamp()
        } 
      }
    );
    
    console.log(`✅ Update ${updateId} published to RabbitMQ (${routingKey})`);
  } catch (error) {
    const updateId = update._id || (update.toObject ? update.toObject()._id : null);
    console.error(`❌ Error publishing update ${updateId}:`, error.message);
    throw error;
  }
}

/**
 * Определяет тип update из типа события
 */
export function getUpdateTypeFromEventType(eventType) {
  if (DIALOG_UPDATE_EVENTS.includes(eventType)) {
    return 'DialogUpdate';
  }
  if (DIALOG_MEMBER_UPDATE_EVENTS.includes(eventType)) {
    return 'DialogMemberUpdate';
  }
  if (MESSAGE_UPDATE_EVENTS.includes(eventType)) {
    return 'MessageUpdate';
  }
  if (TYPING_EVENTS.includes(eventType)) {
    return 'Typing';
  }
  return null;
}

/**
 * Определяет, нужно ли создавать update для события
 */
export function shouldCreateUpdate(eventType) {
  return {
    dialog: DIALOG_UPDATE_EVENTS.includes(eventType),
    dialogMember: DIALOG_MEMBER_UPDATE_EVENTS.includes(eventType),
    message: MESSAGE_UPDATE_EVENTS.includes(eventType),
    typing: TYPING_EVENTS.includes(eventType)
  };
}




