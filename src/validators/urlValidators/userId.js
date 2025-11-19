/**
 * Валидация userId - должна быть непустой строкой
 */
export const validateUserId = (req, res, next) => {
  const userId = req.params.userId;
  
  if (!userId) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'User ID is required',
      field: 'userId'
    });
  }
  
  if (typeof userId !== 'string' || userId.trim().length === 0) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'User ID must be a non-empty string',
      field: 'userId',
      received: userId
    });
  }
  
  // Проверка на допустимые символы (опционально, можно расширить)
  if (userId.length > 100) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'User ID is too long (maximum 100 characters)',
      field: 'userId'
    });
  }
  
  // Проверка, что userId не содержит точку
  if (userId.includes('.')) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'userId не может содержать точку',
      field: 'userId'
    });
  }
  
  next();
};

