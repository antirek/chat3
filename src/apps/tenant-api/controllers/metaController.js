import * as metaUtils from '../utils/metaUtils.js';
import { Dialog, Message, DialogMember, User } from '../../../models/index.js';
import { sanitizeResponse } from '../utils/responseUtils.js';
import * as eventUtils from '../utils/eventUtils.js';
import * as updateUtils from '../../../utils/updateUtils.js';

const metaController = {
  // Get all meta for an entity
  async getMeta(req, res) {
    try {
      const { entityType, entityId } = req.params;

      // Validate entityType
      const validEntityTypes = ['user', 'dialog', 'message', 'tenant', 'system', 'dialogMember'];
      if (!validEntityTypes.includes(entityType)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: `Invalid entityType. Must be one of: ${validEntityTypes.join(', ')}`
        });
      }

      // Optional: Verify entity exists (for dialog, message, dialogMember)
      await verifyEntityExists(entityType, entityId, req.tenantId);

      // Get meta data
      const meta = await metaUtils.getEntityMeta(req.tenantId, entityType, entityId);

      res.json({
        data: sanitizeResponse(meta)
      });
    } catch (error) {
      if (error.statusCode === 404) {
        return res.status(404).json({
          error: 'Not Found',
          message: error.message
        });
      }
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  // Set or update meta for an entity
  async setMeta(req, res) {
    try {
      // Декодируем entityId из URL (на случай если пришло закодированное)
      const { entityType, entityId: rawEntityId, key } = req.params;
      const entityId = decodeURIComponent(rawEntityId || '');
      
      console.log('setMeta: rawEntityId:', rawEntityId, 'decoded entityId:', entityId, 'entityType:', entityType);
      const { value, dataType = 'string' } = req.body;

      // Validate entityType
      const validEntityTypes = ['user', 'dialog', 'message', 'tenant', 'system', 'dialogMember'];
      if (!validEntityTypes.includes(entityType)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: `Invalid entityType. Must be one of: ${validEntityTypes.join(', ')}`
        });
      }

      // Validate dataType
      const validDataTypes = ['string', 'number', 'boolean', 'object', 'array'];
      if (!validDataTypes.includes(dataType)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: `Invalid dataType. Must be one of: ${validDataTypes.join(', ')}`
        });
      }

      // Optional: Verify entity exists
      await verifyEntityExists(entityType, entityId, req.tenantId);

      // Set meta
      const meta = await metaUtils.setEntityMeta(
        req.tenantId,
        entityType,
        entityId,
        key,
        value,
        dataType,
        {
          createdBy: req.apiKey?.name || 'api'
        }
      );

      // Генерируем события при обновлении мета-тегов
      const actorId = req.userId || req.apiKey?.name || 'api';
      if (entityType === 'dialog') {
        await createDialogUpdateEvent(req.tenantId, entityId, actorId);
      } else if (entityType === 'message') {
        await createMessageUpdateEvent(req.tenantId, entityId, actorId);
      } else if (entityType === 'dialogMember') {
        await createDialogMemberUpdateEvent(req.tenantId, entityId, actorId);
      } else if (entityType === 'user') {
        await createUserUpdateEvent(req.tenantId, entityId, actorId);
      }

      res.json({
        data: sanitizeResponse(meta),
        message: 'Meta set successfully'
      });
    } catch (error) {
      console.error('Error in setMeta:', error);
      if (error.statusCode === 404) {
        return res.status(404).json({
          error: 'Not Found',
          message: error.message
        });
      }
      if (error.statusCode === 400) {
        return res.status(400).json({
          error: 'Bad Request',
          message: error.message
        });
      }
      // Проверяем, не является ли это ошибкой каста ObjectId
      if (error.message && error.message.includes('Cast to ObjectId')) {
        console.error('ObjectId cast error detected:', error.message);
        return res.status(400).json({
          error: 'Bad Request',
          message: `Invalid entityId format for ${req.params.entityType}. For dialogMember, use format: dialogId:userId`
        });
      }
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  // Delete meta key for an entity
  async deleteMeta(req, res) {
    try {
      const { entityType, entityId, key } = req.params;

      // Validate entityType
      const validEntityTypes = ['user', 'dialog', 'message', 'tenant', 'system', 'dialogMember'];
      if (!validEntityTypes.includes(entityType)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: `Invalid entityType. Must be one of: ${validEntityTypes.join(', ')}`
        });
      }

      // Optional: Verify entity exists
      await verifyEntityExists(entityType, entityId, req.tenantId);

      // Delete meta
      const deleted = await metaUtils.deleteEntityMeta(
        req.tenantId,
        entityType,
        entityId,
        key
      );

      if (!deleted) {
        return res.status(404).json({
          error: 'Not Found',
          message: `Meta key '${key}' not found for ${entityType} ${entityId}`
        });
      }

      // Генерируем события при удалении мета-тегов
      const actorId = req.userId || req.apiKey?.name || 'api';
      if (entityType === 'dialog') {
        await createDialogUpdateEvent(req.tenantId, entityId, actorId);
      } else if (entityType === 'message') {
        await createMessageUpdateEvent(req.tenantId, entityId, actorId);
      } else if (entityType === 'dialogMember') {
        await createDialogMemberUpdateEvent(req.tenantId, entityId, actorId);
      }

      res.json({
        message: 'Meta deleted successfully'
      });
    } catch (error) {
      if (error.statusCode === 404) {
        return res.status(404).json({
          error: 'Not Found',
          message: error.message
        });
      }
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  }
};

// Helper function to create dialog.update event
async function createDialogUpdateEvent(tenantId, dialogId, actorId) {
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
      createdBy: dialog.createdBy,
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
  } catch (error) {
    console.error('Error creating dialog.update event:', error);
    // Не прерываем выполнение, если не удалось создать событие
  }
}

// Helper function to create message.update event
async function createMessageUpdateEvent(tenantId, messageId, actorId) {
  try {
    const message = await Message.findOne({ messageId, tenantId });
    if (!message) {
      console.warn(`Message ${messageId} not found for update event`);
      return;
    }

    const messageMeta = await metaUtils.getEntityMeta(tenantId, 'message', messageId);

    // Получаем диалог и его метаданные для события
    const { Dialog } = await import('../../../models/index.js');
    const dialog = await Dialog.findOne({
      dialogId: message.dialogId,
      tenantId
    }).lean();

    let dialogSection = null;
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
  } catch (error) {
    console.error('Error creating message.update event:', error);
    // Не прерываем выполнение, если не удалось создать событие
  }
}

// Helper function to create user.update event
async function createUserUpdateEvent(tenantId, userId, actorId) {
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
  } catch (error) {
    console.error('Error creating user.update event:', error);
    // Не прерываем выполнение, если не удалось создать событие
  }
}

// Helper function to create dialog.member.update event
async function createDialogMemberUpdateEvent(tenantId, entityId, actorId) {
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
      createdBy: dialog.createdBy,
      createdAt: dialog.createdAt,
      meta: dialogMeta || {}
    });

    const memberMeta = await metaUtils.getEntityMeta(tenantId, 'dialogMember', entityId);

    const memberSection = eventUtils.buildMemberSection({
      userId: dialogMember.userId,
      meta: memberMeta,
      state: {
        unreadCount: dialogMember.unreadCount,
        lastSeenAt: dialogMember.lastSeenAt,
        lastMessageAt: dialogMember.lastMessageAt,
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
  } catch (error) {
    console.error('Error creating dialog.member.update event:', error);
    // Не прерываем выполнение, если не удалось создать событие
  }
}

// Helper function to verify entity exists
async function verifyEntityExists(entityType, entityId, tenantId) {
  switch (entityType) {
    case 'dialog':
      const dialog = await Dialog.findOne({ dialogId: entityId, tenantId });
      if (!dialog) {
        const error = new Error(`Dialog ${entityId} not found`);
        error.statusCode = 404;
        throw error;
      }
      break;
    case 'message':
      const message = await Message.findOne({ messageId: entityId, tenantId });
      if (!message) {
        const error = new Error('Message not found');
        error.statusCode = 404;
        throw error;
      }
      break;
    case 'dialogMember':
      // entityId для DialogMember - это составной ключ dialogId:userId
      // Формат: "dlg_abc123...:carl"
      console.log('verifyEntityExists: dialogMember, entityId:', entityId, 'tenantId:', tenantId);
      const parts = entityId.split(':');
      if (parts.length !== 2) {
        const error = new Error('Invalid DialogMember entityId format. Expected format: dialogId:userId');
        error.statusCode = 400;
        throw error;
      }
      const [dialogId, userId] = parts;
      console.log('verifyEntityExists: dialogMember, parsed dialogId:', dialogId, 'userId:', userId);
      // ВАЖНО: Используем составной ключ, НЕ _id!
      // Убеждаемся, что dialogId и userId не пустые
      if (!dialogId || !userId) {
        const error = new Error('Invalid DialogMember entityId: dialogId or userId is empty');
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
        const error = new Error('DialogMember not found');
        error.statusCode = 404;
        throw error;
      }
      break;
    // Для user, tenant, system не проверяем существование, так как они могут быть строками
    default:
      break;
  }
}

export default metaController;

