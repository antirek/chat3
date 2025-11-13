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

    // Создаем updates для каждого участника с его мета тегами
    const updates = await Promise.all(
      dialogMembers.map(async (member) => {
        // Получаем мета теги DialogMember для этого участника
        // entityId для DialogMember meta = dialogId:userId (составной ключ)
        const memberId = `${dialog.dialogId}:${member.userId}`;
        const memberMeta = await metaUtils.getEntityMeta(tenantId, 'dialogMember', memberId);

        // Формируем данные диалога для update с мета тегами участника
        const dialogData = {
          dialogId: dialog.dialogId, // Строковый ID dlg_*
          tenantId: dialog.tenantId,
          name: dialog.name,
          createdBy: dialog.createdBy,
          createdAt: dialog.createdAt,
          updatedAt: dialog.updatedAt,
          meta: dialogMeta,
          dialogMemberMeta: memberMeta
        };

        // Добавляем dialogInfo с мета-тегами
        const dialogInfo = {
          dialogId: dialog.dialogId,
          name: dialog.name,
          createdBy: dialog.createdBy,
          createdAt: dialog.createdAt,
          updatedAt: dialog.updatedAt,
          meta: dialogMeta
        };

        return {
          tenantId: tenantId, // tenantId is now a String (tnt_XXXXXXXX)
          userId: member.userId,
          dialogId: dialog.dialogId, // Используем строковый dialogId для Update.dialogId
          entityId: dialog.dialogId, // Используем строковый dialogId для Update.entityId
          eventId: eventId,
          eventType: eventType,
          data: {
            ...dialogData,
            dialogInfo
          },
          published: false
        };
      })
    );

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

    // Получаем мета теги DialogMember для этого участника
    // entityId для DialogMember meta = dialogId:userId (составной ключ)
    const memberId = `${dialog.dialogId}:${member.userId}`;
    const memberMeta = await metaUtils.getEntityMeta(tenantId, 'dialogMember', memberId);

    // Формируем данные диалога для update с мета тегами и данными участника
    const dialogData = {
      dialogId: dialog.dialogId,
      tenantId: dialog.tenantId,
      name: dialog.name,
      createdBy: dialog.createdBy,
      createdAt: dialog.createdAt,
      updatedAt: dialog.updatedAt,
      meta: dialogMeta,
      dialogMemberMeta: memberMeta,
      // Добавляем данные участника из события
      memberData: {
        userId: member.userId,
        unreadCount: eventData.unreadCount !== undefined ? eventData.unreadCount : member.unreadCount,
        lastSeenAt: eventData.lastSeenAt || member.lastSeenAt,
        lastMessageAt: member.lastMessageAt,
        isActive: member.isActive
      }
    };

    // Добавляем dialogInfo с мета-тегами
    const dialogInfo = {
      dialogId: dialog.dialogId,
      name: dialog.name,
      createdBy: dialog.createdBy,
      createdAt: dialog.createdAt,
      updatedAt: dialog.updatedAt,
      meta: dialogMeta
    };

    // Создаем update только для этого участника
    const updateData = {
      tenantId: tenantId,
      userId: userId, // Только для этого пользователя!
      dialogId: dialog.dialogId,
      entityId: dialog.dialogId,
      eventId: eventId,
      eventType: eventType,
      data: {
        ...dialogData,
        dialogInfo
      },
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

    const senderCache = new Map();
    const fullMessage = await buildFullMessagePayload(tenantId, message, senderCache);
    if (!fullMessage) {
      console.error(`Failed to build message payload for ${messageId}`);
      return;
    }

    // Обновляем актуальные счетчики реакций (если пришли в событии)
    if (eventData.reactionCounts) {
      fullMessage.reactionCounts = eventData.reactionCounts;
    } else {
      fullMessage.reactionCounts = message.reactionCounts || {};
    }

    // Для событий message.status.* добавляем информацию о статусе
    if (eventType.startsWith('message.status.')) {
      fullMessage.statusUpdate = {
        userId: eventData.userId,
        status: eventData.newStatus,
        oldStatus: eventData.oldStatus ?? null
      };
    }

    // Для событий message.reaction.* добавляем информацию о реакции
    if (eventType.startsWith('message.reaction.')) {
      fullMessage.reactionUpdate = {
        userId: eventData.userId,
        reaction: eventData.reaction,
        oldReaction: eventData.oldReaction ?? null
      };
    }

    fullMessage.dialogId = dialog.dialogId;

    // Получаем метаданные диалога для dialogInfo
    const dialogMeta = await metaUtils.getEntityMeta(tenantId, 'dialog', dialogId);

    // Формируем dialogInfo с мета-тегами
    const dialogInfo = {
      dialogId: dialog.dialogId,
      name: dialog.name,
      createdBy: dialog.createdBy,
      createdAt: dialog.createdAt,
      updatedAt: dialog.updatedAt,
      meta: dialogMeta
    };

    // Создаем updates для каждого участника
    const updates = dialogMembers.map(member => ({
      tenantId: tenantId, // tenantId is now a String (tnt_XXXXXXXX)
      userId: member.userId,
      dialogId: dialog.dialogId, // Update.dialogId - это строка dlg_*
      entityId: message.messageId, // Update.entityId - это строка msg_*
      eventId: eventId,
      eventType: eventType,
      data: {
        ...fullMessage,
        dialogInfo
      },
      published: false
    }));

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

    // Формируем dialogInfo с мета-тегами
    const dialogInfo = {
      dialogId: dialog.dialogId,
      name: dialog.name,
      createdBy: dialog.createdBy,
      createdAt: dialog.createdAt,
      updatedAt: dialog.updatedAt,
      meta: dialogMeta
    };

    const updatesPayload = dialogMembers
      .filter(member => member.userId !== typingUserId)
      .map(member => ({
        tenantId,
        userId: member.userId,
        dialogId: dialog.dialogId,
        entityId: dialog.dialogId,
        eventId,
        eventType,
        data: {
          dialogId: dialog.dialogId,
          typing: {
            userId: typingUserId,
            expiresInMs,
            timestamp,
            userInfo
          },
          dialogInfo
        },
        published: false
      }));

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
    return 'DialogUpdate'; // Используем тот же routing key, но создаем только для одного участника
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




