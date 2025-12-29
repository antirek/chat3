/**
 * Валидация entityType - должен быть одним из разрешенных типов
 */
export const validateEntityType = (req, res, next) => {
  const entityType = req.params.entityType;
  
  if (!entityType) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Entity type is required',
      field: 'entityType'
    });
  }
  
  const validEntityTypes = ['user', 'dialog', 'message', 'tenant', 'system', 'dialogMember', 'topic'];
  
  if (!validEntityTypes.includes(entityType)) {
    return res.status(400).json({
      error: 'Bad Request',
      message: `Invalid entity type. Must be one of: ${validEntityTypes.join(', ')}`,
      field: 'entityType',
      received: entityType,
      validValues: validEntityTypes
    });
  }
  
  next();
};

