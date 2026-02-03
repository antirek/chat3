/**
 * Валидация status — произвольный статус: буквы, цифры, _ или -, 1–64 символа (например unread, delivered, read, error2). В БД сохраняется в нижнем регистре.
 */
import { Request, Response, NextFunction } from 'express';

const STATUS_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

export const validateStatus = (req: Request, res: Response, next: NextFunction): void => {
  const status = req.params.status;

  if (!status) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'Status is required',
      field: 'status'
    });
    return;
  }

  if (!STATUS_PATTERN.test(status)) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid status format. Use lowercase letters, digits, underscore or hyphen, 1–64 characters (e.g. unread, delivered, read, error2)',
      field: 'status',
      received: status
    });
    return;
  }

  next();
};
