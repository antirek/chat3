import Joi from 'joi';

/**
 * Схемы валидации для body запросов
 */

/**
 * Схема валидации создания диалога
 */
export const createDialogSchema = Joi.object({
  name: Joi.string().trim().min(1).max(500).required(),
  createdBy: Joi.string().trim().min(1).max(100).required()
});

/**
 * Схема валидации создания сообщения
 */
export const createMessageSchema = Joi.object({
  content: Joi.string().trim().min(1).max(10000).required(),
  senderId: Joi.string().trim().min(1).max(100).required(),
  type: Joi.string().valid('text', 'image', 'file', 'audio', 'video', 'location', 'contact', 'system').default('text'),
  meta: Joi.object().pattern(
    Joi.string().pattern(/^[a-zA-Z0-9_-]+$/).max(100),
    Joi.alternatives().try(
      Joi.string(),
      Joi.number(),
      Joi.boolean(),
      Joi.array(),
      Joi.object()
    )
  ).optional().allow(null).default({})
});

/**
 * Схема валидации добавления реакции
 */
export const addReactionSchema = Joi.object({
  reaction: Joi.string().trim().min(1).max(50).required(),
  userId: Joi.string().trim().min(1).max(100).optional()
});

/**
 * Схема валидации установки meta
 */
export const setMetaSchema = Joi.object({
  value: Joi.alternatives().try(
    Joi.string(),
    Joi.number(),
    Joi.boolean(),
    Joi.array(),
    Joi.object()
  ).required(),
  dataType: Joi.string().valid('string', 'number', 'boolean', 'object', 'array').default('string')
});

/**
 * Схема валидации создания tenant
 */
export const createTenantSchema = Joi.object({
  tenantId: Joi.string().pattern(/^tnt_[a-z0-9]+$/).optional(),
  name: Joi.string().trim().min(1).max(200).required(),
  domain: Joi.string().trim().min(1).max(200).optional(),
  isActive: Joi.boolean().default(true)
});

/**
 * Схема валидации обновления tenant
 */
export const updateTenantSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).optional(),
  domain: Joi.string().trim().min(1).max(200).optional(),
  isActive: Joi.boolean().optional()
});

