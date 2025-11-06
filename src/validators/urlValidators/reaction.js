/**
 * Валидация reaction - должна быть непустой строкой
 */
export const validateReaction = (req, res, next) => {
  const reaction = req.params.reaction;
  
  if (!reaction) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Reaction is required',
      field: 'reaction'
    });
  }
  
  if (typeof reaction !== 'string' || reaction.trim().length === 0) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Reaction must be a non-empty string',
      field: 'reaction',
      received: reaction
    });
  }
  
  // Ограничение длины реакции (например, эмодзи или короткий текст)
  if (reaction.length > 50) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Reaction is too long (maximum 50 characters)',
      field: 'reaction'
    });
  }
  
  next();
};

