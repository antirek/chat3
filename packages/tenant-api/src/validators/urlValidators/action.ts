/**
 * Валидация action - должен быть 'set' или 'unset'
 */
import { Request, Response, NextFunction } from 'express';

export const validateAction = (req: Request, res: Response, next: NextFunction): void => {
  const action = req.params.action;
  
  if (!action) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'Action is required',
      field: 'action'
    });
    return;
  }
  
  if (action !== 'set' && action !== 'unset') {
    res.status(400).json({
      error: 'Bad Request',
      message: 'Action must be either "set" or "unset"',
      field: 'action',
      received: action
    });
    return;
  }
  
  next();
};
