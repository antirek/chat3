/**
 * Валидация topicId - должен быть в формате topic_[a-z0-9]{20}
 */
import { Request, Response, NextFunction } from 'express';

export const validateTopicId = (req: Request, res: Response, next: NextFunction): void => {
  const topicId = req.params.topicId;

  if (!topicId) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'Topic ID is required',
      field: 'topicId'
    });
    return;
  }

  const topicIdPattern = /^topic_[a-z0-9]{20}$/;

  if (!topicIdPattern.test(topicId)) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid topic ID format. Expected format: topic_[20 lowercase alphanumeric characters]',
      field: 'topicId',
      received: topicId,
      example: 'topic_abcdefghij1234567890'
    });
    return;
  }

  next();
};
