import { User } from '../models/index.js';

/**
 * Извлекает тип пользователя из userId на основе префикса (fallback метод)
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

/**
 * Получает тип пользователя из модели User
 * @param {string} tenantId - ID тенанта
 * @param {string} userId - ID пользователя
 * @returns {Promise<string>} Тип пользователя (по умолчанию 'user')
 */
export async function getUserType(tenantId, userId) {
  try {
    if (!userId || typeof userId !== 'string') {
      return 'user';
    }

    // Получаем тип из модели User
    const user = await User.findOne({
      tenantId: tenantId,
      userId: userId
    }).select('type').lean();

    if (user && user.type) {
      return user.type;
    }

    // Если пользователь не найден или тип не указан, возвращаем дефолтное значение 'user'
    return 'user';
  } catch (error) {
    console.error(`Error getting user type for ${userId}:`, error);
    // В случае ошибки возвращаем дефолтное значение
    return 'user';
  }
}

