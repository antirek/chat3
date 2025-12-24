# Анализ архитектуры счетчиков Chat3

## Обзор

Данный документ содержит анализ предложенной архитектуры счетчиков, выявление слабых мест и предложения по улучшению.

## Выявленные проблемы и слабые места

### 1. Утечки памяти в глобальном Map контекстов

**Проблема:**
```javascript
const counterUpdateContexts = new Map();
```

Глобальный Map может расти бесконечно, если:
- Операция завершилась с ошибкой и `finalizeCounterUpdateContext()` не был вызван
- Приложение упало до завершения операции
- Произошел таймаут запроса

**Последствия:**
- Утечка памяти
- Контексты накапливаются и занимают память
- При рестарте приложения контексты теряются, но в памяти они остаются

**Решение:**
1. **TTL для контекстов** - автоматически удалять контексты старше N минут
2. **Очистка при ошибках** - использовать try-finally для гарантированной очистки
3. **Периодическая очистка** - фоновый процесс для удаления старых контекстов
4. **WeakMap вместо Map** - но это не подойдет, так как ключи - строки

**Рекомендация:**
```javascript
// Добавить TTL механизм
const counterUpdateContexts = new Map();
const contextTimestamps = new Map();

function getCounterUpdateContext(tenantId, userId, sourceEventId, sourceEventType) {
  // Очистка старых контекстов (старше 5 минут)
  const now = Date.now();
  for (const [key, timestamp] of contextTimestamps.entries()) {
    if (now - timestamp > 5 * 60 * 1000) {
      counterUpdateContexts.delete(key);
      contextTimestamps.delete(key);
    }
  }
  
  const key = `${tenantId}:${userId}:${sourceEventId || 'no-event'}`;
  
  if (!counterUpdateContexts.has(key)) {
    counterUpdateContexts.set(key, new CounterUpdateContext(tenantId, userId, sourceEventId, sourceEventType));
    contextTimestamps.set(key, now);
  }
  
  return counterUpdateContexts.get(key);
}

// Периодическая очистка (каждые 5 минут)
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of contextTimestamps.entries()) {
    if (now - timestamp > 5 * 60 * 1000) {
      counterUpdateContexts.delete(key);
      contextTimestamps.delete(key);
    }
  }
}, 5 * 60 * 1000);
```

### 2. Отсутствие атомарности операций

**Проблема:**
При обновлении нескольких счетчиков (например, `unreadCount` → `unreadDialogsCount` + `totalUnreadCount`) операции не атомарны:
- Если обновление `UserDialogStats` успешно, а `UserStats` упало - данные рассинхронизируются
- Нет механизма отката изменений

**Последствия:**
- Несогласованность данных
- Сложно восстановить консистентность
- Нужны скрипты валидации и исправления

**Решение:**
1. **MongoDB Transactions** - обернуть обновления в транзакцию
2. **Optimistic Locking** - использовать версионирование документов
3. **Compensating Transactions** - механизм отката при ошибках

**Рекомендация:**
```javascript
// Использовать транзакции для критических операций
const session = await mongoose.startSession();
session.startTransaction();

try {
  // Обновляем UserDialogStats
  await UserDialogStats.findOneAndUpdate(...).session(session);
  
  // Обновляем UserStats
  await UserStats.findOneAndUpdate(...).session(session);
  
  // Сохраняем историю
  await CounterHistory.create([...]).session(session);
  
  await session.commitTransaction();
} catch (error) {
  await session.abortTransaction();
  throw error;
} finally {
  session.endSession();
}
```

### 3. Race Conditions при параллельных обновлениях

**Проблема:**
Если два запроса одновременно обновляют счетчики одного пользователя:
- Оба читают старое значение
- Оба вычисляют новое значение
- Оба сохраняют - одно изменение теряется

**Пример:**
```
Запрос 1: читает unreadCount = 5, увеличивает до 6
Запрос 2: читает unreadCount = 5, увеличивает до 6
Результат: должно быть 7, но получается 6
```

**Решение:**
1. **Atomic Operations** - использовать `$inc` вместо чтения-изменения-записи
2. **Optimistic Locking** - версионирование документов
3. **Pessimistic Locking** - блокировка на уровне БД (не рекомендуется для MongoDB)

**Рекомендация:**
```javascript
// Использовать атомарные операции
await UserDialogStats.findOneAndUpdate(
  { tenantId, userId, dialogId },
  { $inc: { unreadCount: delta } },
  { upsert: true, new: true }
);

// Или использовать версионирование
const doc = await UserDialogStats.findOne({ tenantId, userId, dialogId });
doc.unreadCount += delta;
doc.__v += 1; // Версия документа
await doc.save();
```

### 4. Получение eventId в контроллерах

**Проблема:**
В контроллерах нужно делать дополнительный запрос для получения `eventId`:
```javascript
const messageEvent = await Event.findOne({ 
  tenantId, 
  eventType: 'message.create', 
  entityId: message.messageId 
}).sort({ createdAt: -1 });
```

**Последствия:**
- Дополнительный запрос к БД
- Задержка в обработке
- Возможна ошибка, если событие еще не создано

**Решение:**
1. **Передавать eventId из eventUtils** - возвращать eventId при создании события
2. **Использовать callback/promise** - передавать eventId через callback
3. **Создавать события синхронно** - гарантировать, что событие создано до обновления счетчиков

**Рекомендация:**
```javascript
// В eventUtils.js
export async function createEvent(...) {
  const event = await Event.create(...);
  // Публикуем в RabbitMQ
  await publishEvent(event);
  return event; // Возвращаем event с _id
}

// В контроллере
const event = await eventUtils.createEvent(...);
const sourceEventId = event._id;
```

### 5. Производительность синхронных обновлений

**Проблема:**
При создании сообщения в диалоге с 100 участниками:
- 100 обновлений `UserDialogStats`
- 100 обновлений `UserStats`
- 100 записей в `CounterHistory`
- 100 вызовов `finalizeCounterUpdateContext`

Все это синхронно, что замедляет операцию.

**Последствия:**
- Медленная обработка запросов
- Плохой UX для пользователей
- Высокая нагрузка на БД

**Решение:**
1. **Bulk Operations** - использовать `bulkWrite()` для массовых обновлений
2. **Асинхронная история** - сохранять историю в фоне
3. **Батчинг контекстов** - обрабатывать несколько пользователей за раз

**Рекомендация:**
```javascript
// Bulk update для всех участников
const updates = members.map(member => ({
  updateOne: {
    filter: { tenantId, userId: member.userId, dialogId },
    update: { $inc: { unreadCount: 1 } },
    upsert: true
  }
}));

await UserDialogStats.bulkWrite(updates);

// Асинхронная история
setImmediate(() => {
  saveCounterHistory(...).catch(err => console.error('History save failed:', err));
});
```

### 6. Обработка ошибок при обновлении счетчиков

**Проблема:**
Если обновление счетчика упало:
- Основная операция может быть успешной (сообщение создано)
- Счетчики не обновлены
- Данные рассинхронизированы

**Последствия:**
- Несогласованность данных
- Нужны скрипты восстановления
- Сложно отследить проблему

**Решение:**
1. **Retry механизм** - повторять попытки при ошибках
2. **Dead Letter Queue** - сохранять неудачные операции для повторной обработки
3. **Валидация после операций** - проверять консистентность
4. **Compensating Actions** - откатывать изменения при ошибках

**Рекомендация:**
```javascript
async function updateUnreadCountWithRetry(...) {
  const maxRetries = 3;
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      return await updateUnreadCount(...);
    } catch (error) {
      retries++;
      if (retries >= maxRetries) {
        // Сохранить в DLQ для повторной обработки
        await saveToDeadLetterQueue({ operation: 'updateUnreadCount', params: [...], error });
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 100 * retries)); // Exponential backoff
    }
  }
}
```

### 7. Контекст операций и обработка ошибок

**Проблема:**
Если операция упала до вызова `finalizeCounterUpdateContext()`:
- Контекст остается в Map
- `user.stats.update` не создается
- Счетчики обновлены, но клиент не получил уведомление

**Последствия:**
- Утечка контекстов
- Отсутствие updates для клиентов
- Нужна периодическая очистка

**Решение:**
1. **Try-finally блоки** - гарантировать вызов `finalizeCounterUpdateContext()`
2. **Таймауты для контекстов** - автоматически финализировать старые контексты
3. **Фоновый процесс** - проверять и финализировать "зависшие" контексты

**Рекомендация:**
```javascript
async function createMessage(req, res) {
  const sourceEventId = messageEvent?._id || null;
  
  try {
    // ... обновление счетчиков
    
    // Гарантированная финализация
    for (const member of members) {
      if (member.userId !== senderId) {
        try {
          await finalizeCounterUpdateContext(tenantId, member.userId, sourceEventId);
        } catch (error) {
          console.error(`Failed to finalize context for ${member.userId}:`, error);
          // Контекст останется, но будет очищен по TTL
        }
      }
    }
  } catch (error) {
    // При ошибке все равно пытаемся финализировать контексты
    // чтобы не потерять updates для частично обновленных счетчиков
    await finalizeAllContextsForEvent(sourceEventId);
    throw error;
  }
}
```

### 8. Размер коллекции CounterHistory

**Проблема:**
При высокой нагрузке `counterhistory` может расти очень быстро:
- Каждое изменение счетчика = 1 запись
- При создании сообщения в диалоге с 100 участниками = 100+ записей
- За день может быть миллионы записей

**Последствия:**
- Большой размер БД
- Медленные запросы
- Высокие затраты на хранение

**Решение:**
1. **TTL индекс** - автоматически удалять записи старше N дней
2. **Архивация** - перемещать старые записи в архивную коллекцию
3. **Сэмплирование** - сохранять не все изменения, а только значимые
4. **Агрегация** - периодически агрегировать историю в сводные записи

**Рекомендация:**
```javascript
// TTL индекс на 90 дней
counterHistorySchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// Или условное сохранение истории
async function saveCounterHistory(data) {
  // Сохранять только значимые изменения (переход через 0, большие изменения)
  if (Math.abs(data.delta) > 0 || data.oldValue === 0 || data.newValue === 0) {
    await CounterHistory.create(data);
  }
}
```

### 9. Валидация консистентности счетчиков

**Проблема:**
Нет автоматической проверки, что счетчики не рассинхронизировались:
- `UserStats.unreadDialogsCount` должен равняться количеству `UserDialogStats` с `unreadCount > 0`
- `UserStats.totalUnreadCount` должен равняться сумме всех `UserDialogStats.unreadCount`

**Последствия:**
- Ошибки могут накапливаться
- Сложно обнаружить проблему
- Нужны ручные проверки

**Решение:**
1. **Периодическая валидация** - фоновый процесс для проверки консистентности
2. **Валидация при чтении** - проверять и исправлять при обнаружении несоответствий
3. **Мониторинг** - алерты при обнаружении рассинхронизации

**Рекомендация:**
```javascript
// Фоновый процесс валидации
async function validateCounters() {
  const users = await User.find({ tenantId }).select('userId');
  
  for (const user of users) {
    const stats = await UserStats.findOne({ tenantId, userId: user.userId });
    if (!stats) continue;
    
    // Проверяем unreadDialogsCount
    const realUnreadDialogsCount = await UserDialogStats.countDocuments({
      tenantId,
      userId: user.userId,
      unreadCount: { $gt: 0 }
    });
    
    if (stats.unreadDialogsCount !== realUnreadDialogsCount) {
      console.warn(`Mismatch for user ${user.userId}: unreadDialogsCount = ${stats.unreadDialogsCount}, real = ${realUnreadDialogsCount}`);
      // Автоматическое исправление
      await UserStats.updateOne(
        { tenantId, userId: user.userId },
        { $set: { unreadDialogsCount: realUnreadDialogsCount } }
      );
    }
    
    // Аналогично для totalUnreadCount
    const realTotalUnreadCount = await UserDialogStats.aggregate([
      { $match: { tenantId, userId: user.userId } },
      { $group: { _id: null, total: { $sum: '$unreadCount' } } }
    ]);
    
    // ...
  }
}
```

### 10. Post-save hooks и производительность

**Проблема:**
Post-save hooks выполняются синхронно и могут замедлять сохранение документов:
- При каждом `save()` выполняется дополнительная логика
- Множественные запросы к БД
- Блокирующие операции

**Последствия:**
- Медленное сохранение документов
- Высокая нагрузка на БД
- Плохая производительность

**Решение:**
1. **Асинхронные hooks** - использовать `setImmediate()` для неблокирующих операций
2. **Условное выполнение** - выполнять hooks только при необходимости
3. **Батчинг** - группировать операции

**Рекомендация:**
```javascript
userDialogStatsSchema.post('save', async function(doc) {
  if (doc.isModified('unreadCount')) {
    // Асинхронное выполнение, не блокирует сохранение
    setImmediate(async () => {
      try {
        await updateUserStatsFromUnreadCount(...);
        await saveCounterHistory(...);
      } catch (error) {
        console.error('Error in post-save hook:', error);
        // Не прерываем основной поток
      }
    });
  }
});
```

### 11. Отсутствие версионирования документов

**Проблема:**
Нет механизма отслеживания версий документов для optimistic locking:
- Невозможно обнаружить конфликты при параллельных обновлениях
- Нет защиты от lost updates

**Решение:**
1. **Версионирование** - использовать `__v` поле Mongoose
2. **Optimistic Locking** - проверять версию перед обновлением
3. **Retry при конфликтах** - повторять операцию при обнаружении конфликта

**Рекомендация:**
```javascript
async function updateUserStatsWithVersion(tenantId, userId, updateFn) {
  const maxRetries = 3;
  let retries = 0;
  
  while (retries < maxRetries) {
    const stats = await UserStats.findOne({ tenantId, userId });
    if (!stats) throw new Error('UserStats not found');
    
    const oldVersion = stats.__v;
    updateFn(stats);
    stats.__v += 1;
    
    try {
      await stats.save();
      return stats;
    } catch (error) {
      if (error.name === 'VersionError') {
        retries++;
        if (retries >= maxRetries) throw new Error('Max retries exceeded');
        await new Promise(resolve => setTimeout(resolve, 10 * retries));
        continue;
      }
      throw error;
    }
  }
}
```

### 12. Получение eventId - дополнительный запрос

**Проблема:**
В контроллерах нужно делать запрос для получения `eventId`:
```javascript
const messageEvent = await Event.findOne({ 
  tenantId, 
  eventType: 'message.create', 
  entityId: message.messageId 
}).sort({ createdAt: -1 });
```

Это дополнительный запрос к БД, который замедляет операцию.

**Решение:**
1. **Возвращать eventId из eventUtils** - `createEvent()` должен возвращать созданное событие
2. **Передавать eventId в параметрах** - если событие создается до обновления счетчиков
3. **Кэшировать eventId** - если событие создается в той же транзакции

**Рекомендация:**
```javascript
// В контроллере
const event = await eventUtils.createEvent({
  tenantId,
  eventType: 'message.create',
  entityType: 'message',
  entityId: message.messageId,
  data: { ... }
});

const sourceEventId = event._id; // Используем сразу, без дополнительного запроса
```

## Предложения по улучшению

### 1. Добавить механизм транзакций для критических операций

**Критические операции:**
- Создание сообщения (обновление множества счетчиков)
- Добавление/удаление участника (обновление dialogCount)
- Изменение статуса сообщения (обновление unreadCount)

**Реализация:**
```javascript
async function updateCountersInTransaction(tenantId, operations) {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const results = [];
    for (const op of operations) {
      const result = await op(session);
      results.push(result);
    }
    
    await session.commitTransaction();
    return results;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}
```

### 2. Добавить механизм батчинга для массовых обновлений

**Для операций с множеством участников:**
```javascript
async function updateUnreadCountForAllMembers(tenantId, dialogId, delta, sourceEventId, sourceEventType) {
  const members = await DialogMember.find({ tenantId, dialogId });
  const updates = [];
  const contexts = new Map();
  
  for (const member of members) {
    const key = `${tenantId}:${member.userId}:${sourceEventId}`;
    if (!contexts.has(key)) {
      contexts.set(key, getCounterUpdateContext(tenantId, member.userId, sourceEventId, sourceEventType));
    }
    
    updates.push({
      updateOne: {
        filter: { tenantId, userId: member.userId, dialogId },
        update: { $inc: { unreadCount: delta } },
        upsert: true
      }
    });
  }
  
  // Bulk update
  await UserDialogStats.bulkWrite(updates);
  
  // Финализация всех контекстов
  for (const [key, context] of contexts) {
    await context.createStatsUpdate();
  }
}
```

### 3. Добавить мониторинг и метрики

**Метрики для отслеживания:**
- Количество обновлений счетчиков в секунду
- Время выполнения обновления счетчиков
- Количество ошибок при обновлении
- Размер коллекции CounterHistory
- Количество "зависших" контекстов

**Реализация:**
```javascript
// Метрики
const counterMetrics = {
  updatesPerSecond: 0,
  averageUpdateTime: 0,
  errorsCount: 0,
  contextCount: 0
};

async function updateUnreadCount(...) {
  const startTime = Date.now();
  try {
    const result = await updateUnreadCountInternal(...);
    const duration = Date.now() - startTime;
    counterMetrics.averageUpdateTime = (counterMetrics.averageUpdateTime + duration) / 2;
    counterMetrics.updatesPerSecond++;
    return result;
  } catch (error) {
    counterMetrics.errorsCount++;
    throw error;
  }
}
```

### 4. Добавить механизм восстановления после ошибок

**Фоновый процесс для восстановления:**
```javascript
// Периодическая проверка и восстановление
setInterval(async () => {
  // Проверяем зависшие контексты
  const now = Date.now();
  for (const [key, context] of counterUpdateContexts.entries()) {
    const timestamp = contextTimestamps.get(key);
    if (now - timestamp > 5 * 60 * 1000) {
      // Финализируем старый контекст
      await context.createStatsUpdate();
      counterUpdateContexts.delete(key);
      contextTimestamps.delete(key);
    }
  }
  
  // Проверяем консистентность счетчиков
  await validateCounters();
}, 5 * 60 * 1000); // Каждые 5 минут
```

### 5. Оптимизировать получение счетчиков

**Кэширование часто используемых счетчиков:**
```javascript
const counterCache = new Map();
const CACHE_TTL = 60 * 1000; // 1 минута

async function getUserStats(tenantId, userId, useCache = true) {
  const cacheKey = `${tenantId}:${userId}`;
  
  if (useCache && counterCache.has(cacheKey)) {
    const cached = counterCache.get(cacheKey);
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
  }
  
  const stats = await UserStats.findOne({ tenantId, userId });
  const data = stats || { dialogCount: 0, unreadDialogsCount: 0, totalUnreadCount: 0, totalMessagesCount: 0 };
  
  if (useCache) {
    counterCache.set(cacheKey, { data, timestamp: Date.now() });
  }
  
  return data;
}

// Инвалидация кэша при обновлении
async function updateUserStats(...) {
  await updateUserStatsInternal(...);
  counterCache.delete(`${tenantId}:${userId}`); // Инвалидируем кэш
}
```

## Рекомендации по приоритетам

### Критично (реализовать сразу):

1. **TTL для контекстов** - предотвратить утечки памяти
2. **Try-finally блоки** - гарантировать финализацию контекстов
3. **Атомарные операции** - использовать `$inc` вместо чтения-изменения-записи
4. **Возврат eventId из eventUtils** - убрать дополнительный запрос

### Важно (реализовать в ближайшее время):

5. **Транзакции для критических операций** - обеспечить атомарность
6. **Bulk operations** - оптимизировать массовые обновления
7. **Валидация консистентности** - периодическая проверка
8. **Обработка ошибок** - retry механизм

### Желательно (реализовать при необходимости):

9. **Кэширование счетчиков** - для часто используемых данных
10. **Асинхронная история** - не блокировать основные операции
11. **Мониторинг и метрики** - для отслеживания производительности
12. **Версионирование документов** - для optimistic locking

## Вопросы для уточнения

1. **Какой уровень консистентности требуется?**
   - Строгая консистентность (транзакции) или eventual consistency допустима?

2. **Какой объем операций ожидается?**
   - Количество сообщений в секунду?
   - Среднее количество участников в диалоге?

3. **Как обрабатывать ошибки?**
   - Retry автоматически или ручное исправление?
   - Нужна ли Dead Letter Queue?

4. **Нужна ли полная история изменений?**
   - Или достаточно последних N дней?
   - Можно ли агрегировать старую историю?

5. **Какой приоритет у производительности?**
   - Можно ли сделать часть операций асинхронными?
   - Допустима ли eventual consistency для некоторых счетчиков?

