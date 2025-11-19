/**
 * Извлекает тип пользователя из userId на основе префикса
 * 
 * Правила:
 * - Если userId содержит подчеркивание, тип = часть до первого подчеркивания
 * - Если подчеркивания нет или userId пустой/null, возвращается 'usr' (по умолчанию)
 * 
 * @param {string} userId - ID пользователя
 * @returns {string} Тип пользователя (usr, cnt, bot и т.д.), по умолчанию 'usr'
 * 
 * @example
 * extractUserType('usr_123') // 'usr'
 * extractUserType('cnt_456') // 'cnt'
 * extractUserType('bot_789') // 'bot'
 * extractUserType('usr_abc_def') // 'usr' (только до первого подчеркивания)
 * extractUserType('carl') // 'usr' (по умолчанию)
 * extractUserType('') // 'usr'
 * extractUserType(null) // 'usr'
 */
export function extractUserType(userId) {
  if (!userId || typeof userId !== 'string') {
    return 'usr';
  }
  
  const underscoreIndex = userId.indexOf('_');
  if (underscoreIndex === -1) {
    return 'usr'; // По умолчанию, если нет подчеркивания
  }
  
  return userId.substring(0, underscoreIndex);
}

