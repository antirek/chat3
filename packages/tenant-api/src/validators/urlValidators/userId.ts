/**
 * Валидация userId - должна быть непустой строкой
 */
import { Request, Response, NextFunction } from 'express';

export const validateUserId = (req: Request, res: Response, next: NextFunction): void => {
  const userId = req.params.userId;
  
  if (!userId) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'User ID is required',
      field: 'userId'
    });
    return;
  }
  
  if (typeof userId !== 'string' || userId.trim().length === 0) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'User ID must be a non-empty string',
      field: 'userId',
      received: userId
    });
    return;
  }
  
  // Проверка на допустимые символы (опционально, можно расширить)
  if (userId.length > 100) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'User ID is too long (maximum 100 characters)',
      field: 'userId'
    });
    return;
  }
  
  // Проверка, что userId не содержит точку
  if (userId.includes('.')) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'userId не может содержать точку',
      field: 'userId'
    });
    return;
  }
  
  next();
};
