/**
 * Утилиты для работы с connection ID
 */

/**
 * Генерирует уникальный connection ID
 * Формат: conn_ + 5 символов (a-z0-9)
 * @returns connId в формате conn_xxxxx
 */
export function generateConnectionId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'conn_';
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Форматирует имя очереди для пользователя
 * @param userId - ID пользователя
 * @param connId - ID соединения
 * @returns Имя очереди в формате user_{userId}_conn_{connId}_updates
 */
export function formatUserQueueName(userId: string, connId: string): string {
  return `user_${userId}_conn_${connId}_updates`;
}
