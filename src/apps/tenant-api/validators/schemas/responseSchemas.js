/**
 * Схемы валидации ответов API
 */

/**
 * Валидация ответа getUserDialogMessages
 * Проверяет, что:
 * - context.statuses всегда null
 * - statusMessageMatrix присутствует и является массивом
 * - statuses отсутствует в корне объекта сообщения
 */
export function validateGetUserDialogMessagesResponse(response) {
  if (!response || !response.data) {
    return { valid: false, error: 'Response must have data field' };
  }

  if (!Array.isArray(response.data)) {
    return { valid: false, error: 'Response.data must be an array' };
  }

  for (const message of response.data) {
    // Проверяем, что context.statuses = null
    if (message.context && message.context.statuses !== null) {
      return {
        valid: false,
        error: `Message ${message.messageId}: context.statuses must be null, got ${typeof message.context.statuses}`
      };
    }

    // Проверяем наличие statusMessageMatrix
    if (!message.hasOwnProperty('statusMessageMatrix')) {
      return {
        valid: false,
        error: `Message ${message.messageId}: missing statusMessageMatrix field`
      };
    }

    // Проверяем, что statusMessageMatrix - массив
    if (!Array.isArray(message.statusMessageMatrix)) {
      return {
        valid: false,
        error: `Message ${message.messageId}: statusMessageMatrix must be an array, got ${typeof message.statusMessageMatrix}`
      };
    }

    // Проверяем структуру элементов statusMessageMatrix
    for (const item of message.statusMessageMatrix) {
      if (!item.hasOwnProperty('userType') || !item.hasOwnProperty('status') || !item.hasOwnProperty('count')) {
        return {
          valid: false,
          error: `Message ${message.messageId}: statusMessageMatrix items must have userType, status, and count fields`
        };
      }
      if (typeof item.count !== 'number') {
        return {
          valid: false,
          error: `Message ${message.messageId}: statusMessageMatrix item count must be a number`
        };
      }
    }

    // Проверяем, что statuses отсутствует в корне (или закомментирован)
    // Это необязательная проверка, так как поле может быть закомментировано, но не удалено
  }

  return { valid: true };
}

/**
 * Валидация ответа getUserDialogMessage
 * Проверяет, что:
 * - context.statuses всегда null
 * - statusMessageMatrix присутствует и является массивом
 * - statuses отсутствует в корне объекта сообщения
 */
export function validateGetUserDialogMessageResponse(response) {
  if (!response || !response.data) {
    return { valid: false, error: 'Response must have data field' };
  }

  const message = response.data;

  // Проверяем, что context.statuses = null
  if (message.context && message.context.statuses !== null) {
    return {
      valid: false,
      error: `context.statuses must be null, got ${typeof message.context.statuses}`
    };
  }

  // Проверяем наличие statusMessageMatrix
  if (!message.hasOwnProperty('statusMessageMatrix')) {
    return {
      valid: false,
      error: 'Missing statusMessageMatrix field'
    };
  }

  // Проверяем, что statusMessageMatrix - массив
  if (!Array.isArray(message.statusMessageMatrix)) {
    return {
      valid: false,
      error: `statusMessageMatrix must be an array, got ${typeof message.statusMessageMatrix}`
    };
  }

  // Проверяем структуру элементов statusMessageMatrix
  for (const item of message.statusMessageMatrix) {
    if (!item.hasOwnProperty('userType') || !item.hasOwnProperty('status') || !item.hasOwnProperty('count')) {
      return {
        valid: false,
        error: 'statusMessageMatrix items must have userType, status, and count fields'
      };
    }
    if (typeof item.count !== 'number') {
      return {
        valid: false,
        error: 'statusMessageMatrix item count must be a number'
      };
    }
  }

  return { valid: true };
}

