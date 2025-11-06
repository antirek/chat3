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

  // Get specific meta key for an entity
  async getMetaKey(req, res) {
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

      // Get meta value
      const value = await metaUtils.getEntityMetaValue(req.tenantId, entityType, entityId, key);

      if (value === null) {
        return res.status(404).json({
          error: 'Not Found',
          message: `Meta key '${key}' not found for ${entityType} ${entityId}`
        });
      }

      res.json({
        data: sanitizeResponse({
          key,
          value
        })
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
      const { entityType, entityId, key } = req.params;
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
        const error = new Error('Dialog not found');
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
      const dialogMember = await DialogMember.findOne({ _id: entityId, tenantId });
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

