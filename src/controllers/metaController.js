import * as metaUtils from '../utils/metaUtils.js';
import { Dialog, Message, DialogMember } from '../models/index.js';
import { sanitizeResponse } from '../utils/responseUtils.js';

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
        { createdBy: req.apiKey?.name || 'api' }
      );

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
          message: `Invalid entityId format for ${entityType}. For dialogMember, use format: dialogId:userId`
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
      const deleted = await metaUtils.deleteEntityMeta(req.tenantId, entityType, entityId, key);

      if (!deleted) {
        return res.status(404).json({
          error: 'Not Found',
          message: `Meta key '${key}' not found for ${entityType} ${entityId}`
        });
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

