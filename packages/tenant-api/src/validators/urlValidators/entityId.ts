/**
 * Валидация entityId - должна быть непустой строкой
 */
import { Request, Response, NextFunction } from 'express';

export const validateEntityId = (req: Request, res: Response, next: NextFunction): void => {
  const entityId = req.params.entityId;
  
  if (!entityId) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'Entity ID is required',
      field: 'entityId'
    });
    return;
  }
  
  if (typeof entityId !== 'string' || entityId.trim().length === 0) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'Entity ID must be a non-empty string',
      field: 'entityId',
      received: entityId
    });
    return;
  }
  
  next();
};
