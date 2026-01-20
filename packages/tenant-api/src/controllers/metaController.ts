import * as metaUtils from '@chat3/utils/metaUtils.js';
import { Dialog, Message, DialogMember, User, Topic } from '@chat3/models';
import { sanitizeResponse } from '@chat3/utils/responseUtils.js';
import * as eventUtils from '@chat3/utils/eventUtils.js';
import { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/apiAuth.js';

interface ErrorWithStatusCode extends Error {
  statusCode?: number;
}

const metaController = {
  // Get all meta for an entity
  async getMeta(req: AuthenticatedRequest, res: Response): Promise<void> {
    const routePath = 'get /meta/:entityType/:entityId';
    const log = (...args: any[]) => {
      console.log(`[${routePath}]`, ...args);
    }
    log('>>>>> start');
    
    try {
      const { entityType, entityId } = req.params;
      log(`Получены параметры: entityType=${entityType}, entityId=${entityId}, tenantId=${req.tenantId}`);

      // Validate entityType
      const validEntityTypes = ['user', 'dialog', 'message', 'tenant', 'system', 'dialogMember', 'topic'];
      if (!validEntityTypes.includes(entityType)) {
        log(`Ошибка валидации: неверный entityType=${entityType}`);
        res.status(400).json({
          error: 'Bad Request',
          message: `Invalid entityType. Must be one of: ${validEntityTypes.join(', ')}`
        });
        return;
      }

      // Optional: Verify entity exists (for dialog, message, dialogMember)
      log(`Проверка существования сущности: entityType=${entityType}, entityId=${entityId}`);
      await verifyEntityExists(entityType, entityId, req.tenantId!);

      // Get meta data
      log(`Получение метаданных: entityType=${entityType}, entityId=${entityId}`);
      const meta = await metaUtils.getEntityMeta(req.tenantId!, entityType as any, entityId);
      log(`Метаданные получены: keys=${Object.keys(meta).length}`);

      log(`Отправка ответа: ${Object.keys(meta).length} мета-тегов`);
      res.json({
        data: sanitizeResponse(meta)
      });
    } catch (error: any) {
      log(`Ошибка обработки запроса:`, error.message);
      if ((error as ErrorWithStatusCode).statusCode === 404) {
        res.status(404).json({
          error: 'Not Found',
          message: error.message
        });
        return;
      }
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    } finally {
      log('>>>>> end');
    }
  },

  // Set or update meta for an entity
  async setMeta(req: AuthenticatedRequest, res: Response): Promise<void> {
    const routePath = 'put /meta/:entityType/:entityId/:key';
    const log = (...args: any[]) => {
      console.log(`[${routePath}]`, ...args);
    }
    log('>>>>> start');
    
    try {
      // Декодируем entityId из URL (на случай если пришло закодированное)
      const { entityType, entityId: rawEntityId, key } = req.params;
      const entityId = decodeURIComponent(rawEntityId || '');
      
      const { value, dataType = 'string' } = req.body as { value?: any; dataType?: 'string' | 'number' | 'boolean' | 'object' | 'array' };
      const finalDataType = (dataType || 'string') as 'string' | 'number' | 'boolean' | 'object' | 'array';
      log(`Получены параметры: entityType=${entityType}, entityId=${entityId}, key=${key}, dataType=${finalDataType}`);

      // Validate entityType
      const validEntityTypes = ['user', 'dialog', 'message', 'tenant', 'system', 'dialogMember', 'topic'];
      if (!validEntityTypes.includes(entityType)) {
        log(`Ошибка валидации: неверный entityType=${entityType}`);
        res.status(400).json({
          error: 'Bad Request',
          message: `Invalid entityType. Must be one of: ${validEntityTypes.join(', ')}`
        });
        return;
      }

      // Validate dataType
      const validDataTypes = ['string', 'number', 'boolean', 'object', 'array'];
      if (!validDataTypes.includes(finalDataType)) {
        log(`Ошибка валидации: неверный dataType=${finalDataType}`);
        res.status(400).json({
          error: 'Bad Request',
          message: `Invalid dataType. Must be one of: ${validDataTypes.join(', ')}`
        });
        return;
      }

      // Optional: Verify entity exists
      log(`Проверка существования сущности: entityType=${entityType}, entityId=${entityId}`);
      await verifyEntityExists(entityType, entityId, req.tenantId!);

      // Set meta
      log(`Установка мета-тега: entityType=${entityType}, entityId=${entityId}, key=${key}, dataType=${finalDataType}`);
      const meta = await metaUtils.setEntityMeta(
        req.tenantId!,
        entityType as any,
        entityId,
        key,
        value,
        finalDataType,
        {
          createdBy: req.apiKey?.name || 'api'
        }
      );
      log(`Мета-тег установлен: key=${key}`);

      // Генерируем события при обновлении мета-тегов
      const actorId = req.userId || req.apiKey?.name || 'api';
      log(`Создание события обновления: entityType=${entityType}, actorId=${actorId}`);
      if (entityType === 'dialog') {
        await createDialogUpdateEvent(req.tenantId!, entityId, actorId);
      } else if (entityType === 'message') {
        await createMessageUpdateEvent(req.tenantId!, entityId, actorId);
      } else if (entityType === 'dialogMember') {
        await createDialogMemberUpdateEvent(req.tenantId!, entityId, actorId);
      } else if (entityType === 'user') {
        await createUserUpdateEvent(req.tenantId!, entityId, actorId);
      }

      log(`Отправка успешного ответа: entityType=${entityType}, entityId=${entityId}, key=${key}`);
      res.json({
        data: sanitizeResponse(meta),
        message: 'Meta set successfully'
      });
    } catch (error: any) {
      log(`Ошибка обработки запроса:`, error.message);
      console.error('Error in setMeta:', error);
      if ((error as ErrorWithStatusCode).statusCode === 404) {
        res.status(404).json({
          error: 'Not Found',
          message: error.message
        });
        return;
      }
      if ((error as ErrorWithStatusCode).statusCode === 400) {
        res.status(400).json({
          error: 'Bad Request',
          message: error.message
        });
        return;
      }
      // Проверяем, не является ли это ошибкой каста ObjectId
      if (error.message && error.message.includes('Cast to ObjectId')) {
        console.error('ObjectId cast error detected:', error.message);
        res.status(400).json({
          error: 'Bad Request',
          message: `Invalid entityId format for ${req.params.entityType}. For dialogMember, use format: dialogId:userId`
        });
        return;
      }
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    } finally {
      log('>>>>> end');
    }
  },

  // Delete meta key for an entity
  async deleteMeta(req: AuthenticatedRequest, res: Response): Promise<void> {
    const routePath = 'delete /meta/:entityType/:entityId/:key';
    const log = (...args: any[]) => {
      console.log(`[${routePath}]`, ...args);
    }
    log('>>>>> start');
    
    try {
      const { entityType, entityId, key } = req.params;
      log(`Получены параметры: entityType=${entityType}, entityId=${entityId}, key=${key}, tenantId=${req.tenantId}`);

      // Validate entityType
      const validEntityTypes = ['user', 'dialog', 'message', 'tenant', 'system', 'dialogMember', 'topic'];
      if (!validEntityTypes.includes(entityType)) {
        log(`Ошибка валидации: неверный entityType=${entityType}`);
        res.status(400).json({
          error: 'Bad Request',
          message: `Invalid entityType. Must be one of: ${validEntityTypes.join(', ')}`
        });
        return;
      }

      // Optional: Verify entity exists
      log(`Проверка существования сущности: entityType=${entityType}, entityId=${entityId}`);
      await verifyEntityExists(entityType, entityId, req.tenantId!);

      // Delete meta
      log(`Удаление мета-тега: entityType=${entityType}, entityId=${entityId}, key=${key}`);
      const deleted = await metaUtils.deleteEntityMeta(
        req.tenantId!,
        entityType as any,
        entityId,
        key
      );

      if (!deleted) {
        log(`Мета-тег не найден: key=${key}, entityType=${entityType}, entityId=${entityId}`);
        res.status(404).json({
          error: 'Not Found',
          message: `Meta key '${key}' not found for ${entityType} ${entityId}`
        });
        return;
      }
      log(`Мета-тег удален: key=${key}`);

      // Генерируем события при удалении мета-тегов
      const actorId = req.userId || req.apiKey?.name || 'api';
      log(`Создание события обновления: entityType=${entityType}, actorId=${actorId}`);
      if (entityType === 'dialog') {
        await createDialogUpdateEvent(req.tenantId!, entityId, actorId);
      } else if (entityType === 'message') {
        await createMessageUpdateEvent(req.tenantId!, entityId, actorId);
      } else if (entityType === 'dialogMember') {
        await createDialogMemberUpdateEvent(req.tenantId!, entityId, actorId);
      } else if (entityType === 'topic') {
        await createTopicUpdateEvent(req.tenantId!, entityId, actorId);
      }

      log(`Отправка успешного ответа: entityType=${entityType}, entityId=${entityId}, key=${key}`);
      res.json({
        message: 'Meta deleted successfully'
      });
    } catch (error: any) {
      log(`Ошибка обработки запроса:`, error.message);
      if ((error as ErrorWithStatusCode).statusCode === 404) {
        res.status(404).json({
          error: 'Not Found',
          message: error.message
        });
        return;
      }
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    } finally {
      log('>>>>> end');
    }
  }
};

// Helper function to create dialog.update event
async function createDialogUpdateEvent(tenantId: string, dialogId: string, actorId: string): Promise<void> {
  try {
    const dialog = await Dialog.findOne({ dialogId, tenantId });
    if (!dialog) {
      console.warn(`Dialog ${dialogId} not found for update event`);
      return;
    }

    const dialogMeta = await metaUtils.getEntityMeta(tenantId, 'dialog', dialogId);

    const dialogSection = eventUtils.buildDialogSection({
      dialogId: dialog.dialogId,
      tenantId: dialog.tenantId,
      createdBy: (dialog as any).createdBy,
      createdAt: dialog.createdAt,
      meta: dialogMeta
    });

    const dialogContext = eventUtils.buildEventContext({
      eventType: 'dialog.update',
      dialogId: dialog.dialogId,
      entityId: dialog.dialogId,
      includedSections: ['dialog'],
      updatedFields: ['dialog.meta']
    });

    await eventUtils.createEvent({
      tenantId,
      eventType: 'dialog.update',
      entityType: 'dialog',
      entityId: dialog.dialogId,
      actorId: actorId,
      actorType: 'api',
      data: eventUtils.composeEventData({
        context: dialogContext,
        dialog: dialogSection
      })
    });
  } catch (error: any) {
    console.error('Error creating dialog.update event:', error);
    // Не прерываем выполнение, если не удалось создать событие
  }
}

// Helper function to create message.update event
async function createMessageUpdateEvent(tenantId: string, messageId: string, actorId: string): Promise<void> {
  try {
    const message = await Message.findOne({ messageId, tenantId });
    if (!message) {
      console.warn(`Message ${messageId} not found for update event`);
      return;
    }

    const messageMeta = await metaUtils.getEntityMeta(tenantId, 'message', messageId);

    // Получаем диалог и его метаданные для события
    const dialog = await Dialog.findOne({
      dialogId: message.dialogId,
      tenantId
    }).lean();

    let dialogSection: any = null;
    if (dialog) {
      const dialogMeta = await metaUtils.getEntityMeta(tenantId, 'dialog', dialog.dialogId);
      dialogSection = eventUtils.buildDialogSection({
        dialogId: dialog.dialogId,
        tenantId: dialog.tenantId,
        createdAt: dialog.createdAt,
        meta: dialogMeta || {}
      });
    }

    const messageSection = eventUtils.buildMessageSection({
      messageId: message.messageId,
      dialogId: message.dialogId,
      senderId: message.senderId,
      type: message.type,
      content: message.content,
      meta: messageMeta
    });

    const messageContext = eventUtils.buildEventContext({
      eventType: 'message.update',
      dialogId: message.dialogId,
      entityId: message.messageId,
      messageId: message.messageId,
      includedSections: dialogSection ? ['dialog', 'message'] : ['message'],
      updatedFields: ['message.meta']
    });

    await eventUtils.createEvent({
      tenantId,
      eventType: 'message.update',
      entityType: 'message',
      entityId: message.messageId,
      actorId: actorId,
      actorType: 'api',
      data: eventUtils.composeEventData({
        context: messageContext,
        dialog: dialogSection,
        message: messageSection
      })
    });
  } catch (error: any) {
    console.error('Error creating message.update event:', error);
    // Не прерываем выполнение, если не удалось создать событие
  }
}

// Helper function to create user.update event
async function createUserUpdateEvent(tenantId: string, userId: string, actorId: string): Promise<void> {
  try {
    const user = await User.findOne({ userId, tenantId });
    if (!user) {
      console.warn(`User ${userId} not found for update event`);
      return;
    }

    // Получаем мета-теги пользователя
    const userMeta = await metaUtils.getEntityMeta(tenantId, 'user', userId);

    const userSection = eventUtils.buildUserSection({
      userId: user.userId,
      type: user.type,
      meta: userMeta || {}
    });

    const userContext = eventUtils.buildEventContext({
      eventType: 'user.update',
      entityId: userId,
      includedSections: ['user'],
      updatedFields: ['user.meta']
    });

    await eventUtils.createEvent({
      tenantId: tenantId,
      eventType: 'user.update',
      entityType: 'user',
      entityId: userId,
      actorId: actorId,
      actorType: 'user',
      data: eventUtils.composeEventData({
        context: userContext,
        user: userSection
      })
    });
  } catch (error: any) {
    console.error('Error creating user.update event:', error);
    // Не прерываем выполнение, если не удалось создать событие
  }
}

// Helper function to create dialog.member.update event
async function createDialogMemberUpdateEvent(tenantId: string, entityId: string, actorId: string): Promise<void> {
  try {
    // entityId для DialogMember - это составной ключ dialogId:userId
    const parts = entityId.split(':');
    if (parts.length !== 2) {
      console.warn(`Invalid DialogMember entityId format: ${entityId}`);
      return;
    }
    const [dialogId, userId] = parts;

    const dialogMember = await DialogMember.findOne({
      dialogId: String(dialogId).trim(),
      userId: String(userId).trim(),
      tenantId: String(tenantId).trim()
    });
    if (!dialogMember) {
      console.warn(`DialogMember ${entityId} not found for update event`);
      return;
    }

    const dialog = await Dialog.findOne({ dialogId, tenantId });
    if (!dialog) {
      console.warn(`Dialog ${dialogId} not found for member update event`);
      return;
    }

    // Получаем метаданные диалога для события
    const dialogMeta = await metaUtils.getEntityMeta(tenantId, 'dialog', dialog.dialogId);
    const dialogSection = eventUtils.buildDialogSection({
      dialogId: dialog.dialogId,
      tenantId: dialog.tenantId,
      createdBy: (dialog as any).createdBy,
      createdAt: dialog.createdAt,
      meta: dialogMeta || {}
    });

    const memberMeta = await metaUtils.getEntityMeta(tenantId, 'dialogMember', entityId);

    const memberSection = eventUtils.buildMemberSection({
      userId: dialogMember.userId,
      meta: memberMeta,
      state: {
        unreadCount: (dialogMember as any).unreadCount,
        lastSeenAt: (dialogMember as any).lastSeenAt,
        lastMessageAt: (dialogMember as any).lastMessageAt,
      }
    });

    const memberContext = eventUtils.buildEventContext({
      eventType: 'dialog.member.update',
      dialogId: dialog.dialogId,
      entityId: dialog.dialogId,
      includedSections: ['dialog', 'member'],
      updatedFields: ['member.meta']
    });

    await eventUtils.createEvent({
      tenantId,
      eventType: 'dialog.member.update',
      entityType: 'dialogMember',
      entityId: dialog.dialogId,
      actorId: actorId,
      actorType: 'api',
      data: eventUtils.composeEventData({
        context: memberContext,
        dialog: dialogSection,
        member: memberSection
      })
    });
  } catch (error: any) {
    console.error('Error creating dialog.member.update event:', error);
    // Не прерываем выполнение, если не удалось создать событие
  }
}

// Helper function to create topic.update event
async function createTopicUpdateEvent(tenantId: string, topicId: string, actorId: string): Promise<void> {
  try {
    const topic = await Topic.findOne({ topicId, tenantId });
    if (!topic) {
      console.warn(`Topic ${topicId} not found for update event`);
      return;
    }

    const topicMeta = await metaUtils.getEntityMeta(tenantId, 'topic', topicId);
    
    // Получаем диалог для события
    const dialog = await Dialog.findOne({
      dialogId: topic.dialogId,
      tenantId
    }).lean();

    let dialogSection: any = null;
    if (dialog) {
      const dialogMeta = await metaUtils.getEntityMeta(tenantId, 'dialog', dialog.dialogId);
      dialogSection = eventUtils.buildDialogSection({
        dialogId: dialog.dialogId,
        tenantId: dialog.tenantId,
        createdAt: dialog.createdAt,
        meta: dialogMeta || {}
      });
    }

    const topicSection = eventUtils.buildTopicSection({
      topicId: topic.topicId,
      dialogId: topic.dialogId,
      meta: topicMeta || {}
    });

    const topicContext = eventUtils.buildEventContext({
      eventType: 'dialog.topic.update',
      dialogId: topic.dialogId,
      entityId: topic.topicId,
      includedSections: dialogSection ? ['dialog', 'topic'] : ['topic'],
      updatedFields: ['topic.meta']
    });

    await eventUtils.createEvent({
      tenantId,
      eventType: 'dialog.topic.update',
      entityType: 'topic',
      entityId: topic.topicId,
      actorId: actorId,
      actorType: 'api',
      data: eventUtils.composeEventData({
        context: topicContext,
        dialog: dialogSection,
        topic: topicSection
      })
    });
  } catch (error: any) {
    console.error('Error creating dialog.topic.update event:', error);
    // Не прерываем выполнение, если не удалось создать событие
  }
}

// Helper function to verify entity exists
async function verifyEntityExists(entityType: string, entityId: string, tenantId: string): Promise<void> {
  switch (entityType) {
    case 'dialog': {
      const dialog = await Dialog.findOne({ dialogId: entityId, tenantId });
      if (!dialog) {
        const error = new Error(`Dialog ${entityId} not found`) as ErrorWithStatusCode;
        error.statusCode = 404;
        throw error;
      }
      break;
    }
    case 'message': {
      const message = await Message.findOne({ messageId: entityId, tenantId });
      if (!message) {
        const error = new Error('Message not found') as ErrorWithStatusCode;
        error.statusCode = 404;
        throw error;
      }
      break;
    }
    case 'dialogMember': {
      // entityId для DialogMember - это составной ключ dialogId:userId
      // Формат: "dlg_abc123...:carl"
      console.log('verifyEntityExists: dialogMember, entityId:', entityId, 'tenantId:', tenantId);
      const parts = entityId.split(':');
      if (parts.length !== 2) {
        const error = new Error('Invalid DialogMember entityId format. Expected format: dialogId:userId') as ErrorWithStatusCode;
        error.statusCode = 400;
        throw error;
      }
      const [dialogId, userId] = parts;
      console.log('verifyEntityExists: dialogMember, parsed dialogId:', dialogId, 'userId:', userId);
      // ВАЖНО: Используем составной ключ, НЕ _id!
      // Убеждаемся, что dialogId и userId не пустые
      if (!dialogId || !userId) {
        const error = new Error('Invalid DialogMember entityId: dialogId or userId is empty') as ErrorWithStatusCode;
        error.statusCode = 400;
        throw error;
      }
      // Явно указываем, что НЕ используем _id, только dialogId и userId
      const dialogMember = await DialogMember.findOne({ 
        dialogId: String(dialogId).trim(), 
        userId: String(userId).trim(), 
        tenantId: String(tenantId).trim()
      }, { _id: 1, dialogId: 1, userId: 1 }).lean(); // Используем .lean() и явно указываем поля
      console.log('verifyEntityExists: dialogMember found:', !!dialogMember);
      if (!dialogMember) {
        const error = new Error('DialogMember not found') as ErrorWithStatusCode;
        error.statusCode = 404;
        throw error;
      }
      break;
    }
    case 'topic': {
      const topic = await Topic.findOne({ topicId: entityId, tenantId });
      if (!topic) {
        const error = new Error(`Topic ${entityId} not found`) as ErrorWithStatusCode;
        error.statusCode = 404;
        throw error;
      }
      break;
    }
    // Для user, tenant, system не проверяем существование, так как они могут быть строками
    default: {
      break;
    }
  }
}

export default metaController;
