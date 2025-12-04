import { User } from '../../../models/index.js';
import { generateTimestamp } from '../../../utils/timestampUtils.js';

/**
 * Проверяет существование пользователя и создает его, если не существует
 * @param {String} tenantId - ID тенанта
 * @param {String} userId - ID пользователя
 * @param {Object} options - Опциональные поля пользователя
 * @param {String} options.type - Тип пользователя (user, bot, contact и т.д.)
 * @returns {Promise<Object>} - Объект пользователя
 */
export async function ensureUserExists(tenantId, userId, options = {}) {
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
      const updateFields = {};
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
  } catch (error) {
    console.error(`Error ensuring user exists: ${error.message}`);
    throw error;
  }
}

