/**
 * Валидация packId - должен быть в формате pck_[a-z0-9]{20}
 */
import { Request, Response, NextFunction } from 'express';

export const validatePackId = (req: Request, res: Response, next: NextFunction): void => {
  const packId = req.params.packId || req.params.id;

  if (!packId) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'Pack ID is required',
      field: 'packId'
    });
    return;
  }

  const packIdPattern = /^pck_[a-z0-9]{20}$/;

  if (!packIdPattern.test(packId)) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid pack ID format. Expected format: pck_[20 lowercase alphanumeric characters]',
      field: 'packId',
      received: packId,
      example: 'pck_abcdefghij1234567890'
    });
    return;
  }

  if (req.params.id && !req.params.packId) {
    req.params.packId = packId;
  }

  next();
};
