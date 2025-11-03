import mongoose from 'mongoose';
import { Dialog, Message, DialogMember, Meta } from '../models/index.js';
import Update from '../models/Update.js';
import * as metaUtils from './metaUtils.js';
import * as rabbitmqUtils from './rabbitmqUtils.js';

/**
 * Формирует DialogUpdate для всех участников диалога
 */
export async function createDialogUpdate(tenantId, dialogId, eventId, eventType) {
  try {
    // Получаем диалог с метаданными
    const dialog = await Dialog.findById(dialogId);
    if (!dialog) {
      console.error(`Dialog ${dialogId} not found for update`);
      return;
    }

    // Получаем метаданные диалога
    const dialogMeta = await metaUtils.getEntityMeta(tenantId, 'dialog', dialogId);

    // Получаем всех участников диалога
    const dialogMembers = await DialogMember.find({
      tenantId: tenantId,
      dialogId: dialogId,
      isActive: true
    }).select('userId').lean();

    if (dialogMembers.length === 0) {
      console.log(`No active members found for dialog ${dialogId}`);
      return;
    }

    // Формируем данные диалога для update
    const dialogData = {
      _id: dialog._id,
      tenantId: dialog.tenantId,
      name: dialog.name,
      createdBy: dialog.createdBy,
      createdAt: dialog.createdAt,
      updatedAt: dialog.updatedAt,
      meta: dialogMeta
    };

    // Создаем updates для каждого участника
    const updates = dialogMembers.map(member => ({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      userId: member.userId,
      updateType: 'DialogUpdate',
      dialogId: dialogId,
      entityId: dialogId,
      eventId: eventId,
      eventType: eventType,
      data: dialogData,
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
    // Получаем сообщение
    const message = await Message.findById(messageId);
    if (!message) {
      console.error(`Message ${messageId} not found for update`);
      return;
    }

    // Получаем метаданные сообщения
    const messageMeta = await metaUtils.getEntityMeta(tenantId, 'message', messageId);

    // Получаем всех участников диалога
    const dialogMembers = await DialogMember.find({
      tenantId: tenantId,
      dialogId: dialogId,
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
      _id: message._id,
      tenantId: message.tenantId,
      dialogId: message.dialogId,
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
      tenantId: new mongoose.Types.ObjectId(tenantId),
      userId: member.userId,
      updateType: 'MessageUpdate',
      dialogId: dialogId,
      entityId: messageId,
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
    
    // Публикуем в exchange chat3_updates с routing key user.{userId}.{updateType}
    const routingKey = `user.${updateObj.userId}.${updateObj.updateType.toLowerCase()}`;
    
    await rabbitmqUtils.publishUpdate(updateObj, routingKey);

    // Обновляем статус published
    await Update.updateOne(
      { _id: updateObj._id },
      { 
        $set: { 
          published: true,
          publishedAt: new Date()
        } 
      }
    );
  } catch (error) {
    console.error(`Error publishing update ${update._id}:`, error);
    throw error;
  }
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




