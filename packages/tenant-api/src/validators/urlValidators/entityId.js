/**
 * Валидация entityId - должна быть непустой строкой
 */
export const validateEntityId = (req, res, next) => {
  const entityId = req.params.entityId;
  
  if (!entityId) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Entity ID is required',
      field: 'entityId'
    });
  }
  
  if (typeof entityId !== 'string' || entityId.trim().length === 0) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Entity ID must be a non-empty string',
      field: 'entityId',
      received: entityId
    });
  }
  
  next();
};

