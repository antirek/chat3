import mongoose from 'mongoose';
import { Dialog, Message, DialogMember, Meta } from '../models/index.js';
import Update from '../models/Update.js';
import * as metaUtils from './metaUtils.js';
import * as rabbitmqUtils from './rabbitmqUtils.js';
import { sanitizeResponse } from './responseUtils.js';
import { generateTimestamp } from './timestampUtils.js';

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
        const memberMeta = await metaUtils.getEntityMeta(tenantId, 'dialogMember', member._id.toString());

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

        return {
          tenantId: tenantId, // tenantId is now a String (tnt_XXXXXXXX)
          userId: member.userId,
          dialogId: dialog.dialogId, // Используем строковый dialogId для Update.dialogId
          entityId: dialog.dialogId, // Используем строковый dialogId для Update.entityId
          eventId: eventId,
          eventType: eventType,
          data: dialogData,
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
 * Формирует MessageUpdate для всех участников диалога
 */
export async function createMessageUpdate(tenantId, dialogId, messageId, eventId, eventType) {
  try {
    // Получаем сообщение по messageId (строка msg_*)
    const message = await Message.findOne({ messageId: messageId, tenantId: tenantId });
    if (!message) {
      console.error(`Message ${messageId} not found for update`);
      return;
    }

    // Получаем метаданные сообщения (messageId - это строка msg_*)
    const messageMeta = await metaUtils.getEntityMeta(tenantId, 'message', message.messageId);

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

    // Формируем данные сообщения для update (включая контент до 4096 символов)
    const MAX_CONTENT_LENGTH = 4096;
    const messageContent = message.content.length > MAX_CONTENT_LENGTH 
      ? message.content.substring(0, MAX_CONTENT_LENGTH) 
      : message.content;

    const messageData = {
      messageId: message.messageId, // Строковый ID msg_*
      tenantId: message.tenantId,
      dialogId: dialog.dialogId, // Строковый ID dlg_* (не ObjectId!)
      senderId: message.senderId,
      content: messageContent,
      type: message.type,
      reactionCounts: message.reactionCounts || {},
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      meta: messageMeta
    };

    // Создаем updates для каждого участника
    const updates = dialogMembers.map(member => ({
      tenantId: tenantId, // tenantId is now a String (tnt_XXXXXXXX)
      userId: member.userId,
      dialogId: dialog.dialogId, // Update.dialogId - это строка dlg_*
      entityId: message.messageId, // Update.entityId - это строка msg_*
      eventId: eventId,
      eventType: eventType,
      data: messageData,
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
  const dialogUpdateEvents = [
    'dialog.create',
    'dialog.update',
    'dialog.delete',
    'dialog.member.add',
    'dialog.member.remove'
  ];

  const messageUpdateEvents = [
    'message.create',
    'message.update',
    'message.delete',
    'message.reaction.add',
    'message.reaction.update',
    'message.reaction.remove',
    'message.status.create',
    'message.status.update'
  ];

  if (dialogUpdateEvents.includes(eventType)) {
    return 'DialogUpdate';
  }
  if (messageUpdateEvents.includes(eventType)) {
    return 'MessageUpdate';
  }
  return null;
}

/**
 * Определяет, нужно ли создавать update для события
 */
export function shouldCreateUpdate(eventType) {
  const dialogUpdateEvents = [
    'dialog.create',
    'dialog.update',
    'dialog.delete',
    'dialog.member.add',
    'dialog.member.remove'
  ];

  const messageUpdateEvents = [
    'message.create',
    'message.update',
    'message.delete',
    'message.reaction.add',
    'message.reaction.update',
    'message.reaction.remove',
    'message.status.create',
    'message.status.update'
  ];

  return {
    dialog: dialogUpdateEvents.includes(eventType),
    message: messageUpdateEvents.includes(eventType)
  };
}




