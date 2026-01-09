import { 
  UserStats, 
  UserDialogStats, 
  MessageReactionStats, 
  MessageStatusStats, 
  CounterHistory,
  DialogMember,
  Message,
  MessageStatus,
  UserTopicStats,
  DialogStats,
  Topic
} from '@chat3/models';
import { generateTimestamp } from './timestampUtils.js';
import { createUserStatsUpdate } from './updateUtils.js';

/**
 * Контекст операции для сбора измененных полей
 * Используется для создания одного user.stats.update со всеми изменениями
 */
class CounterUpdateContext {
  constructor(tenantId, userId, sourceEventId, sourceEventType) {
    this.tenantId = tenantId;
    this.userId = userId;
    this.sourceEventId = sourceEventId;
    this.sourceEventType = sourceEventType;
    this.updatedFields = new Set(); // Множество измененных полей
  }
  
  addUpdatedField(field) {
    this.updatedFields.add(field);
  }
  
  hasUpdates() {
    return this.updatedFields.size > 0;
  }
  
  getUpdatedFields() {
    return Array.from(this.updatedFields);
  }
  
  async createStatsUpdate() {
    if (this.hasUpdates() && this.sourceEventId) {
      await createUserStatsUpdate(
        this.tenantId,
        this.userId,
        this.sourceEventId,
        this.sourceEventType,
        this.getUpdatedFields()
      );
    }
  }
}

// Глобальный Map для хранения контекстов операций по ключу (tenantId:userId:sourceEventId)
// КРИТИЧНО: Добавлен TTL механизм для предотвращения утечек памяти
const counterUpdateContexts = new Map();
const contextTimestamps = new Map();
const CONTEXT_TTL_MS = 3 * 60 * 1000; // 3 минуты

// Периодическая очистка старых контекстов
// КРИТИЧНО: Используем unref() чтобы interval не блокировал завершение процесса
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  let cleanedCount = 0;
  const totalBefore = counterUpdateContexts.size;
  
  console.log(`[CounterContext] Начало очистки контекстов. Всего контекстов: ${totalBefore}`);
  
  for (const [key, timestamp] of contextTimestamps.entries()) {
    if (now - timestamp > CONTEXT_TTL_MS) {
      const context = counterUpdateContexts.get(key);
      if (context) {
        // Финализируем старый контекст перед удалением
        context.createStatsUpdate().catch(err => {
          console.error(`[CounterContext] Failed to finalize expired context ${key}:`, err);
        });
      }
      counterUpdateContexts.delete(key);
      contextTimestamps.delete(key);
      cleanedCount++;
    }
  }
  
  const totalAfter = counterUpdateContexts.size;
  console.log(`[CounterContext] Очистка завершена. Удалено: ${cleanedCount}, осталось: ${totalAfter}`);
}, CONTEXT_TTL_MS);

// КРИТИЧНО: unref() позволяет процессу завершиться даже если interval активен
// Это решает проблему с Jest, который жалуется на незакрытые асинхронные операции
if (cleanupInterval.unref) {
  cleanupInterval.unref();
}

/**
 * Получить или создать контекст операции
 */
function getCounterUpdateContext(tenantId, userId, sourceEventId, sourceEventType) {
  const key = `${tenantId}:${userId}:${sourceEventId || 'no-event'}`;
  
  // КРИТИЧНО: Очистка старых контекстов выполняется периодически через setInterval
  // Не выполняем очистку при каждом вызове для улучшения производительности
  
  if (!counterUpdateContexts.has(key)) {
    counterUpdateContexts.set(key, new CounterUpdateContext(tenantId, userId, sourceEventId, sourceEventType));
    contextTimestamps.set(key, Date.now());
  }
  
  return counterUpdateContexts.get(key);
}

/**
 * Завершить контекст и создать user.stats.update
 * КРИТИЧНО: Гарантированная очистка контекста
 */
export async function finalizeCounterUpdateContext(tenantId, userId, sourceEventId) {
  const key = `${tenantId}:${userId}:${sourceEventId || 'no-event'}`;
  const context = counterUpdateContexts.get(key);
  
  if (context) {
    try {
      // КРИТИЧНО: Удаляем контекст ДО создания update, чтобы предотвратить повторную финализацию
      counterUpdateContexts.delete(key);
      contextTimestamps.delete(key);
      
      await context.createStatsUpdate();
    } catch (error) {
      console.error(`Failed to create stats update for context ${key}:`, error);
    }
  }
}

/**
 * Сохранить запись в историю изменений счетчиков
 */
async function saveCounterHistory(data) {
  try {
    await CounterHistory.create({
      tenantId: data.tenantId,
      counterType: data.counterType,
      entityType: data.entityType,
      entityId: data.entityId,
      field: data.field,
      oldValue: data.oldValue,
      newValue: data.newValue,
      delta: data.delta,
      operation: data.operation,
      sourceOperation: data.sourceOperation,
      sourceEntityId: data.sourceEntityId,
      actorId: data.actorId,
      actorType: data.actorType || 'user',
      createdAt: generateTimestamp()
    });
  } catch (error) {
    console.error('Error saving counter history:', error);
    // Не прерываем выполнение при ошибке сохранения истории
  }
}

/**
 * Обновление unreadCount
 * КРИТИЧНО: Используем атомарные операции для предотвращения race conditions
 * @param {string} tenantId - ID тенанта
 * @param {string} userId - ID пользователя
 * @param {string} dialogId - ID диалога
 * @param {number} delta - Изменение счетчика (+1 или -1)
 * @param {string} sourceOperation - Тип операции
 * @param {string} sourceEventId - ID события
 * @param {string} sourceEntityId - ID сущности
 * @param {string} actorId - ID актора
 * @param {string} actorType - Тип актора
 * @param {string|null} topicId - ID топика (опционально). Если указан, обновляет UserTopicStats, иначе UserDialogStats
 * @param {Object} session - MongoDB session для транзакций (опционально)
 */
export async function updateUnreadCount(tenantId, userId, dialogId, delta, sourceOperation, sourceEventId, sourceEntityId, actorId, actorType, topicId = null, session = null) {
  // Если topicId указан, обновляем UserTopicStats для конкретного топика
  // (updateTopicUnreadCount определена ниже, но это нормально для hoisting в JS)
  if (topicId) {
    // Обновляем счетчик топика напрямую, чтобы избежать рекурсии
    const timestamp = generateTimestamp();
    const topicUpdateOptions = {
      upsert: true,
      new: true
    };
    if (session) {
      topicUpdateOptions.session = session;
    }

    await UserTopicStats.findOneAndUpdate(
      { tenantId, userId, dialogId, topicId },
      [
        {
          $set: {
            unreadCount: {
              $max: [
                { $add: [{ $ifNull: ["$unreadCount", 0] }, delta] },
                0
              ]
            },
            lastUpdatedAt: timestamp,
            createdAt: { $ifNull: ["$createdAt", timestamp] }
          }
        }
      ],
      topicUpdateOptions
    );
    // Общий счетчик диалога обновим ниже
  }

  // КРИТИЧНО: Используем pipeline update с $max для атомарной защиты от отрицательных значений
  // Это предотвращает race conditions и убирает необходимость в дополнительном запросе
  const timestamp = generateTimestamp();
  const updateOptions = { 
    upsert: true, 
    new: true
  };
  if (session) {
    updateOptions.session = session;
  }

  const result = await UserDialogStats.findOneAndUpdate(
    { tenantId, userId, dialogId },
    [
      {
        $set: {
          unreadCount: {
            $max: [
              { $add: [{ $ifNull: ["$unreadCount", 0] }, delta] },
              0
            ]
          },
          lastUpdatedAt: timestamp,
          createdAt: { $ifNull: ["$createdAt", timestamp] }
        }
      }
    ],
    updateOptions
  );
  
  // Вычисляем старое и новое значение
  const newValue = result.unreadCount || 0;
  const oldValue = Math.max(0, newValue - delta);
  
  // Сохраняем sourceEventId и sourceEventType для использования в обновлении UserStats
  // (используем временные поля, которые не сохраняются в БД)
  result._sourceEventId = sourceEventId;
  result._sourceEventType = sourceOperation;
  
  // Обновляем UserStats (вычисляемые счетчики)
  await updateUserStatsFromUnreadCount(tenantId, userId, oldValue, newValue, sourceEventId, sourceOperation);
  
  // Сохраняем в историю
  await saveCounterHistory({
    counterType: 'userDialogStats.unreadCount',
    entityType: 'userDialogStats',
    entityId: `${dialogId}:${userId}`,
    field: 'unreadCount',
    oldValue,
    newValue,
    delta,
    operation: delta > 0 ? 'increment' : 'decrement',
    sourceOperation,
    sourceEntityId,
    actorId,
    actorType: actorType || 'user',
    tenantId
  });
  
  return { oldValue, newValue };
}

/**
 * Обновление reactionCount
 * КРИТИЧНО: Используем атомарные операции
 */
export async function updateReactionCount(tenantId, messageId, reaction, delta, sourceOperation, actorId, actorType) {
  // Атомарное обновление с $inc
  const result = await MessageReactionStats.findOneAndUpdate(
    { tenantId, messageId, reaction },
    { 
      $inc: { count: delta },
      $set: { lastUpdatedAt: generateTimestamp() },
      $setOnInsert: {
        createdAt: generateTimestamp()
      }
    },
    { 
      upsert: true, 
      new: true,
      setDefaultsOnInsert: true
    }
  );
  
  const newCount = result.count;
  const oldCount = newCount - delta;
  
  if (newCount <= 0) {
    // Удаляем запись если счетчик стал 0 или отрицательным
    await MessageReactionStats.deleteOne({ tenantId, messageId, reaction });
    return { oldValue: oldCount, newValue: 0 };
  }
  
  // Сохраняем в историю
  await saveCounterHistory({
    counterType: 'messageReactionStats.count',
    entityType: 'messageReactionStats',
    entityId: `${messageId}:${reaction}`,
    field: 'count',
    oldValue: oldCount,
    newValue: newCount,
    delta,
    operation: delta > 0 ? 'increment' : 'decrement',
    sourceOperation,
    sourceEntityId: messageId,
    actorId,
    actorType: actorType || 'user',
    tenantId
  });
  
  return { oldValue: oldCount, newValue: newCount };
}

/**
 * Обновление statusCount
 * КРИТИЧНО: Используем атомарные операции
 */
export async function updateStatusCount(tenantId, messageId, status, delta, sourceOperation, actorId, actorType) {
  // КРИТИЧНО: Используем pipeline update с $max для атомарной защиты от отрицательных значений
  const timestamp = generateTimestamp();
  const result = await MessageStatusStats.findOneAndUpdate(
    { tenantId, messageId, status },
    [
      {
        $set: {
          count: {
            $max: [
              { $add: [{ $ifNull: ["$count", 0] }, delta] },
              0
            ]
          },
          lastUpdatedAt: timestamp,
          createdAt: { $ifNull: ["$createdAt", timestamp] }
        }
      }
    ],
    { 
      upsert: true, 
      new: true
    }
  );
  
  const newCount = result.count || 0;
  const oldCount = Math.max(0, newCount - delta);
  
  // Сохраняем в историю
  await saveCounterHistory({
    counterType: 'messageStatusStats.count',
    entityType: 'messageStatusStats',
    entityId: `${messageId}:${status}`,
    field: 'count',
    oldValue: oldCount,
    newValue: newCount,
    delta,
    operation: 'increment',
    sourceOperation,
    sourceEntityId: messageId,
    actorId,
    actorType: actorType || 'user',
    tenantId
  });
  
  return { oldValue: oldCount, newValue: newCount };
}

/**
 * Получение всех реакций сообщения
 */
export async function getMessageReactionCounts(tenantId, messageId) {
  const stats = await MessageReactionStats.find({ tenantId, messageId }).lean();
  return stats.map(s => ({
    reaction: s.reaction,
    count: s.count
  }));
}

/**
 * Получение всех статусов сообщения
 */
export async function getMessageStatusCounts(tenantId, messageId) {
  const stats = await MessageStatusStats.find({ tenantId, messageId }).lean();
  return stats.map(s => ({
    status: s.status,
    count: s.count
  }));
}

/**
 * Обновление UserStats на основе изменения unreadCount
 * КРИТИЧНО: Используем инкрементальный пересчет для производительности
 * Полный пересчет выполняется только в recalculateUserStats
 */
async function updateUserStatsFromUnreadCount(tenantId, userId, oldUnreadCount, newUnreadCount, sourceEventId = null, sourceEventType = null) {
  // Нормализуем значения
  const oldValue = Math.max(0, oldUnreadCount || 0);
  const newValue = Math.max(0, newUnreadCount || 0);
  const delta = newValue - oldValue;
  
  // Если значения не изменились, ничего не делаем
  if (delta === 0) {
    return;
  }
  
  // Получаем контекст операции
  const context = sourceEventId ? getCounterUpdateContext(tenantId, userId, sourceEventId, sourceEventType) : null;
  
  // Вычисляем изменения для unreadDialogsCount
  // Если unreadCount меняется с 0 → >0, то unreadDialogsCount += 1
  // Если unreadCount меняется с >0 → 0, то unreadDialogsCount -= 1
  let unreadDialogsCountDelta = 0;
  if (oldValue === 0 && newValue > 0) {
    unreadDialogsCountDelta = 1;
  } else if (oldValue > 0 && newValue === 0) {
    unreadDialogsCountDelta = -1;
  }
  
  // КРИТИЧНО: Используем pipeline update с $max для атомарной защиты от отрицательных значений
  const timestamp = generateTimestamp();
  const updateResult = await UserStats.findOneAndUpdate(
    { tenantId, userId },
    [
      {
        $set: {
          totalUnreadCount: {
            $max: [
              { $add: [{ $ifNull: ["$totalUnreadCount", 0] }, delta] },
              0
            ]
          },
          unreadDialogsCount: {
            $max: [
              { $add: [{ $ifNull: ["$unreadDialogsCount", 0] }, unreadDialogsCountDelta] },
              0
            ]
          },
          lastUpdatedAt: timestamp,
          // Устанавливаем значения по умолчанию только при создании
          dialogCount: {
            $cond: {
              if: { $ne: [{ $ifNull: ["$_id", null] }, null] },
              then: { $ifNull: ["$dialogCount", 0] },
              else: 0
            }
          },
          totalMessagesCount: {
            $cond: {
              if: { $ne: [{ $ifNull: ["$_id", null] }, null] },
              then: { $ifNull: ["$totalMessagesCount", 0] },
              else: 0
            }
          },
          createdAt: { $ifNull: ["$createdAt", timestamp] }
        }
      }
    ],
    {
      upsert: true,
      new: true
    }
  );
  
  // Получаем старые значения для истории (до обновления)
  const oldTotalUnreadCount = Math.max(0, (updateResult.totalUnreadCount || 0) - delta);
  const oldUnreadDialogsCount = Math.max(0, (updateResult.unreadDialogsCount || 0) - unreadDialogsCountDelta);
  
  // Сохраняем в историю и добавляем в контекст только если значения изменились
  if (unreadDialogsCountDelta !== 0) {
    await saveCounterHistory({
      counterType: 'userStats.unreadDialogsCount',
      entityType: 'user',
      entityId: userId,
      field: 'unreadDialogsCount',
      oldValue: oldUnreadDialogsCount,
      newValue: updateResult.unreadDialogsCount,
      delta: unreadDialogsCountDelta,
      operation: 'computed',
      sourceOperation: 'userDialogStats.unreadCount.update',
      sourceEntityId: userId,
      tenantId
    });
    
    // Добавляем поле в контекст (не создаем update сразу)
    if (context) {
      context.addUpdatedField('user.stats.unreadDialogsCount');
    }
  }
  
  if (delta !== 0) {
    await saveCounterHistory({
      counterType: 'userStats.totalUnreadCount',
      entityType: 'user',
      entityId: userId,
      field: 'totalUnreadCount',
      oldValue: oldTotalUnreadCount,
      newValue: updateResult.totalUnreadCount,
      delta: delta,
      operation: 'computed',
      sourceOperation: 'userDialogStats.unreadCount.update',
      sourceEntityId: userId,
      tenantId
    });
    
    // Добавляем поле в контекст (не создаем update сразу)
    if (context) {
      context.addUpdatedField('user.stats.totalUnreadCount');
    }
  }
}

/**
 * Обновление dialogCount
 * КРИТИЧНО: Используем атомарные операции
 */
export async function updateUserStatsDialogCount(tenantId, userId, delta, sourceOperation, sourceEventId = null, actorId, actorType) {
  // КРИТИЧНО: Используем pipeline update с $max для атомарной защиты от отрицательных значений
  const timestamp = generateTimestamp();
  const result = await UserStats.findOneAndUpdate(
    { tenantId, userId },
    [
      {
        $set: {
          dialogCount: {
            $max: [
              { $add: [{ $ifNull: ["$dialogCount", 0] }, delta] },
              0
            ]
          },
          lastUpdatedAt: timestamp,
          // Устанавливаем значения по умолчанию только при создании (если _id не существует)
          unreadDialogsCount: {
            $cond: {
              if: { $ne: [{ $ifNull: ["$_id", null] }, null] },
              then: { $ifNull: ["$unreadDialogsCount", 0] },
              else: 0
            }
          },
          totalUnreadCount: {
            $cond: {
              if: { $ne: [{ $ifNull: ["$_id", null] }, null] },
              then: { $ifNull: ["$totalUnreadCount", 0] },
              else: 0
            }
          },
          totalMessagesCount: {
            $cond: {
              if: { $ne: [{ $ifNull: ["$_id", null] }, null] },
              then: { $ifNull: ["$totalMessagesCount", 0] },
              else: 0
            }
          },
          createdAt: { $ifNull: ["$createdAt", timestamp] }
        }
      }
    ],
    { 
      upsert: true, 
      new: true
    }
  );
  
  const oldValue = Math.max(0, (result.dialogCount || 0) - delta);
  const newValue = result.dialogCount || 0;
  
  // Получаем контекст операции
  const context = sourceEventId ? getCounterUpdateContext(tenantId, userId, sourceEventId, sourceOperation) : null;
  
  // Сохраняем в историю
  await saveCounterHistory({
    counterType: 'userStats.dialogCount',
    entityType: 'user',
    entityId: userId,
    field: 'dialogCount',
    oldValue,
    newValue,
    delta,
    operation: delta > 0 ? 'increment' : 'decrement',
    sourceOperation,
    sourceEntityId: userId,
    actorId,
    actorType: actorType || 'user',
    tenantId
  });
  
  // Добавляем поле в контекст (не создаем update сразу)
  if (context) {
    context.addUpdatedField('user.stats.dialogCount');
  }
  
  return { oldValue, newValue };
}

/**
 * Обновление totalMessagesCount
 * КРИТИЧНО: Используем атомарные операции
 */
export async function updateUserStatsTotalMessagesCount(tenantId, userId, delta, sourceOperation, sourceEventId = null, sourceEntityId, actorId, actorType) {
  // Атомарное обновление с $inc
  const result = await UserStats.findOneAndUpdate(
    { tenantId, userId },
    { 
      $inc: { totalMessagesCount: delta },
      $set: { lastUpdatedAt: generateTimestamp() },
      $setOnInsert: {
        dialogCount: 0,
        unreadDialogsCount: 0,
        totalUnreadCount: 0,
        createdAt: generateTimestamp()
      }
    },
    { 
      upsert: true, 
      new: true,
      setDefaultsOnInsert: true
    }
  );
  
  const oldValue = Math.max(0, result.totalMessagesCount - delta);
  const newValue = result.totalMessagesCount;
  
  // Получаем контекст операции
  const context = sourceEventId ? getCounterUpdateContext(tenantId, userId, sourceEventId, sourceOperation) : null;
  
  // Сохраняем в историю
  await saveCounterHistory({
    counterType: 'userStats.totalMessagesCount',
    entityType: 'user',
    entityId: userId,
    field: 'totalMessagesCount',
    oldValue,
    newValue,
    delta,
    operation: delta > 0 ? 'increment' : 'decrement',
    sourceOperation,
    sourceEntityId,
    actorId,
    actorType: actorType || 'user',
    tenantId
  });
  
  // Добавляем поле в контекст (не создаем update сразу)
  if (context) {
    context.addUpdatedField('user.stats.totalMessagesCount');
  }
  
  return { oldValue, newValue };
}

/**
 * Пересчет всех счетчиков пользователя
 */
export async function recalculateUserStats(tenantId, userId) {
  // Пересчитываем dialogCount из DialogMember (основная таблица участников диалогов)
  const dialogCount = await DialogMember.countDocuments({ tenantId, userId });
  
  // КРИТИЧНО: Сначала создаем и пересчитываем UserDialogStats для всех DialogMember
  // Это нужно, чтобы пересчет unreadDialogsCount был корректным
  const dialogMembers = await DialogMember.find({ tenantId, userId }).select('dialogId').lean();
  
  for (const member of dialogMembers) {
    // КРИТИЧНО: Оптимизированный пересчет unreadCount через агрегацию MongoDB
    // unreadCount = количество сообщений в диалоге, которые:
    // 1. Не были отправлены пользователем (senderId != userId)
    // 2. Не имеют статуса 'read' для этого пользователя
    // Используем один агрегационный запрос вместо двух отдельных запросов
    
    const unreadCountResult = await Message.aggregate([
      // Находим все сообщения в диалоге, которые не были отправлены пользователем
      {
        $match: {
          tenantId,
          dialogId: member.dialogId,
          senderId: { $ne: userId }
        }
      },
      // Соединяем с MessageStatus для поиска статусов 'read' от этого пользователя
      {
        $lookup: {
          from: 'messagestatuses',
          let: { messageId: '$messageId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$messageId', '$$messageId'] },
                    { $eq: ['$tenantId', tenantId] },
                    { $eq: ['$userId', userId] },
                    { $eq: ['$status', 'read'] }
                  ]
                }
              }
            },
            { $limit: 1 } // Нам нужно только проверить наличие статуса 'read'
          ],
          as: 'readStatus'
        }
      },
      // Фильтруем сообщения без статуса 'read'
      {
        $match: {
          readStatus: { $size: 0 } // Если readStatus пустой, значит сообщение не прочитано
        }
      },
      // Считаем количество непрочитанных сообщений
      {
        $count: 'unreadCount'
      }
    ]);
    
    // Если агрегация вернула результат, используем его, иначе проверяем существующий UserDialogStats
    let unreadCount = unreadCountResult[0]?.unreadCount;
    
    // Если агрегация не вернула результат (нет сообщений или все прочитаны),
    // проверяем существующий UserDialogStats или устанавливаем 0
    if (unreadCount === undefined) {
      const existingStats = await UserDialogStats.findOne({
        tenantId,
        userId,
        dialogId: member.dialogId
      }).lean();
      unreadCount = existingStats?.unreadCount || 0;
    }
    
    // Обновляем или создаем UserDialogStats с пересчитанным unreadCount
    await UserDialogStats.findOneAndUpdate(
      { tenantId, userId, dialogId: member.dialogId },
      {
        $set: {
          unreadCount,
          lastUpdatedAt: generateTimestamp()
        },
        $setOnInsert: {
          createdAt: generateTimestamp()
        }
      },
      { upsert: true, setDefaultsOnInsert: true }
    );
  }
  
  // Теперь пересчитываем unreadDialogsCount и totalUnreadCount из UserDialogStats
  // (теперь все записи гарантированно существуют)
  const unreadStats = await UserDialogStats.aggregate([
    { $match: { tenantId, userId } },
    {
      $group: {
        _id: null,
        unreadDialogsCount: {
          $sum: { $cond: [{ $gt: ['$unreadCount', 0] }, 1, 0] }
        },
        totalUnreadCount: { $sum: '$unreadCount' }
      }
    }
  ]);
  
  const unreadDialogsCount = unreadStats[0]?.unreadDialogsCount || 0;
  const totalUnreadCount = unreadStats[0]?.totalUnreadCount || 0;
  
  // Пересчитываем totalMessagesCount из Message (количество сообщений, отправленных пользователем)
  const totalMessagesCount = await Message.countDocuments({ tenantId, senderId: userId });
  
  // Обновляем UserStats
  await UserStats.findOneAndUpdate(
    { tenantId, userId },
    {
      $set: {
        dialogCount,
        unreadDialogsCount,
        totalUnreadCount,
        totalMessagesCount,
        lastUpdatedAt: generateTimestamp()
      },
      $setOnInsert: {
        createdAt: generateTimestamp()
      }
    },
    { upsert: true, setDefaultsOnInsert: true }
  );
  
  return { dialogCount, unreadDialogsCount, totalUnreadCount, totalMessagesCount };
}

/**
 * Получение истории изменений счетчика
 */
export async function getCounterHistory(tenantId, options = {}) {
  const {
    counterType,
    entityType,
    entityId,
    startDate,
    endDate,
    limit = 100,
    skip = 0
  } = options;
  
  const query = { tenantId };
  
  if (counterType) query.counterType = counterType;
  if (entityType) query.entityType = entityType;
  if (entityId) query.entityId = entityId;
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = startDate;
    if (endDate) query.createdAt.$lte = endDate;
  }
  
  return await CounterHistory.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip)
    .lean();
}

// ============================================================================
// Функции для работы с топиками
// ============================================================================

/**
 * Обновление unreadCount для топика
 * @param {string} tenantId - ID тенанта
 * @param {string} userId - ID пользователя
 * @param {string} dialogId - ID диалога
 * @param {string} topicId - ID топика
 * @param {number} delta - Изменение счетчика (+1 или -1)
 * @param {string} sourceOperation - Тип операции
 * @param {string} sourceEventId - ID события
 * @param {string} sourceEntityId - ID сущности
 * @param {string} actorId - ID актора
 * @param {string} actorType - Тип актора
 * @param {Object} session - MongoDB session для транзакций (опционально)
 * @returns {Promise<Object>} { oldValue, newValue }
 */
export async function updateTopicUnreadCount(tenantId, userId, dialogId, topicId, delta, sourceOperation, sourceEventId, sourceEntityId, actorId, actorType, session = null) {
  const timestamp = generateTimestamp();
  const updateOptions = {
    upsert: true,
    new: true
  };
  if (session) {
    updateOptions.session = session;
  }

  const result = await UserTopicStats.findOneAndUpdate(
    { tenantId, userId, dialogId, topicId },
    [
      {
        $set: {
          unreadCount: {
            $max: [
              { $add: [{ $ifNull: ["$unreadCount", 0] }, delta] },
              0
            ]
          },
          lastUpdatedAt: timestamp,
          createdAt: { $ifNull: ["$createdAt", timestamp] }
        }
      }
    ],
    updateOptions
  );

  const newValue = result.unreadCount || 0;
  const oldValue = Math.max(0, newValue - delta);

  // Обновляем общий счетчик диалога в UserDialogStats
  // Используем ту же логику, но без рекурсивного вызова updateTopicUnreadCount
  const dialogUpdateOptions = {
    upsert: true,
    new: true
  };
  if (session) {
    dialogUpdateOptions.session = session;
  }

  await UserDialogStats.findOneAndUpdate(
    { tenantId, userId, dialogId },
    [
      {
        $set: {
          unreadCount: {
            $max: [
              { $add: [{ $ifNull: ["$unreadCount", 0] }, delta] },
              0
            ]
          },
          lastUpdatedAt: timestamp,
          createdAt: { $ifNull: ["$createdAt", timestamp] }
        }
      }
    ],
    dialogUpdateOptions
  );

  // Сохраняем в историю
  await saveCounterHistory({
    counterType: 'userTopicStats.unreadCount',
    entityType: 'userTopicStats',
    entityId: `${dialogId}:${userId}:${topicId}`,
    field: 'unreadCount',
    oldValue,
    newValue,
    delta,
    operation: delta > 0 ? 'increment' : 'decrement',
    sourceOperation,
    sourceEntityId,
    actorId,
    actorType: actorType || 'user',
    tenantId
  });

  return { oldValue, newValue };
}

/**
 * Получение unreadCount для топика
 * @param {string} tenantId - ID тенанта
 * @param {string} userId - ID пользователя
 * @param {string} dialogId - ID диалога
 * @param {string} topicId - ID топика
 * @returns {Promise<number>} unreadCount
 */
export async function getTopicUnreadCount(tenantId, userId, dialogId, topicId) {
  const stats = await UserTopicStats.findOne({
    tenantId,
    userId,
    dialogId,
    topicId
  }).lean();

  return stats?.unreadCount || 0;
}

/**
 * Получение общего unreadCount для диалога
 * @param {string} tenantId - ID тенанта
 * @param {string} userId - ID пользователя
 * @param {string} dialogId - ID диалога
 * @returns {Promise<number>} unreadCount
 */
export async function getDialogUnreadCount(tenantId, userId, dialogId) {
  const stats = await UserDialogStats.findOne({
    tenantId,
    userId,
    dialogId
  }).lean();

  return stats?.unreadCount || 0;
}

/**
 * Обновление счетчиков диалога (DialogStats)
 * @param {string} tenantId - ID тенанта
 * @param {string} dialogId - ID диалога
 * @param {Object} updates - Обновления { topicCount?: delta, memberCount?: delta, messageCount?: delta }
 * @param {Object} session - MongoDB session для транзакций (опционально)
 * @returns {Promise<Object>} Обновленная статистика
 */
export async function updateDialogStats(tenantId, dialogId, updates = {}, session = null) {
  const timestamp = generateTimestamp();
  const updateOptions = {
    upsert: true,
    new: true
  };
  if (session) {
    updateOptions.session = session;
  }

  const updateQuery = {
    $set: {
      lastUpdatedAt: timestamp
    },
    $setOnInsert: {
      createdAt: timestamp
    }
  };

  if (updates.topicCount !== undefined) {
    updateQuery.$inc = updateQuery.$inc || {};
    updateQuery.$inc.topicCount = updates.topicCount;
  }
  if (updates.memberCount !== undefined) {
    updateQuery.$inc = updateQuery.$inc || {};
    updateQuery.$inc.memberCount = updates.memberCount;
  }
  if (updates.messageCount !== undefined) {
    updateQuery.$inc = updateQuery.$inc || {};
    updateQuery.$inc.messageCount = updates.messageCount;
  }

  const result = await DialogStats.findOneAndUpdate(
    { tenantId, dialogId },
    updateQuery,
    updateOptions
  );

  return result;
}

/**
 * Обновление topicCount в DialogStats
 * @param {string} tenantId - ID тенанта
 * @param {string} dialogId - ID диалога
 * @param {number} delta - Изменение счетчика (+1 или -1)
 * @param {Object} session - MongoDB session для транзакций (опционально)
 */
export async function updateDialogTopicCount(tenantId, dialogId, delta, session = null) {
  return await updateDialogStats(tenantId, dialogId, { topicCount: delta }, session);
}

/**
 * Обновление memberCount в DialogStats
 * @param {string} tenantId - ID тенанта
 * @param {string} dialogId - ID диалога
 * @param {number} delta - Изменение счетчика (+1 или -1)
 * @param {Object} session - MongoDB session для транзакций (опционально)
 */
export async function updateDialogMemberCount(tenantId, dialogId, delta, session = null) {
  return await updateDialogStats(tenantId, dialogId, { memberCount: delta }, session);
}

/**
 * Обновление messageCount в DialogStats
 * @param {string} tenantId - ID тенанта
 * @param {string} dialogId - ID диалога
 * @param {number} delta - Изменение счетчика (+1 или -1)
 * @param {Object} session - MongoDB session для транзакций (опционально)
 */
export async function updateDialogMessageCount(tenantId, dialogId, delta, session = null) {
  return await updateDialogStats(tenantId, dialogId, { messageCount: delta }, session);
}

/**
 * Пересчет общего unreadCount для диалога
 * Суммирует все unreadCount из UserTopicStats для данного диалога
 * @param {string} tenantId - ID тенанта
 * @param {string} userId - ID пользователя
 * @param {string} dialogId - ID диалога
 * @returns {Promise<number>} Пересчитанный unreadCount
 */
export async function recalculateDialogUnreadCount(tenantId, userId, dialogId) {
  const topicStats = await UserTopicStats.aggregate([
    {
      $match: {
        tenantId,
        userId,
        dialogId
      }
    },
    {
      $group: {
        _id: null,
        totalUnreadCount: { $sum: '$unreadCount' }
      }
    }
  ]);

  const totalUnreadCount = topicStats[0]?.totalUnreadCount || 0;

  // Обновляем UserDialogStats
  const timestamp = generateTimestamp();
  await UserDialogStats.findOneAndUpdate(
    { tenantId, userId, dialogId },
    {
      $set: {
        unreadCount: totalUnreadCount,
        lastUpdatedAt: timestamp
      },
      $setOnInsert: {
        createdAt: timestamp
      }
    },
    { upsert: true, setDefaultsOnInsert: true }
  );

  return totalUnreadCount;
}

/**
 * Пересчет всех счетчиков диалога (DialogStats)
 * @param {string} tenantId - ID тенанта
 * @param {string} dialogId - ID диалога
 * @returns {Promise<Object>} Пересчитанная статистика
 */
export async function recalculateDialogStats(tenantId, dialogId) {
  // Используем уже импортированные модели
  const topicCount = await Topic.countDocuments({ tenantId, dialogId });
  const memberCount = await DialogMember.countDocuments({ tenantId, dialogId });
  const messageCount = await Message.countDocuments({ tenantId, dialogId });

  const timestamp = generateTimestamp();
  const result = await DialogStats.findOneAndUpdate(
    { tenantId, dialogId },
    {
      $set: {
        topicCount,
        memberCount,
        messageCount,
        lastUpdatedAt: timestamp
      },
      $setOnInsert: {
        createdAt: timestamp
      }
    },
    { upsert: true, setDefaultsOnInsert: true }
  );

  return {
    topicCount,
    memberCount,
    messageCount
  };
}

