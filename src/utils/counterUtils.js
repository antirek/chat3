import { 
  UserStats, 
  UserDialogStats, 
  MessageReactionStats, 
  MessageStatusStats, 
  CounterHistory,
  DialogMember,
  Message,
  MessageStatus
} from '../models/index.js';
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
const CONTEXT_TTL_MS = 5 * 60 * 1000; // 5 минут

// Периодическая очистка старых контекстов
// КРИТИЧНО: Используем unref() чтобы interval не блокировал завершение процесса
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of contextTimestamps.entries()) {
    if (now - timestamp > CONTEXT_TTL_MS) {
      const context = counterUpdateContexts.get(key);
      if (context) {
        // Финализируем старый контекст перед удалением
        context.createStatsUpdate().catch(err => {
          console.error(`Failed to finalize expired context ${key}:`, err);
        });
      }
      counterUpdateContexts.delete(key);
      contextTimestamps.delete(key);
    }
  }
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
  
  // Очистка старых контекстов при каждом обращении
  const now = Date.now();
  for (const [k, timestamp] of contextTimestamps.entries()) {
    if (now - timestamp > CONTEXT_TTL_MS) {
      const context = counterUpdateContexts.get(k);
      if (context) {
        context.createStatsUpdate().catch(err => {
          console.error(`Failed to finalize expired context ${k}:`, err);
        });
      }
      counterUpdateContexts.delete(k);
      contextTimestamps.delete(k);
    }
  }
  
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
 */
export async function updateUnreadCount(tenantId, userId, dialogId, delta, sourceOperation, sourceEventId, sourceEntityId, actorId, actorType) {
  // Атомарное обновление с $inc - предотвращает race conditions
  const result = await UserDialogStats.findOneAndUpdate(
    { tenantId, userId, dialogId },
    { 
      $inc: { unreadCount: delta },
      $set: { 
        lastUpdatedAt: generateTimestamp()
      },
      $setOnInsert: {
        createdAt: generateTimestamp()
      }
    },
    { 
      upsert: true, 
      new: true,
      setDefaultsOnInsert: true // Устанавливает unreadCount: 0 при создании
    }
  );
  
  // Вычисляем старое и новое значение
  // result.unreadCount уже содержит новое значение после $inc
  let newValue = result.unreadCount || 0;
  const oldValue = Math.max(0, newValue - delta);
  
  // Защита от отрицательных значений: если значение стало отрицательным, устанавливаем 0
  if (newValue < 0) {
    const correctedResult = await UserDialogStats.findOneAndUpdate(
      { tenantId, userId, dialogId },
      { $set: { unreadCount: 0, lastUpdatedAt: generateTimestamp() } },
      { new: true }
    );
    newValue = 0;
    // Обновляем result для дальнейшего использования
    result.unreadCount = 0;
  }
  
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
  // Атомарное обновление с $inc
  const result = await MessageStatusStats.findOneAndUpdate(
    { tenantId, messageId, status },
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
  
  // Атомарное обновление UserStats с инкрементальными изменениями
  const updateResult = await UserStats.findOneAndUpdate(
    { tenantId, userId },
    {
      $inc: {
        totalUnreadCount: delta,
        unreadDialogsCount: unreadDialogsCountDelta
      },
      $set: {
        lastUpdatedAt: generateTimestamp()
      },
      $setOnInsert: {
        dialogCount: 0,
        totalMessagesCount: 0,
        createdAt: generateTimestamp()
      }
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
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
      operation: 'incremental',
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
      operation: 'incremental',
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
  // Атомарное обновление с $inc
  const result = await UserStats.findOneAndUpdate(
    { tenantId, userId },
    { 
      $inc: { dialogCount: delta },
      $set: { lastUpdatedAt: generateTimestamp() },
      $setOnInsert: {
        unreadDialogsCount: 0,
        totalUnreadCount: 0,
        totalMessagesCount: 0,
        createdAt: generateTimestamp()
      }
    },
    { 
      upsert: true, 
      new: true,
      setDefaultsOnInsert: true
    }
  );
  
  const oldValue = Math.max(0, result.dialogCount - delta);
  const newValue = result.dialogCount;
  
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
    // Пересчитываем unreadCount из реальных данных (MessageStatus)
    // unreadCount = количество сообщений в диалоге, которые:
    // 1. Не были отправлены пользователем (senderId != userId)
    // 2. Не имеют статуса 'read' для этого пользователя
    
    // Получаем все сообщения в диалоге, которые не были отправлены пользователем
    const messages = await Message.find({
      tenantId,
      dialogId: member.dialogId,
      senderId: { $ne: userId }
    }).select('messageId').lean();
    
    const messageIds = messages.map(m => m.messageId);
    
    if (messageIds.length > 0) {
      // Получаем все статусы 'read' для этих сообщений от этого пользователя
      const readStatuses = await MessageStatus.find({
        tenantId,
        userId,
        messageId: { $in: messageIds },
        status: 'read'
      }).select('messageId').lean();
      
      const readMessageIds = new Set(readStatuses.map(s => s.messageId));
      
      // unreadCount = количество сообщений без статуса 'read'
      const unreadCount = messageIds.filter(msgId => !readMessageIds.has(msgId)).length;
      
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
    } else {
      // Если сообщений нет, создаем UserDialogStats с unreadCount = 0
      await UserDialogStats.findOneAndUpdate(
        { tenantId, userId, dialogId: member.dialogId },
        {
          $setOnInsert: {
            unreadCount: 0,
            createdAt: generateTimestamp()
          },
          $set: {
            lastUpdatedAt: generateTimestamp()
          }
        },
        { upsert: true, setDefaultsOnInsert: true }
      );
    }
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

