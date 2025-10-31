import mongoose from 'mongoose';
import MessageReaction from '../models/MessageReaction.js';
import Message from '../models/Message.js';

/**
 * Обновляет счетчики реакций в Message.reactionCounts
 * на основе всех реакций в MessageReaction для данного сообщения
 */
export async function updateReactionCounts(tenantId, messageId) {
  try {
    // Агрегируем реакции по типу
    const reactions = await MessageReaction.aggregate([
      {
        $match: {
          tenantId: new mongoose.Types.ObjectId(tenantId),
          messageId: new mongoose.Types.ObjectId(messageId)
        }
      },
      {
        $group: {
          _id: '$reaction',
          count: { $sum: 1 }
        }
      }
    ]);

    // Преобразуем в объект { "👍": 5, "❤️": 3 }
    const reactionCounts = {};
    reactions.forEach(reaction => {
      reactionCounts[reaction._id] = reaction.count;
    });

    // Обновляем счетчики в Message
    await Message.updateOne(
      { _id: new mongoose.Types.ObjectId(messageId), tenantId: new mongoose.Types.ObjectId(tenantId) },
      { $set: { reactionCounts: reactionCounts } }
    );

    return reactionCounts;
  } catch (error) {
    console.error('Error updating reaction counts:', error);
    throw error;
  }
}

/**
 * Увеличивает счетчик конкретной реакции
 */
export async function incrementReactionCount(tenantId, messageId, reaction) {
  try {
    await Message.updateOne(
      { _id: messageId, tenantId: tenantId },
      { $inc: { [`reactionCounts.${reaction}`]: 1 } }
    );
  } catch (error) {
    console.error('Error incrementing reaction count:', error);
    // Если ошибка, пересчитываем все счетчики
    await updateReactionCounts(tenantId, messageId);
  }
}

/**
 * Уменьшает счетчик конкретной реакции
 */
export async function decrementReactionCount(tenantId, messageId, reaction) {
  try {
    const message = await Message.findOne({ _id: messageId, tenantId: tenantId });
    if (!message) return;

    const currentCount = message.reactionCounts?.[reaction] || 0;
    
    if (currentCount <= 1) {
      // Удаляем ключ, если счетчик становится 0 или меньше
      await Message.updateOne(
        { _id: messageId, tenantId: tenantId },
        { $unset: { [`reactionCounts.${reaction}`]: "" } }
      );
    } else {
      // Уменьшаем счетчик
      await Message.updateOne(
        { _id: messageId, tenantId: tenantId },
        { $inc: { [`reactionCounts.${reaction}`]: -1 } }
      );
    }
  } catch (error) {
    console.error('Error decrementing reaction count:', error);
    // Если ошибка, пересчитываем все счетчики
    await updateReactionCounts(tenantId, messageId);
  }
}

