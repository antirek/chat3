import { User } from '@chat3/models';

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

