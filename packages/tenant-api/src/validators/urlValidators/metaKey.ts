/**
 * Валидация meta key: непустая строка, алфавит [a-zA-Z0-9_], без точки и дефиса.
 */
import { Request, Response, NextFunction } from 'express';
import { META_KEY_PATTERN, META_KEY_MAX_LENGTH, META_KEY_INVALID_MESSAGE } from '../metaKeyPattern.js';

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

  if (!META_KEY_PATTERN.test(key)) {
    res.status(400).json({
      error: 'Bad Request',
      message: META_KEY_INVALID_MESSAGE,
      field: 'key',
      received: key
    });
    return;
  }

  if (key.length > META_KEY_MAX_LENGTH) {
    res.status(400).json({
      error: 'Bad Request',
      message: `Meta key is too long (maximum ${META_KEY_MAX_LENGTH} characters)`,
      field: 'key'
    });
    return;
  }

  next();
};
