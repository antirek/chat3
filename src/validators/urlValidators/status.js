/**
 * Валидация status - должен быть одним из: unread, delivered, read
 */
export const validateStatus = (req, res, next) => {
  const status = req.params.status;
  
  if (!status) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Status is required',
      field: 'status'
    });
  }
  
  const validStatuses = ['unread', 'delivered', 'read'];
  
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      error: 'Bad Request',
      message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      field: 'status',
      received: status,
      validValues: validStatuses
    });
  }
  
  next();
};

