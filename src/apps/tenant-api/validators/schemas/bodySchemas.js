import Joi from 'joi';

/**
 * Допустимые системные (internal) типы сообщений
 */
const INTERNAL_MESSAGE_TYPES = Object.freeze([
  'internal.text',
  'internal.image',
  'internal.file',
  'internal.audio',
  'internal.video',
  'internal.location',
  'internal.contact'
]);

const INTERNAL_MEDIA_MESSAGE_TYPES = Object.freeze([
  'internal.image',
  'internal.file',
  'internal.audio',
  'internal.video'
]);

const SYSTEM_MESSAGE_TYPE_REGEX = /^system\.[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

const USER_MESSAGE_TYPE_REGEX = /^user\.[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

const META_KEY_SCHEMA = Joi.string().pattern(/^[a-zA-Z0-9_-]+$/).max(100);
const META_VALUE_SCHEMA = Joi.alternatives().try(
  Joi.string(),
  Joi.number(),
  Joi.boolean(),
  Joi.array(),
  Joi.object()
);

const BASE_META_SCHEMA = Joi.object().pattern(META_KEY_SCHEMA, META_VALUE_SCHEMA);

const OPTIONAL_META_SCHEMA = BASE_META_SCHEMA.optional()
  .allow(null)
  .default({})
  .custom((value) => (value === null ? {} : value));

const MEDIA_META_SCHEMA = BASE_META_SCHEMA.keys({
  url: Joi.string().trim().min(1).max(2048).required()
}).required();

/**
 * Схемы валидации для body запросов
 */

/**
 * Схема валидации участника диалога
 */
const memberSchema = Joi.object({
  userId: Joi.string().trim().min(1).max(100).required(),
  type: Joi.string().trim().min(1).max(50).optional(),
  name: Joi.string().trim().min(1).max(200).optional()
});

/**
 * Схема валидации создания диалога
 */
export const createDialogSchema = Joi.object({
  name: Joi.string().trim().min(1).max(500).required(),
  createdBy: Joi.string().trim().min(1).max(100).required(),
  members: Joi.array().items(memberSchema).optional(),
  meta: OPTIONAL_META_SCHEMA
});

/**
 * Схема валидации добавления участника в диалог
 */
export const addDialogMemberSchema = Joi.object({
  userId: Joi.string().trim().min(1).max(100).required(),
  type: Joi.string().trim().min(1).max(50).optional(),
  name: Joi.string().trim().min(1).max(200).optional()
});

/**
 * Схема валидации создания сообщения
 */
export const createMessageSchema = Joi.object({
  content: Joi.alternatives().conditional('type', {
    is: 'internal.text',
    then: Joi.string().trim().min(1).max(10000).required(),
    otherwise: Joi.string().trim().max(10000).allow('').optional().default('')
  }),
  senderId: Joi.string().trim().min(1).max(100).required(),
  type: Joi.string()
    .trim()
    .lowercase()
    .custom((value, helpers) => {
      if (INTERNAL_MESSAGE_TYPES.includes(value)) {
        return value;
      }
      if (SYSTEM_MESSAGE_TYPE_REGEX.test(value)) {
        return value;
      }
      if (USER_MESSAGE_TYPE_REGEX.test(value)) {
        return value;
      }
      return helpers.error('any.invalid');
    })
    .default('internal.text')
    .messages({
      'any.invalid': 'type must be one of the predefined internal.* values or match system.* / user.*'
    }),
  meta: Joi.alternatives().conditional('type', {
    is: Joi.valid(...INTERNAL_MEDIA_MESSAGE_TYPES),
    then: MEDIA_META_SCHEMA,
    otherwise: OPTIONAL_META_SCHEMA
  }),
  quotedMessageId: Joi.string()
    .trim()
    .lowercase()
    .pattern(/^msg_[a-z0-9]{20}$/)
    .optional()
    .allow(null, '')
    .messages({
      'string.pattern.base': 'quotedMessageId must be in format msg_ followed by 20 lowercase alphanumeric characters'
    })
});

/**
 * Схема валидации обновления содержимого сообщения
 * Разрешаем изменять только поле content
 */
export const updateMessageContentSchema = Joi.object({
  content: Joi.string().trim().min(1).max(10000).required()
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
  dataType: Joi.string().valid('string', 'number', 'boolean', 'object', 'array').default('string'),
  scope: Joi.string().trim().min(1).max(100).optional()
});

/**
 * Схема валидации создания tenant
 */
export const createTenantSchema = Joi.object({
  tenantId: Joi.string().trim().max(20).optional(),
  name: Joi.string().trim().min(1).max(200).optional(),
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

/**
 * Схема валидации создания пользователя
 */
export const createUserSchema = Joi.object({
  userId: Joi.string()
    .trim()
    .lowercase()
    .min(1)
    .max(100)
    .pattern(/^[^.]*$/, { name: 'no dots' })
    .message('userId не может содержать точку')
    .required(),
  name: Joi.string().trim().min(1).max(200).optional(),
  type: Joi.string().trim().min(1).max(50).default('user').optional()
});

/**
 * Схема валидации обновления пользователя
 */
export const updateUserSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).optional(),
  type: Joi.string().trim().min(1).max(50).optional()
});

/**
 * Схема валидации ручного обновления unreadCount участника диалога
 */
export const setUnreadCountSchema = Joi.object({
  unreadCount: Joi.number().integer().min(0).required(),
  lastSeenAt: Joi.number().integer().min(0).optional(),
  reason: Joi.string().trim().min(1).max(100).optional()
});

