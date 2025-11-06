/**
 * Валидация dialogId - должен быть в формате dlg_[a-z0-9]{20}
 * Поддерживает как параметр dialogId, так и id (для совместимости)
 */
export const validateDialogId = (req, res, next) => {
  // Проверяем оба варианта: dialogId и id
  const dialogId = req.params.dialogId || req.params.id;
  
  if (!dialogId) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Dialog ID is required',
      field: 'dialogId'
    });
  }
  
  const dialogIdPattern = /^dlg_[a-z0-9]{20}$/;
  
  if (!dialogIdPattern.test(dialogId)) {
    return res.status(400).json({
      error: 'Bad Request',
      message: `Invalid dialog ID format. Expected format: dlg_[20 lowercase alphanumeric characters]`,
      field: 'dialogId',
      received: dialogId,
      example: 'dlg_abcdefghij1234567890'
    });
  }
  
  // Нормализуем параметр для дальнейшего использования
  if (req.params.id && !req.params.dialogId) {
    req.params.dialogId = dialogId;
  }
  
  next();
};

