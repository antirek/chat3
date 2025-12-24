# Архитектура счетчиков Chat3

## Обзор

Данный документ описывает архитектуру системы счетчиков, где все счетчики хранятся в MongoDB и обновляются синхронно при операциях, без использования событийной модели.

## Принципы

1. **Все счетчики в БД** - первичные и вычисляемые счетчики хранятся в отдельных коллекциях
2. **Отдельные модели для счетчиков** - счетчики хранятся в `models/stats/`, а не в `models/data/`
3. **Предыдущее значение всегда доступно** - при обновлении счетчика сохраняется старое значение
4. **Синхронное обновление** - счетчики обновляются синхронно при операциях, без асинхронных событий
5. **История изменений** - все изменения счетчиков логируются для аудита и отладки

## Структура моделей счетчиков

Все модели счетчиков находятся в директории `src/models/stats/`:

- **`UserStats`** - вычисляемые счетчики пользователя (агрегированные)
- **`UserDialogStats`** - первичные счетчики пользователя в диалоге
- **`MessageReactionStats`** - счетчики реакций сообщения (отдельная запись для каждой реакции)
- **`MessageStatusStats`** - счетчики статусов сообщения (отдельная запись для каждого статуса)

Модель истории находится в `src/models/operational/`:

- **`CounterHistory`** - история всех изменений счетчиков

## Типы счетчиков

### 1. Первичные счетчики (Primary Counters)

Счетчики, которые обновляются напрямую при операциях:

#### `UserDialogStats.unreadCount`
- **Модель**: `UserDialogStats` (новая)
- **Коллекция**: `userdialogstats`
- **Поле**: `unreadCount`
- **Описание**: Количество непрочитанных сообщений в диалоге для пользователя
- **Обновляется при**: 
  - Создании сообщения (`message.create`)
  - Изменении статуса сообщения (`message.status.update`)

#### `MessageReactionStats.reactionCount`
- **Модель**: `MessageReactionStats` (новая)
- **Коллекция**: `messagereactionstats`
- **Поля**: `messageId`, `reaction`, `count`
- **Описание**: Количество реакций конкретного типа на сообщение (отдельная запись для каждой реакции)
- **Обновляется при**: 
  - Добавлении реакции (`message.reaction.update` с action=`set`)
  - Удалении реакции (`message.reaction.update` с action=`unset`)
- **Получение всех реакций**: выборка по `messageId`

#### `MessageStatusStats.statusCount`
- **Модель**: `MessageStatusStats` (новая)
- **Коллекция**: `messagestatusstats`
- **Поля**: `messageId`, `status`, `count`
- **Описание**: Количество записей конкретного статуса в истории MessageStatus (отдельная запись для каждого статуса)
- **Обновляется при**: 
  - Создании нового статуса (`message.status.update`)
- **Получение всех статусов**: выборка по `messageId`

### 2. Вычисляемые счетчики (Computed Counters)

Счетчики, которые вычисляются на основе первичных счетчиков:

#### `UserStats.dialogCount`
- **Модель**: `UserStats` (новая)
- **Коллекция**: `userstats`
- **Поле**: `dialogCount`
- **Описание**: Общее количество диалогов пользователя
- **Вычисляется из**: Количество записей в `dialogmembers` для пользователя
- **Обновляется при**: 
  - Добавлении участника в диалог (`dialog.member.add`)
  - Удалении участника из диалога (`dialog.member.remove`)

#### `UserStats.unreadDialogsCount`
- **Модель**: `UserStats` (новая)
- **Коллекция**: `userstats`
- **Поле**: `unreadDialogsCount`
- **Описание**: Количество непрочитанных диалогов (где `unreadCount > 0`)
- **Вычисляется из**: Количество записей в `userdialogstats` для пользователя с `unreadCount > 0`
- **Обновляется при**: 
  - Изменении `UserDialogStats.unreadCount` (переход через 0)

#### `UserStats.totalUnreadCount`
- **Модель**: `UserStats` (новая)
- **Коллекция**: `userstats`
- **Поле**: `totalUnreadCount`
- **Описание**: Общее количество непрочитанных сообщений во всех диалогах
- **Вычисляется из**: Сумма всех `unreadCount` в `userdialogstats` для пользователя
- **Обновляется при**: 
  - Изменении любого `UserDialogStats.unreadCount`

#### `UserStats.totalMessagesCount`
- **Модель**: `UserStats` (новая)
- **Коллекция**: `userstats`
- **Поле**: `totalMessagesCount`
- **Описание**: Общее количество сообщений, отправленных пользователем
- **Тип**: Первичный счетчик (обновляется напрямую)
- **Обновляется при**: 
  - Создании сообщения (`message.create`) - увеличивается для отправителя

### 3. История изменений счетчиков (Counter History)

Для отслеживания изменений счетчиков:

#### `CounterHistory`
- **Коллекция**: `counterhistory` (новая)
- **Описание**: История всех изменений счетчиков
- **Использование**: Аудит, отладка, возможность отката изменений

## Структура коллекций

### Коллекция: `userstats`

Хранит вычисляемые счетчики пользователей (агрегированные).

**Модель**: `src/models/stats/UserStats.js`

```javascript
{
  _id: ObjectId,
  tenantId: String,        // ID тенанта
  userId: String,           // ID пользователя
  dialogCount: Number,     // Количество диалогов
  unreadDialogsCount: Number, // Количество непрочитанных диалогов
  totalUnreadCount: Number,   // Общее количество непрочитанных сообщений
  totalMessagesCount: Number, // Общее количество сообщений, отправленных пользователем
  lastUpdatedAt: Number,    // Timestamp последнего обновления
  createdAt: Number        // Timestamp создания
}
```

**Индексы:**
- `{ tenantId: 1, userId: 1 }` (unique)
- `{ tenantId: 1, unreadDialogsCount: 1 }`
- `{ tenantId: 1, totalUnreadCount: 1 }`
- `{ tenantId: 1, totalMessagesCount: 1 }`

### Коллекция: `userdialogstats`

Хранит первичные счетчики пользователя в диалоге.

**Модель**: `src/models/stats/UserDialogStats.js`

```javascript
{
  _id: ObjectId,
  tenantId: String,        // ID тенанта
  userId: String,           // ID пользователя
  dialogId: String,         // ID диалога
  unreadCount: Number,      // Количество непрочитанных сообщений
  lastUpdatedAt: Number,    // Timestamp последнего обновления
  createdAt: Number        // Timestamp создания
}
```

**Индексы:**
- `{ tenantId: 1, userId: 1, dialogId: 1 }` (unique)
- `{ tenantId: 1, userId: 1, unreadCount: 1 }`
- `{ tenantId: 1, dialogId: 1 }`
- `{ tenantId: 1, unreadCount: 1 }`

### Коллекция: `messagereactionstats`

Хранит счетчики реакций для каждого сообщения (отдельная запись для каждой реакции).

**Модель**: `src/models/stats/MessageReactionStats.js`

```javascript
{
  _id: ObjectId,
  tenantId: String,        // ID тенанта
  messageId: String,        // ID сообщения
  reaction: String,         // Тип реакции (👍, ❤️, etc.)
  count: Number,            // Количество реакций этого типа
  lastUpdatedAt: Number,    // Timestamp последнего обновления
  createdAt: Number        // Timestamp создания
}
```

**Индексы:**
- `{ tenantId: 1, messageId: 1, reaction: 1 }` (unique)
- `{ tenantId: 1, messageId: 1 }` (для выборки всех реакций сообщения)
- `{ tenantId: 1, reaction: 1, count: 1 }` (для поиска популярных реакций)

### Коллекция: `messagestatusstats`

Хранит счетчики статусов для каждого сообщения (отдельная запись для каждого статуса).

**Модель**: `src/models/stats/MessageStatusStats.js`

```javascript
{
  _id: ObjectId,
  tenantId: String,        // ID тенанта
  messageId: String,        // ID сообщения
  status: String,           // Тип статуса ('sent', 'unread', 'delivered', 'read')
  count: Number,            // Количество записей этого статуса в истории
  lastUpdatedAt: Number,    // Timestamp последнего обновления
  createdAt: Number        // Timestamp создания
}
```

**Индексы:**
- `{ tenantId: 1, messageId: 1, status: 1 }` (unique)
- `{ tenantId: 1, messageId: 1 }` (для выборки всех статусов сообщения)
- `{ tenantId: 1, status: 1, count: 1 }` (для поиска по статусам)

### Коллекция: `counterhistory`

Хранит историю изменений всех счетчиков.

```javascript
{
  _id: ObjectId,
  tenantId: String,        // ID тенанта
  counterType: String,     // Тип счетчика: 'userDialogStats.unreadCount', 'messageReactionStats.count', 'messageStatusStats.count', 'userStats.dialogCount', 'userStats.unreadDialogsCount', 'userStats.totalUnreadCount', 'userStats.totalMessagesCount'
  entityType: String,      // Тип сущности: 'dialogMember', 'message', 'user'
  entityId: String,        // ID сущности (dialogId:userId для dialogMember, messageId для message, userId для user)
  field: String,          // Поле счетчика: 'unreadCount', 'reactionCounts', 'dialogCount', etc.
  oldValue: Mixed,         // Старое значение (может быть число, объект, null)
  newValue: Mixed,         // Новое значение
  delta: Number,           // Изменение (для числовых счетчиков)
  operation: String,       // Операция: 'increment', 'decrement', 'set', 'reset'
  sourceOperation: String, // Исходная операция: 'message.create', 'message.status.update', 'dialog.member.add', etc.
  sourceEntityId: String, // ID сущности, которая вызвала изменение (messageId, dialogId, etc.)
  actorId: String,        // ID пользователя, который выполнил операцию
  actorType: String,      // Тип актора: 'user', 'bot', 'api', 'system'
  createdAt: Number       // Timestamp изменения
}
```

**Индексы:**
- `{ tenantId: 1, counterType: 1, entityId: 1, createdAt: -1 }`
- `{ tenantId: 1, entityType: 1, entityId: 1, createdAt: -1 }`
- `{ tenantId: 1, sourceOperation: 1, createdAt: -1 }`
- `{ tenantId: 1, userId: 1, createdAt: -1 }` (для быстрого поиска изменений пользователя)

### Важно: Изменения в существующих моделях

#### `DialogMember` - удаление поля `unreadCount`

Поле `unreadCount` будет удалено из модели `DialogMember` и перенесено в `UserDialogStats`.

**Миграция:**
- Существующие значения `unreadCount` из `dialogmembers` нужно перенести в `userdialogstats`
- После миграции поле `unreadCount` будет удалено из схемы `DialogMember`

#### `Message` - без изменений

Модель `Message` остается без изменений. Все счетчики сообщений хранятся в отдельной коллекции `messagestats`.

## Механизм обновления счетчиков

### Подход: MongoDB Middleware + Синхронные функции

#### 1. Pre-save/post-save hooks в моделях

Используем Mongoose middleware для отслеживания изменений:

**UserDialogStats:**
```javascript
userDialogStatsSchema.pre('save', async function(next) {
  if (this.isModified('unreadCount')) {
    // Сохраняем старое значение
    if (this._id) {
      const oldDoc = await this.constructor.findById(this._id);
      this._oldUnreadCount = oldDoc?.unreadCount || 0;
    } else {
      this._oldUnreadCount = 0;
    }
  }
  next();
});

userDialogStatsSchema.post('save', async function(doc) {
  if (doc.isModified('unreadCount')) {
    const oldValue = doc._oldUnreadCount || 0;
    const newValue = doc.unreadCount;
    
    // Сохраняем в историю
    await saveCounterHistory({
      counterType: 'userDialogStats.unreadCount',
      entityType: 'userDialogStats',
      entityId: `${doc.dialogId}:${doc.userId}`,
      field: 'unreadCount',
      oldValue,
      newValue,
      delta: newValue - oldValue,
      operation: newValue > oldValue ? 'increment' : 'decrement',
      // ... остальные поля
    });
    
    // Обновляем UserStats (sourceEventId передается из вызывающей функции)
    // Если sourceEventId не передан, update не создастся
    const sourceEventId = doc._sourceEventId || null;
    const sourceEventType = doc._sourceEventType || null;
    await updateUserStatsFromUnreadCount(doc.tenantId, doc.userId, oldValue, newValue, sourceEventId, sourceEventType);
  }
});
```

**Message:**
```javascript
messageSchema.post('save', async function(doc) {
  // При создании сообщения обновляем unreadCount для всех участников
  if (doc.isNew) {
    await incrementUnreadCountForAllMembers(doc.tenantId, doc.dialogId, doc.messageId, doc.senderId);
  }
});
```

**MessageReactionStats:**
```javascript
messageReactionStatsSchema.pre('save', async function(next) {
  if (this.isModified('count')) {
    // Сохраняем старое значение
    if (this._id) {
      const oldDoc = await this.constructor.findById(this._id);
      this._oldCount = oldDoc?.count || 0;
    } else {
      this._oldCount = 0;
    }
  }
  next();
});

messageReactionStatsSchema.post('save', async function(doc) {
  if (doc.isModified('count')) {
    const oldValue = doc._oldCount || 0;
    const newValue = doc.count;
    
    // Сохраняем в историю
    await saveCounterHistory({
      counterType: 'messageReactionStats.count',
      entityType: 'messageReactionStats',
      entityId: `${doc.messageId}:${doc.reaction}`,
      field: 'count',
      oldValue,
      newValue,
      delta: newValue - oldValue,
      operation: newValue > oldValue ? 'increment' : 'decrement',
      // ... остальные поля
    });
  }
});
```

**MessageStatusStats:**
```javascript
messageStatusStatsSchema.pre('save', async function(next) {
  if (this.isModified('count')) {
    // Сохраняем старое значение
    if (this._id) {
      const oldDoc = await this.constructor.findById(this._id);
      this._oldCount = oldDoc?.count || 0;
    } else {
      this._oldCount = 0;
    }
  }
  next();
});

messageStatusStatsSchema.post('save', async function(doc) {
  if (doc.isModified('count')) {
    const oldValue = doc._oldCount || 0;
    const newValue = doc.count;
    
    // Сохраняем в историю
    await saveCounterHistory({
      counterType: 'messageStatusStats.count',
      entityType: 'messageStatusStats',
      entityId: `${doc.messageId}:${doc.status}`,
      field: 'count',
      oldValue,
      newValue,
      delta: newValue - oldValue,
      operation: 'increment',
      // ... остальные поля
    });
  }
});
```

**MessageStatus:**
```javascript
messageStatusSchema.post('save', async function(doc) {
  if (doc.isNew) {
    // Обновляем счетчик статусов в Message
    await incrementMessageStatusCount(doc.tenantId, doc.messageId, doc.status);
    
    // Обновляем unreadCount если статус изменился на 'read'
    if (doc.status === 'read') {
      await decrementUnreadCount(doc.tenantId, doc.userId, doc.messageId);
    }
  }
});
```

**MessageReaction:**
```javascript
messageReactionSchema.post('save', async function(doc) {
  if (doc.isNew) {
    // Увеличиваем счетчик реакции
    await incrementMessageReactionCount(doc.tenantId, doc.messageId, doc.reaction);
  }
});

messageReactionSchema.post('remove', async function(doc) {
  // Уменьшаем счетчик реакции
  await decrementMessageReactionCount(doc.tenantId, doc.messageId, doc.reaction);
});
```

#### 2. Механизм контекста операций (CounterUpdateContext)

Для предотвращения создания множественных `user.stats.update` при одном событии используется механизм контекста операций:

**Проблема:**
При создании сообщения (`message.create`) может измениться несколько счетчиков:
- Для получателей: `unreadDialogsCount`, `totalUnreadCount` (из-за изменения `unreadCount`)
- Для отправителя: `totalMessagesCount`

Без механизма контекста это привело бы к созданию 2-3 отдельных `user.stats.update` для одного пользователя.

**Решение:**
1. Создается контекст операции (`CounterUpdateContext`) с ключом `tenantId:userId:sourceEventId`
2. Все функции обновления счетчиков добавляют измененные поля в контекст через `context.addUpdatedField()`
3. В конце операции вызывается `finalizeCounterUpdateContext()`, который создает один `user.stats.update` со всеми измененными полями

**Пример:**
```javascript
// При message.create для получателя
const context = getCounterUpdateContext(tenantId, userId, eventId, 'message.create');
// updateUserStatsFromUnreadCount добавляет 'user.stats.unreadDialogsCount' и 'user.stats.totalUnreadCount'
// В конце:
await finalizeCounterUpdateContext(tenantId, userId, eventId);
// Создается один user.stats.update с updatedFields: ['user.stats.unreadDialogsCount', 'user.stats.totalUnreadCount']
```

#### 3. Синхронные функции обновления счетчиков

**Функции для первичных счетчиков:**

```javascript
// Обновление unreadCount
// КРИТИЧНО: Используем атомарные операции для предотвращения race conditions
async function updateUnreadCount(tenantId, userId, dialogId, delta, sourceOperation, sourceEventId, sourceEntityId, actorId, actorType) {
  // Атомарное обновление с $inc - предотвращает race conditions
  const result = await UserDialogStats.findOneAndUpdate(
    { tenantId, userId, dialogId },
    { 
      $inc: { unreadCount: delta },
      $set: { 
        lastUpdatedAt: generateTimestamp(),
        _sourceEventId: sourceEventId,
        _sourceEventType: sourceOperation
      }
    },
    { 
      upsert: true, 
      new: true,
      setDefaultsOnInsert: true // Устанавливает unreadCount: 0 при создании
    }
  );
  
  const oldValue = Math.max(0, (result.unreadCount || 0) - delta);
  const newValue = result.unreadCount;
  
  // Post-save hook обновит UserStats и историю
  // Но нужно вызвать вручную, так как findOneAndUpdate не вызывает hooks
  if (result.isNew || result.modifiedPaths().includes('unreadCount')) {
    // Вызываем логику обновления UserStats вручную
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
  }
  
  return { oldValue, newValue };
}

// Обновление reactionCount
// КРИТИЧНО: Используем атомарные операции
async function updateReactionCount(tenantId, messageId, reaction, delta, sourceOperation, sourceEventId, actorId, actorType) {
  // Атомарное обновление с $inc
  const result = await MessageReactionStats.findOneAndUpdate(
    { tenantId, messageId, reaction },
    { 
      $inc: { count: delta },
      $set: { lastUpdatedAt: generateTimestamp() }
    },
    { 
      upsert: true, 
      new: true,
      setDefaultsOnInsert: true
    }
  );
  
  const newCount = result.count;
  
  if (newCount <= 0) {
    // Удаляем запись если счетчик стал 0 или отрицательным
    await MessageReactionStats.deleteOne({ tenantId, messageId, reaction });
    return { oldValue: newCount - delta, newValue: 0 };
  }
  
  // Сохраняем в историю (findOneAndUpdate не вызывает hooks)
  await saveCounterHistory({
    counterType: 'messageReactionStats.count',
    entityType: 'messageReactionStats',
    entityId: `${messageId}:${reaction}`,
    field: 'count',
    oldValue: newCount - delta,
    newValue: newCount,
    delta,
    operation: delta > 0 ? 'increment' : 'decrement',
    sourceOperation,
    sourceEntityId: messageId,
    actorId,
    actorType: actorType || 'user',
    tenantId
  });
  
  return { oldValue: newCount - delta, newValue: newCount };
}

// Получение всех реакций сообщения
async function getMessageReactionCounts(tenantId, messageId) {
  const stats = await MessageReactionStats.find({ tenantId, messageId });
  return stats.map(s => ({
    reaction: s.reaction,
    count: s.count
  }));
}

// Обновление statusCount
// КРИТИЧНО: Используем атомарные операции
async function updateStatusCount(tenantId, messageId, status, delta, sourceOperation, sourceEventId, actorId, actorType) {
  // Атомарное обновление с $inc
  const result = await MessageStatusStats.findOneAndUpdate(
    { tenantId, messageId, status },
    { 
      $inc: { count: delta },
      $set: { lastUpdatedAt: generateTimestamp() }
    },
    { 
      upsert: true, 
      new: true,
      setDefaultsOnInsert: true
    }
  );
  
  const newCount = result.count;
  const oldCount = newCount - delta;
  
  // Сохраняем в историю (findOneAndUpdate не вызывает hooks)
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

// Получение всех статусов сообщения
async function getMessageStatusCounts(tenantId, messageId) {
  const stats = await MessageStatusStats.find({ tenantId, messageId });
  return stats.map(s => ({
    status: s.status,
    count: s.count
  }));
}
```

**Функции для вычисляемых счетчиков:**

```javascript
// Контекст операции для сбора измененных полей
// Используется для создания одного user.stats.update со всеми изменениями
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
setInterval(() => {
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

// Функция для завершения контекста и создания user.stats.update
// КРИТИЧНО: Гарантированная очистка контекста
async function finalizeCounterUpdateContext(tenantId, userId, sourceEventId) {
  const key = `${tenantId}:${userId}:${sourceEventId || 'no-event'}`;
  const context = counterUpdateContexts.get(key);
  
  if (context) {
    try {
      await context.createStatsUpdate();
    } catch (error) {
      console.error(`Failed to create stats update for context ${key}:`, error);
      // Все равно удаляем контекст, чтобы не было утечки
    } finally {
      counterUpdateContexts.delete(key);
      contextTimestamps.delete(key);
    }
  }
}

// Обновление UserStats на основе изменения unreadCount
async function updateUserStatsFromUnreadCount(tenantId, userId, oldUnreadCount, newUnreadCount, sourceEventId = null, sourceEventType = null) {
  let stats = await UserStats.findOne({ tenantId, userId });
  
  if (!stats) {
    stats = await UserStats.create({
      tenantId,
      userId,
      dialogCount: 0,
      unreadDialogsCount: 0,
      totalUnreadCount: 0,
      totalMessagesCount: 0
    });
  }
  
  const oldWasUnread = oldUnreadCount > 0;
  const newIsUnread = newUnreadCount > 0;
  
  const oldStats = {
    unreadDialogsCount: stats.unreadDialogsCount,
    totalUnreadCount: stats.totalUnreadCount
  };
  
  // Получаем контекст операции
  const context = sourceEventId ? getCounterUpdateContext(tenantId, userId, sourceEventId, sourceEventType) : null;
  
  // Обновляем unreadDialogsCount если статус диалога изменился
  if (oldWasUnread && !newIsUnread) {
    // Диалог стал прочитанным
    stats.unreadDialogsCount = Math.max(0, stats.unreadDialogsCount - 1);
  } else if (!oldWasUnread && newIsUnread) {
    // Диалог стал непрочитанным
    stats.unreadDialogsCount = stats.unreadDialogsCount + 1;
  }
  
  // Обновляем totalUnreadCount
  stats.totalUnreadCount = stats.totalUnreadCount - oldUnreadCount + newUnreadCount;
  
  await stats.save();
  
  // Сохраняем в историю и добавляем в контекст только если значения изменились
  if (oldStats.unreadDialogsCount !== stats.unreadDialogsCount) {
    await saveCounterHistory({
      counterType: 'userStats.unreadDialogsCount',
      entityType: 'user',
      entityId: userId,
      field: 'unreadDialogsCount',
      oldValue: oldStats.unreadDialogsCount,
      newValue: stats.unreadDialogsCount,
      delta: stats.unreadDialogsCount - oldStats.unreadDialogsCount,
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
  
  if (oldStats.totalUnreadCount !== stats.totalUnreadCount) {
    await saveCounterHistory({
      counterType: 'userStats.totalUnreadCount',
      entityType: 'user',
      entityId: userId,
      field: 'totalUnreadCount',
      oldValue: oldStats.totalUnreadCount,
      newValue: stats.totalUnreadCount,
      delta: stats.totalUnreadCount - oldStats.totalUnreadCount,
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

// Обновление dialogCount
// КРИТИЧНО: Используем атомарные операции
async function updateUserStatsDialogCount(tenantId, userId, delta, sourceOperation, sourceEventId = null, actorId, actorType) {
  // Атомарное обновление с $inc
  const result = await UserStats.findOneAndUpdate(
    { tenantId, userId },
    { 
      $inc: { dialogCount: delta },
      $set: { lastUpdatedAt: generateTimestamp() },
      $setOnInsert: {
        unreadDialogsCount: 0,
        totalUnreadCount: 0,
        totalMessagesCount: 0
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

// Обновление totalMessagesCount
// КРИТИЧНО: Используем атомарные операции
async function updateUserStatsTotalMessagesCount(tenantId, userId, delta, sourceOperation, sourceEventId = null, sourceEntityId, actorId, actorType) {
  // Атомарное обновление с $inc
  const result = await UserStats.findOneAndUpdate(
    { tenantId, userId },
    { 
      $inc: { totalMessagesCount: delta },
      $set: { lastUpdatedAt: generateTimestamp() },
      $setOnInsert: {
        dialogCount: 0,
        unreadDialogsCount: 0,
        totalUnreadCount: 0
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
```

#### 3. Интеграция в контроллеры

**messageController.js:**
```javascript
// При создании сообщения
async function createMessage(req, res) {
  // ... создание сообщения
  
  // Получаем eventId из созданного события message.create
  // КРИТИЧНО: eventUtils.createEvent() должен возвращать созданное событие с _id
  const messageEvent = await eventUtils.createEvent({
    tenantId,
    eventType: 'message.create',
    entityType: 'message',
    entityId: message.messageId,
    data: { ... }
  });
  
  const sourceEventId = messageEvent._id; // Используем сразу, без дополнительного запроса
  const sourceEventType = 'message.create';
  
  // Обновление unreadCount для всех участников (кроме отправителя)
  const members = await DialogMember.find({ tenantId, dialogId });
  
  // КРИТИЧНО: Используем try-finally для гарантированной финализации контекстов
  try {
    for (const member of members) {
      if (member.userId !== senderId) {
        await updateUnreadCount(
          tenantId,
          member.userId,
          dialogId,
          1, // delta
          sourceEventType,
          sourceEventId,
          message.messageId,
          senderId,
          'user'
        );
      }
    }
    
    // Обновление totalMessagesCount для отправителя
    await updateUserStatsTotalMessagesCount(
      tenantId,
      senderId,
      1, // delta
      sourceEventType,
      sourceEventId,
      message.messageId,
      senderId,
      'user'
    );
  } finally {
    // КРИТИЧНО: Гарантированная финализация контекстов даже при ошибках
    // Создаем user.stats.update для всех пользователей, у которых изменились счетчики
    // Для получателей (изменился unreadCount)
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
    
    // Для отправителя (изменился totalMessagesCount)
    try {
      await finalizeCounterUpdateContext(tenantId, senderId, sourceEventId);
    } catch (error) {
      console.error(`Failed to finalize context for ${senderId}:`, error);
    }
  }
  
  // ... остальной код
}
```

**messageStatusController.js:**
```javascript
// При изменении статуса сообщения
async function updateMessageStatus(req, res) {
  // ... создание MessageStatus
  
  // Обновление statusCounts происходит автоматически через post-save hook MessageStatus
  // Обновление unreadCount происходит автоматически через post-save hook MessageStatus
  
  // ... остальной код
}
```

**dialogMemberController.js:**
```javascript
// При добавлении участника
async function addDialogMember(req, res) {
  // ... создание DialogMember
  
  // КРИТИЧНО: eventUtils.createEvent() должен возвращать созданное событие
  const memberEvent = await eventUtils.createEvent({
    tenantId,
    eventType: 'dialog.member.add',
    entityType: 'dialogMember',
    entityId: `${dialogId}:${userId}`,
    data: { ... }
  });
  
  const sourceEventId = memberEvent._id; // Используем сразу
  
  // КРИТИЧНО: Используем try-finally для гарантированной финализации
  try {
    // Обновление dialogCount
    await updateUserStatsDialogCount(
      tenantId,
      userId,
      1, // delta
      'dialog.member.add',
      sourceEventId,
      actorId,
      actorType
    );
  } finally {
    // Создаем user.stats.update после всех изменений счетчиков
    try {
      await finalizeCounterUpdateContext(tenantId, userId, sourceEventId);
    } catch (error) {
      console.error(`Failed to finalize context for ${userId}:`, error);
    }
  }
  
  // ... остальной код
}

// При удалении участника
async function removeDialogMember(req, res) {
  // ... удаление DialogMember
  
  // КРИТИЧНО: eventUtils.createEvent() должен возвращать созданное событие
  const memberEvent = await eventUtils.createEvent({
    tenantId,
    eventType: 'dialog.member.remove',
    entityType: 'dialogMember',
    entityId: `${dialogId}:${userId}`,
    data: { ... }
  });
  
  const sourceEventId = memberEvent._id; // Используем сразу
  
  // КРИТИЧНО: Используем try-finally для гарантированной финализации
  try {
    // Обновление dialogCount
    await updateUserStatsDialogCount(
      tenantId,
      userId,
      -1, // delta
      'dialog.member.remove',
      sourceEventId,
      actorId,
      actorType
    );
  } finally {
    // Создаем user.stats.update после всех изменений счетчиков
    try {
      await finalizeCounterUpdateContext(tenantId, userId, sourceEventId);
    } catch (error) {
      console.error(`Failed to finalize context for ${userId}:`, error);
    }
  }
  
  // ... остальной код
}
```

## План реализации

### Этап 1: Создание моделей счетчиков

1. **Создать директорию `src/models/stats/`**
   - Новая директория для моделей счетчиков

2. **Создать модель `UserStats`**
   - Файл: `src/models/stats/UserStats.js`
   - Коллекция: `userstats`
   - Поля: `tenantId`, `userId`, `dialogCount`, `unreadDialogsCount`, `totalUnreadCount`, `totalMessagesCount`
   - Индексы: уникальный на `{ tenantId, userId }`

3. **Создать модель `UserDialogStats`**
   - Файл: `src/models/stats/UserDialogStats.js`
   - Коллекция: `userdialogstats`
   - Поля: `tenantId`, `userId`, `dialogId`, `unreadCount`
   - Индексы: уникальный на `{ tenantId, userId, dialogId }`

4. **Создать модель `MessageReactionStats`**
   - Файл: `src/models/stats/MessageReactionStats.js`
   - Коллекция: `messagereactionstats`
   - Поля: `tenantId`, `messageId`, `reaction`, `count`
   - Индексы: уникальный на `{ tenantId, messageId, reaction }`

5. **Создать модель `MessageStatusStats`**
   - Файл: `src/models/stats/MessageStatusStats.js`
   - Коллекция: `messagestatusstats`
   - Поля: `tenantId`, `messageId`, `status`, `count`
   - Индексы: уникальный на `{ tenantId, messageId, status }`

6. **Создать модель `CounterHistory`**
   - Файл: `src/models/operational/CounterHistory.js`
   - Коллекция: `counterhistory`
   - Поля: все поля из структуры выше
   - Индексы: по `tenantId`, `counterType`, `entityId`, `createdAt`

7. **Обновить `src/models/index.js`**
   - Добавить экспорт новых моделей счетчиков

### Этап 2: Создание утилит для работы со счетчиками

1. **Создать `src/apps/tenant-api/utils/counterUtils.js`**
   - Импортировать `createUserStatsUpdate` из `updateUtils.js` для создания `user.stats.update`
   - Функции для обновления первичных счетчиков:
     - `updateUnreadCount(tenantId, userId, dialogId, delta, sourceOperation, sourceEventId, sourceEntityId, actorId, actorType)`
       - **Использовать атомарные операции:** `findOneAndUpdate` с `$inc` вместо чтения-изменения-записи
       - **Предотвращение race conditions:** атомарное обновление счетчика
     - `updateReactionCount(tenantId, messageId, reaction, delta, sourceOperation, sourceEventId, actorId, actorType)`
       - **Использовать атомарные операции:** `findOneAndUpdate` с `$inc`
     - `updateStatusCount(tenantId, messageId, status, delta, sourceOperation, sourceEventId, actorId, actorType)`
       - **Использовать атомарные операции:** `findOneAndUpdate` с `$inc`
   - Функции для получения счетчиков:
     - `getMessageReactionCounts()` - получение всех реакций сообщения
     - `getMessageStatusCounts()` - получение всех статусов сообщения
   - Функции для обновления вычисляемых счетчиков:
     - `updateUserStatsFromUnreadCount(tenantId, userId, oldUnreadCount, newUnreadCount, sourceEventId, sourceEventType)`
     - `updateUserStatsDialogCount(tenantId, userId, delta, sourceOperation, sourceEventId, actorId, actorType)`
       - **Использовать атомарные операции:** `findOneAndUpdate` с `$inc` для `dialogCount`
     - `updateUserStatsTotalMessagesCount(tenantId, userId, delta, sourceOperation, sourceEventId, sourceEntityId, actorId, actorType)`
       - **Использовать атомарные операции:** `findOneAndUpdate` с `$inc` для `totalMessagesCount`
     - `recalculateUserStats()` (для пересчета всех счетчиков пользователя)
   - Функции для работы с контекстом операций (батчинг изменений):
     - `getCounterUpdateContext(tenantId, userId, sourceEventId, sourceEventType)` - получить/создать контекст операции
       - **TTL механизм:** автоматическое удаление контекстов старше 5 минут
       - **Периодическая очистка:** запускать каждые 5 минут для удаления старых контекстов
     - `finalizeCounterUpdateContext(tenantId, userId, sourceEventId)` - завершить контекст и создать user.stats.update
       - **Гарантированная очистка:** удаление контекста даже при ошибках
     - `CounterUpdateContext` - класс для сбора измененных полей
     - **TTL механизм:** добавить `contextTimestamps` Map и периодическую очистку
   - Функции для работы с историей:
     - `saveCounterHistory()`
     - `getCounterHistory()`

2. **Создать `src/apps/tenant-api/utils/counterMiddleware.js`**
   - Middleware для моделей:
     - Pre-save hooks для сохранения старых значений
     - Post-save hooks для обновления счетчиков
     - Post-remove hooks для обновления счетчиков при удалении

### Этап 3: Интеграция middleware в модели

1. **Обновить `UserDialogStats`**
   - Добавить pre-save hook для сохранения старого `unreadCount`
   - Добавить post-save hook для обновления `UserStats` и сохранения истории

2. **Обновить `MessageReactionStats`**
   - Добавить pre-save hook для сохранения старого значения `count`
   - Добавить post-save hook для сохранения истории изменений

3. **Обновить `MessageStatusStats`**
   - Добавить pre-save hook для сохранения старого значения `count`
   - Добавить post-save hook для сохранения истории изменений

4. **Обновить `Message`**
   - Добавить post-save hook для обновления счетчиков при создании сообщения:
     - Обновление `UserDialogStats.unreadCount` для всех участников (кроме отправителя)
     - Обновление `UserStats.totalMessagesCount` для отправителя
   - Hook будет использовать `UserDialogStats` вместо `DialogMember.unreadCount`

5. **Обновить `MessageStatus`**
   - Добавить post-save hook для обновления `MessageStatusStats.statusCount` и `UserDialogStats.unreadCount`
   - Использовать `MessageStatusStats` для хранения счетчиков статусов

6. **Обновить `MessageReaction`**
   - Добавить post-save hook для обновления `MessageReactionStats.reactionCount`
   - Добавить post-remove hook для обновления `MessageReactionStats.reactionCount` при удалении
   - Использовать `MessageReactionStats` для хранения счетчиков реакций

7. **Обновить `DialogMember`**
   - Удалить поле `unreadCount` из схемы
   - Обновить все места, где используется `DialogMember.unreadCount`, на `UserDialogStats`

### Этап 4: Обновление контроллеров

1. **Обновить `messageController.js`**
   - Использовать `updateUnreadCount()` при создании сообщения
   - Убрать прямые вызовы `incrementUnreadCount()`
   - **КРИТИЧНО:** Использовать try-finally для гарантированной финализации контекстов
   - **КРИТИЧНО:** Использовать возвращаемое значение `eventUtils.createEvent()` вместо дополнительного запроса

2. **Обновить `messageStatusController.js`**
   - Использовать `updateStatusCount()` и `updateUnreadCount()`
   - Убрать прямые вызовы `updateCountersOnStatusChange()`
   - **КРИТИЧНО:** Использовать try-finally для гарантированной финализации контекстов

3. **Обновить `messageReactionController.js`**
   - Использовать `updateReactionCount()`
   - **КРИТИЧНО:** Использовать try-finally для гарантированной финализации контекстов

4. **Обновить `dialogMemberController.js`**
   - Использовать `updateUserStatsDialogCount()` при добавлении/удалении участников
   - **КРИТИЧНО:** Использовать try-finally для гарантированной финализации контекстов
   - **КРИТИЧНО:** Использовать возвращаемое значение `eventUtils.createEvent()` вместо дополнительного запроса

5. **Обновить `eventUtils.js`**
   - **КРИТИЧНО:** Изменить `createEvent()` чтобы возвращать созданное событие с `_id`
   - Это уберет необходимость в дополнительных запросах для получения eventId

### Этап 5: Миграция данных

1. **Создать скрипт миграции `src/scripts/migrate-counters.js`**
   - Мигрировать `unreadCount` из `dialogmembers` в `userdialogstats`
   - Пересчитать все счетчики с нуля
   - Создать записи в `userstats` для всех пользователей (включая `totalMessagesCount` из агрегации `messages`)
   - Создать записи в `userdialogstats` для всех участников диалогов
   - Создать записи в `messagereactionstats` для всех реакций (агрегировать из `messagereactions`)
   - Создать записи в `messagestatusstats` для всех статусов (агрегировать из `messagestatuses`)
   - Создать начальные записи в `counterhistory` (опционально)
   - Удалить поле `unreadCount` из коллекции `dialogmembers` (после миграции)

2. **Создать скрипт валидации `src/scripts/validate-counters.js`**
   - Проверить консистентность всех счетчиков
   - Сравнить вычисляемые счетчики с агрегацией первичных
   - Вывести отчет о несоответствиях

### Этап 6: Обновление update-worker

1. **Обновить `src/utils/updateUtils.js`**
   - Обновить функцию `createUserStatsUpdate()`:
     - Использовать модель `UserStats` напрямую вместо `getUserStats()` (агрегации)
     - Получать данные из БД: `await UserStats.findOne({ tenantId, userId })`
     - Включить поле `totalMessagesCount` в статистику
   - Обновить импорты: добавить `UserStats` из `models/stats/`

2. **Обновить `src/apps/update-worker/index.js`**
   - Обновить логику для `dialog.member.update`:
     - Использовать `UserDialogStats` вместо `DialogMember` для проверки `unreadCount`
     - Проверять изменения через `UserDialogStats.unreadCount` вместо `DialogMember.unreadCount`
   - Обновить логику для `message.create`:
     - Использовать `UserDialogStats` вместо `DialogMember` для проверки `unreadCount`
     - Добавить создание `user.stats.update` для отправителя сообщения (обновление `totalMessagesCount`)
   - Обновить импорты: добавить `UserDialogStats` и `UserStats` из `models/stats/`

3. **Обновить логику определения изменений счетчиков**
   - Использовать механизм контекста операций (`CounterUpdateContext`) для сбора всех измененных полей
   - Создавать один `user.stats.update` в конце операции со всеми измененными полями через `finalizeCounterUpdateContext()`
   - Это предотвращает создание множественных updates при одном событии (например, при `message.create` изменяются `unreadDialogsCount`, `totalUnreadCount` и `totalMessagesCount`)

### Этап 7: Обновление API

1. **Обновить `userDialogController.js`**
   - Использовать `UserStats` вместо агрегации `DialogMember`
   - Использовать `UserDialogStats` для получения `unreadCount` вместо `DialogMember.unreadCount`
   - Добавить endpoint для получения истории изменений счетчиков

2. **Обновить `messageController.js`**
   - Использовать `getMessageReactionCounts()` и `getMessageStatusCounts()` для получения счетчиков
   - Обновить логику получения сообщений для включения счетчиков из `MessageReactionStats` и `MessageStatusStats`

3. **Обновить `userController.js`**
   - Добавить endpoint `GET /api/users/:userId/stats` для получения статистики
   - Добавить endpoint `GET /api/users/:userId/counters/history` для получения истории

4. **Обновить схемы валидации**
   - Добавить схемы для `UserStats`
   - Добавить схемы для `UserDialogStats`
   - Добавить схемы для `MessageReactionStats`
   - Добавить схемы для `MessageStatusStats`
   - Добавить схемы для `CounterHistory`

### Этап 8: Обновление документации

1. **Обновить `docs/API.md`**
   - Добавить описание новых endpoints для счетчиков
   - Обновить примеры ответов с новыми полями

2. **Обновить `docs/ARCHITECTURE.md`**
   - Добавить описание архитектуры счетчиков
   - Обновить диаграммы потоков данных

3. **Создать `docs/COUNTERS.md`**
   - Подробное описание всех счетчиков
   - Примеры использования API для работы со счетчиками

### Этап 9: Важные улучшения

1. **Добавить транзакции для критических операций**
   - Обернуть обновления счетчиков в транзакции для `message.create`
   - Использовать транзакции для `dialog.member.add/remove`
   - Обработка ошибок с откатом транзакций

2. **Оптимизировать массовые обновления**
   - Использовать `bulkWrite()` для обновления множества счетчиков
   - Батчинг операций для участников диалога
   - Асинхронная обработка истории (опционально)

3. **Добавить валидацию консистентности**
   - Фоновый процесс для проверки консистентности
   - Автоматическое исправление несоответствий
   - Логирование и алерты при обнаружении проблем

4. **Добавить retry механизм**
   - Retry для операций обновления счетчиков
   - Exponential backoff при ошибках
   - Dead Letter Queue для неудачных операций (опционально)

### Этап 10: Тестирование

1. **Создать unit-тесты**
   - Тесты для `counterUtils.js`
   - Тесты для middleware моделей
   - Тесты для обновления счетчиков
   - Тесты для контекста операций
   - Тесты для TTL механизма

2. **Создать integration-тесты**
   - Тесты для обновления счетчиков при операциях
   - Тесты для консистентности счетчиков
   - Тесты для истории изменений
   - Тесты для транзакций
   - Тесты для race conditions

3. **Создать performance-тесты**
   - Тесты производительности обновления счетчиков
   - Тесты производительности bulk operations
   - Тесты нагрузки (множество параллельных обновлений)

## Преимущества подхода

1. **Простота** - нет необходимости в асинхронных событиях и worker'ах
2. **Консистентность** - все счетчики обновляются синхронно
3. **Прозрачность** - всегда видно текущее состояние счетчиков в БД
4. **История** - полная история изменений для аудита и отладки
5. **Производительность** - быстрый доступ к счетчикам без агрегации
6. **Масштабируемость** - легко добавлять новые типы счетчиков

## Недостатки и ограничения

1. **Синхронность** - обновление счетчиков замедляет операции
2. **Транзакции** - требуется аккуратность при работе с транзакциями MongoDB
3. **Конкурентность** - возможны race conditions при параллельных обновлениях
4. **Размер БД** - история изменений может занимать много места
5. **Утечки памяти** - глобальный Map контекстов может расти бесконечно
6. **Отсутствие атомарности** - множественные обновления не атомарны
7. **Дополнительные запросы** - получение eventId требует дополнительного запроса к БД
8. **Производительность hooks** - post-save hooks могут замедлять сохранение

**Подробный анализ:** См. [COUNTERS_ARCHITECTURE_REVIEW.md](COUNTERS_ARCHITECTURE_REVIEW.md) для детального анализа проблем и решений.

## Решения для ограничений

1. **Оптимизация производительности**
   - Использовать bulk operations для массовых обновлений
   - Кэшировать часто используемые счетчики
   - Асинхронно сохранять историю (опционально)
   - Использовать атомарные операции (`$inc`) вместо чтения-изменения-записи

2. **Обработка конкурентности**
   - Использовать optimistic locking с версионированием документов
   - Использовать MongoDB transactions для критических операций
   - Retry механизм при конфликтах
   - Атомарные операции для предотвращения race conditions

3. **Управление размером БД**
   - TTL индекс для `counterhistory` (например, 90 дней)
   - Архивация старых записей
   - Периодическая очистка истории
   - Условное сохранение истории (только значимые изменения)

4. **Предотвращение утечек памяти**
   - TTL для контекстов операций (автоматическое удаление старых контекстов)
   - Try-finally блоки для гарантированной финализации
   - Периодическая очистка зависших контекстов

5. **Обеспечение атомарности**
   - MongoDB transactions для критических операций
   - Compensating transactions для отката при ошибках
   - Валидация консистентности после операций

6. **Оптимизация запросов**
   - Возвращать eventId из eventUtils при создании события
   - Избегать дополнительных запросов для получения eventId
   - Кэшировать часто используемые данные

## Альтернативные подходы

### Вариант A: Гибридный подход
- Первичные счетчики обновляются синхронно
- Вычисляемые счетчики обновляются асинхронно через события
- Компромисс между производительностью и консистентностью

### Вариант B: Полностью асинхронный
- Все счетчики обновляются через события
- Counter Worker обрабатывает события и обновляет счетчики
- Максимальная производительность, но eventual consistency

## Рекомендации

1. **Начать с синхронного подхода** - проще реализовать и отладить
2. **Мониторить производительность** - если станет узким местом, перейти на гибридный
3. **Использовать транзакции** - для критических операций (добавление участника, создание сообщения)
4. **Регулярно валидировать** - запускать скрипт валидации для проверки консистентности
5. **Архивировать историю** - периодически архивировать старые записи из `counterhistory`

## Вопросы для обсуждения

1. Нужна ли полная история изменений или достаточно последнего значения?
2. Как часто обновлять вычисляемые счетчики - синхронно или с задержкой?
3. Нужны ли дополнительные счетчики (например, `totalMessagesCount`, `totalReactionsGiven`)?
4. Как обрабатывать ошибки при обновлении счетчиков - retry или откат?
5. Нужна ли возможность ручного пересчета счетчиков через API?

## Анализ архитектуры

**Подробный анализ слабых мест и предложений по улучшению:** [COUNTERS_ARCHITECTURE_REVIEW.md](COUNTERS_ARCHITECTURE_REVIEW.md)

### Ключевые выявленные проблемы:

1. **Утечки памяти** - глобальный Map контекстов может расти бесконечно
2. **Отсутствие атомарности** - множественные обновления не атомарны
3. **Race conditions** - параллельные обновления могут конфликтовать
4. **Дополнительные запросы** - получение eventId требует лишнего запроса
5. **Производительность** - синхронные обновления замедляют операции
6. **Обработка ошибок** - нет механизма восстановления после ошибок

### Критичные улучшения (реализовать сразу):

1. **TTL для контекстов** - предотвратить утечки памяти
2. **Try-finally блоки** - гарантировать финализацию контекстов
3. **Атомарные операции** - использовать `$inc` вместо чтения-изменения-записи
4. **Возврат eventId из eventUtils** - убрать дополнительный запрос

### Важные улучшения (реализовать в ближайшее время):

5. **Транзакции для критических операций** - обеспечить атомарность
6. **Bulk operations** - оптимизировать массовые обновления
7. **Валидация консистентности** - периодическая проверка
8. **Обработка ошибок** - retry механизм

