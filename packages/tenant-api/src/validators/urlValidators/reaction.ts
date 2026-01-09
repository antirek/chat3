/**
 * Валидация reaction - должна быть непустой строкой
 */
import { Request, Response, NextFunction } from 'express';

export const validateReaction = (req: Request, res: Response, next: NextFunction): void => {
  const reaction = req.params.reaction;
  
  if (!reaction) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'Reaction is required',
      field: 'reaction'
    });
    return;
  }
  
  if (typeof reaction !== 'string' || reaction.trim().length === 0) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'Reaction must be a non-empty string',
      field: 'reaction',
      received: reaction
    });
    return;
  }
  
  // Ограничение длины реакции (например, эмодзи или короткий текст)
  if (reaction.length > 50) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'Reaction is too long (maximum 50 characters)',
      field: 'reaction'
    });
    return;
  }
  
  next();
};
