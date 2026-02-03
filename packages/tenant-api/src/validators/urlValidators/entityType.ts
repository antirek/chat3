/**
 * Валидация entityType - должен быть одним из разрешенных типов
 */
import { Request, Response, NextFunction } from 'express';

export const validateEntityType = (req: Request, res: Response, next: NextFunction): void => {
  const entityType = req.params.entityType;
  
  if (!entityType) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'Entity type is required',
      field: 'entityType'
    });
    return;
  }
  
  const validEntityTypes = ['user', 'dialog', 'message', 'tenant', 'system', 'dialogMember', 'topic', 'pack'];
  
  if (!validEntityTypes.includes(entityType)) {
    res.status(400).json({
      error: 'Bad Request',
      message: `Invalid entity type. Must be one of: ${validEntityTypes.join(', ')}`,
      field: 'entityType',
      received: entityType,
      validValues: validEntityTypes
    });
    return;
  }
  
  next();
};
