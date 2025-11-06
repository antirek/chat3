/**
 * Валидация meta key - должна быть непустой строкой
 */
export const validateMetaKey = (req, res, next) => {
  const key = req.params.key;
  
  if (!key) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Meta key is required',
      field: 'key'
    });
  }
  
  if (typeof key !== 'string' || key.trim().length === 0) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Meta key must be a non-empty string',
      field: 'key',
      received: key
    });
  }
  
  // Проверка на допустимые символы в ключе (буквы, цифры, подчеркивания, дефисы)
  const keyPattern = /^[a-zA-Z0-9_-]+$/;
  
  if (!keyPattern.test(key)) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Meta key contains invalid characters. Only letters, numbers, underscores, and hyphens are allowed',
      field: 'key',
      received: key
    });
  }
  
  if (key.length > 100) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Meta key is too long (maximum 100 characters)',
      field: 'key'
    });
  }
  
  next();
};

