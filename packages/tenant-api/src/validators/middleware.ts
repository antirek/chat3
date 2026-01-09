/**
 * Middleware для валидации запросов с использованием Joi
 */

import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';

type ValidationProperty = 'body' | 'query' | 'params';

/**
 * Валидация запроса по схеме Joi
 * @param schema - Схема валидации Joi
 * @param property - Свойство запроса для валидации ('body', 'query', 'params')
 * @returns Express middleware
 */
export const validate = (schema: Joi.Schema, property: ValidationProperty = 'body') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Преобразуем пустые строки в undefined для query параметров
    const dataToValidate = property === 'query' 
      ? Object.fromEntries(
          Object.entries(req[property]).map(([key, value]) => [
            key,
            value === '' ? undefined : value
          ])
        )
      : req[property];

    const { error, value } = schema.validate(dataToValidate, {
      abortEarly: false, // Собираем все ошибки, а не только первую
      stripUnknown: true, // Удаляем неизвестные поля
      convert: true // Преобразуем типы (например, строки в числа)
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      res.status(400).json({
        error: 'Bad Request',
        message: 'Validation error',
        details: errors
      });
      return;
    }

    // Заменяем оригинальные данные на валидированные и преобразованные
    (req as any)[property] = value;
    next();
  };
};

/**
 * Валидация body запроса
 */
export const validateBody = (schema: Joi.Schema) => validate(schema, 'body');

/**
 * Валидация query параметров
 */
export const validateQuery = (schema: Joi.Schema) => validate(schema, 'query');

/**
 * Валидация params параметров
 */
export const validateParams = (schema: Joi.Schema) => validate(schema, 'params');
