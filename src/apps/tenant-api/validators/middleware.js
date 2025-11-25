/**
 * Middleware для валидации запросов с использованием Joi
 */
import Joi from 'joi';

/**
 * Валидация запроса по схеме Joi
 * @param {Joi.Schema} schema - Схема валидации Joi
 * @param {string} property - Свойство запроса для валидации ('body', 'query', 'params')
 * @returns {Function} Express middleware
 */
export const validate = (schema, property = 'body') => {
  return (req, res, next) => {
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

      return res.status(400).json({
        error: 'Bad Request',
        message: 'Validation error',
        details: errors
      });
    }

    // Заменяем оригинальные данные на валидированные и преобразованные
    req[property] = value;
    next();
  };
};

/**
 * Валидация body запроса
 */
export const validateBody = (schema) => validate(schema, 'body');

/**
 * Валидация query параметров
 */
export const validateQuery = (schema) => validate(schema, 'query');

/**
 * Валидация params параметров
 */
export const validateParams = (schema) => validate(schema, 'params');

