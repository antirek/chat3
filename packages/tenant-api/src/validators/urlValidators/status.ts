/**
 * Валидация status - должен быть одним из: unread, delivered, read
 */
import { Request, Response, NextFunction } from 'express';

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
  
  const validStatuses = ['unread', 'delivered', 'read'];
  
  if (!validStatuses.includes(status)) {
    res.status(400).json({
      error: 'Bad Request',
      message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      field: 'status',
      received: status,
      validValues: validStatuses
    });
    return;
  }
  
  next();
};
