/**
 * Валидация action - должен быть 'set' или 'unset'
 */
export const validateAction = (req, res, next) => {
  const action = req.params.action;
  
  if (!action) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Action is required',
      field: 'action'
    });
  }
  
  if (action !== 'set' && action !== 'unset') {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Action must be either "set" or "unset"',
      field: 'action',
      received: action
    });
  }
  
  next();
};

