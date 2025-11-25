/**
 * Валидация messageId - должен быть в формате msg_[a-z0-9]{20}
 */
export const validateMessageId = (req, res, next) => {
  const messageId = req.params.messageId;
  
  if (!messageId) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Message ID is required',
      field: 'messageId'
    });
  }
  
  const messageIdPattern = /^msg_[a-z0-9]{20}$/;
  
  if (!messageIdPattern.test(messageId)) {
    return res.status(400).json({
      error: 'Bad Request',
      message: `Invalid message ID format. Expected format: msg_[20 lowercase alphanumeric characters]`,
      field: 'messageId',
      received: messageId,
      example: 'msg_abcdefghij1234567890'
    });
  }
  
  next();
};

