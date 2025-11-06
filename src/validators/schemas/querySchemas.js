import Joi from 'joi';

/**
 * Общие схемы валидации
 */

/**
 * Схема валидации пагинации
 */
export const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10)
});

/**
 * Схема валидации query параметров с фильтрацией и сортировкой
 */
export const queryWithFilterSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  filter: Joi.string().optional(),
  sort: Joi.string().optional(),
  sortDirection: Joi.string().valid('asc', 'desc').optional()
});

/**
 * Схема валидации query параметров для user dialogs
 */
export const userDialogsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  includeLastMessage: Joi.string().valid('true', 'false').optional(),
  filter: Joi.string().optional(),
  sort: Joi.string().optional(),
  unreadCount: Joi.alternatives().try(
    Joi.number().integer(),
    Joi.string().pattern(/^(gte|gt|lte|lt):\d+$/).optional()
  ).optional(),
  lastSeenAt: Joi.string().pattern(/^(gte|gt|lte|lt):/).optional()
});

/**
 * Схема валидации query параметров для messages
 */
export const messagesQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  filter: Joi.string().optional(),
  sort: Joi.string().pattern(/^\([^,]+,(asc|desc)\)$/).optional()
});

/**
 * Схема валидации query параметров для reactions
 */
export const reactionsQuerySchema = Joi.object({
  reaction: Joi.string().max(50).optional(),
  userId: Joi.string().max(100).optional()
});

