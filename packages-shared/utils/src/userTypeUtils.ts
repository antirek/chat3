import { User } from '@chat3/models';

/**
 * Получает тип пользователя из модели User
 * @param tenantId - ID тенанта
 * @param userId - ID пользователя
 * @returns Тип пользователя (по умолчанию 'user')
 */
export async function getUserType(tenantId: string, userId: string): Promise<string> {
  try {
    if (!userId || typeof userId !== 'string') {
      return 'user';
    }

    // В схеме User поле userId хранится с trim + lowercase; для поиска нормализуем так же
    const normalizedUserId = userId.trim().toLowerCase();

    const user = await User.findOne({
      tenantId: tenantId,
      userId: normalizedUserId
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
