/**
 * Валидация meta key - должна быть непустой строкой
 */
import { Request, Response, NextFunction } from 'express';

export const validateMetaKey = (req: Request, res: Response, next: NextFunction): void => {
  const key = req.params.key;
  
  if (!key) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'Meta key is required',
      field: 'key'
    });
    return;
  }
  
  if (typeof key !== 'string' || key.trim().length === 0) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'Meta key must be a non-empty string',
      field: 'key',
      received: key
    });
    return;
  }
  
  // Проверка на допустимые символы в ключе (буквы, цифры, подчеркивания, дефисы)
  const keyPattern = /^[a-zA-Z0-9_-]+$/;
  
  if (!keyPattern.test(key)) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'Meta key contains invalid characters. Only letters, numbers, underscores, and hyphens are allowed',
      field: 'key',
      received: key
    });
    return;
  }
  
  if (key.length > 100) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'Meta key is too long (maximum 100 characters)',
      field: 'key'
    });
    return;
  }
  
  next();
};
