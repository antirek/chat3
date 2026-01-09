import { User } from '@chat3/models';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';

interface EnsureUserOptions {
  type?: string;
}

/**
 * Проверяет существование пользователя и создает его, если не существует
 * @param tenantId - ID тенанта
 * @param userId - ID пользователя
 * @param options - Опциональные поля пользователя
 * @param options.type - Тип пользователя (user, bot, contact и т.д.)
 * @returns Объект пользователя
 */
export async function ensureUserExists(
  tenantId: string,
  userId: string,
  options: EnsureUserOptions = {}
): Promise<any> {
  try {
    // Проверяем существование пользователя
    let user = await User.findOne({ tenantId, userId }).lean();

    if (!user) {
      // Создаем пользователя, если его нет
      const timestamp = generateTimestamp();
      user = await User.create({
        tenantId,
        userId,
        type: options.type || 'user',
        createdAt: timestamp
      });

      console.log(`✅ Created user ${userId} in tenant ${tenantId}`);
    } else {
      // Обновляем опциональные поля, если они предоставлены и отличаются
      const updateFields: { type?: string } = {};
      if (options.type !== undefined && user.type !== options.type) {
        updateFields.type = options.type;
      }

      if (Object.keys(updateFields).length > 0) {
        await User.updateOne({ tenantId, userId }, { $set: updateFields });
        user = { ...user, ...updateFields };
        console.log(`✅ Updated user ${userId} in tenant ${tenantId}`);
      }
    }

    return user;
  } catch (error: any) {
    console.error(`Error ensuring user exists: ${error.message}`);
    throw error;
  }
}
