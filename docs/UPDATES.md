# 📬 Updates - Система обновлений Chat3

## 📖 Оглавление

- [Описание](#описание)
- [Архитектура](#архитектура)
- [Модель Update](#модель-update)
- [Типы Updates](#типы-updates)
- [Процесс создания](#процесс-создания)
- [Update Worker](#update-worker)
- [Routing Keys](#routing-keys)
- [Примеры](#примеры)
- [API](#api)

---

## Описание

**Updates** - это персонализированные уведомления для пользователей о событиях в диалогах, в которых они участвуют.

### 🎯 Основная концепция:

```
Event (система) → Update Worker → Updates (для каждого участника) → RabbitMQ
```

### Ключевые особенности:

- ✅ **Персонализация**: Каждый участник получает свой Update с его мета-тегами
- ✅ **Асинхронность**: Updates формируются отдельным Worker'ом
- ✅ **Надежность**: Сохраняются в MongoDB перед отправкой в RabbitMQ
- ✅ **Routing**: Умная маршрутизация через routing keys
- ✅ **Полные данные**: Update содержит все данные объекта (Dialog/Message)

---

## Архитектура

### 📊 Схема потока данных:

```
┌─────────────┐
│   API       │  1. Действие пользователя
│ Controller  │     (создание сообщения, добавление реакции и т.д.)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ eventUtils  │  2. Создание Event
│ createEvent │     - Сохранение в MongoDB
└──────┬──────┘     - Публикация в RabbitMQ (exchange: chat3_events)
       │
       ▼
┌─────────────┐
│  RabbitMQ   │  3. Exchange: chat3_events
│   Events    │     Routing: dialog.*, message.*
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Update    │  4. Обработка событий
│   Worker    │     - Подписка на chat3_events (#)
└──────┬──────┘     - Формирование Updates для участников
       │
       ▼
┌─────────────┐
│  Update     │  5. Создание персонализированных Updates
│  Utils      │     - DialogUpdate (для dialog.*)
└──────┬──────┘     - MessageUpdate (для message.*)
       │
       ▼
┌─────────────┐
│  MongoDB    │  6. Сохранение Updates
│  Updates    │     - tenantId, userId, dialogId
└──────┬──────┘     - eventId, eventType, data
       │
       ▼
┌─────────────┐
│  RabbitMQ   │  7. Публикация Updates
│   Updates   │     Exchange: chat3_updates
└─────────────┘     Routing: user.{userId}.{updateType}
```

---

## Модель Update

### 📝 Структура:

```javascript
{
  _id: ObjectId,              // MongoDB ID
  tenantId: String,           // ID тенанта (tnt_XXXXXXXX)
  userId: String,             // ID пользователя-получателя
  dialogId: ObjectId,         // ID диалога (ref: Dialog)
  entityId: ObjectId,         // ID сущности (Dialog или Message)
  eventId: ObjectId,          // ID исходного события (ref: Event)
  eventType: String,          // Тип события (dialog.create, message.create и т.д.)
  data: Mixed,                // Полные данные объекта для пользователя
  published: Boolean,         // Отправлен ли в RabbitMQ
  publishedAt: Date,          // Время публикации
  createdAt: Date,            // Время создания
  updatedAt: Date             // Время обновления
}
```

### 🔑 Индексы:

```javascript
// Составные индексы для оптимизации запросов
updateSchema.index({ tenantId: 1, userId: 1, createdAt: -1 });
updateSchema.index({ tenantId: 1, userId: 1, eventType: 1, createdAt: -1 });
updateSchema.index({ tenantId: 1, dialogId: 1, createdAt: -1 });
updateSchema.index({ tenantId: 1, eventId: 1 });
updateSchema.index({ tenantId: 1, published: 1, createdAt: -1 });
```

---

## Типы Updates

### 1️⃣ DialogUpdate

Создается для событий связанных с диалогами:
- `dialog.create` - создание диалога
- `dialog.update` - обновление диалога
- `dialog.delete` - удаление диалога
- `dialog.member.add` - добавление участника
- `dialog.member.remove` - удаление участника

#### Структура data для DialogUpdate:

```javascript
{
  _id: ObjectId,
  tenantId: String,
  name: String,
  createdBy: String,
  createdAt: Date,
  updatedAt: Date,
  meta: {                     // Мета-теги диалога
    type: "internal",
    channelType: "whatsapp",
    // ... другие мета-теги
  },
  dialogMemberMeta: {         // Персональные мета-теги участника
    role: "admin",
    muted: false,
    notifySound: true
  }
}
```

### 2️⃣ MessageUpdate

Создается для событий связанных с сообщениями:
- `message.create` - создание сообщения
- `message.update` - обновление сообщения
- `message.delete` - удаление сообщения
- `message.reaction.add` - добавление реакции
- `message.reaction.update` - обновление реакции
- `message.reaction.remove` - удаление реакции
- `message.status.create` - создание статуса
- `message.status.update` - обновление статуса

#### Структура data для MessageUpdate:

```javascript
{
  _id: ObjectId,
  tenantId: String,
  dialogId: ObjectId,
  senderId: String,
  content: String,            // До 4096 символов
  type: String,
  reactionCounts: {           // Счетчики реакций
    "👍": 5,
    "❤️": 3
  },
  createdAt: Date,
  updatedAt: Date,
  meta: {                     // Мета-теги сообщения
    channelType: "telegram",
    channelId: "TG0001",
    // ... другие мета-теги
  }
}
```

---

## Процесс создания

### 📋 Этапы создания Update:

#### 1. **Событие создается в контроллере**

```javascript
// Пример из messageController.js
await eventUtils.createEvent({
  tenantId: req.tenantId,
  eventType: 'message.create',
  entityType: 'message',
  entityId: message._id,
  actorId: senderId,
  actorType: 'user',
  data: {
    dialogId: dialogId,
    dialogName: dialog.name,
    messageType: type,
    content: eventContent,
    meta: messageMeta
  }
});
```

#### 2. **Event сохраняется и публикуется**

- Сохранение в MongoDB (`Event` коллекция)
- Публикация в RabbitMQ (`chat3_events` exchange)
- Routing key: `dialog.*` или `message.*`

#### 3. **Update Worker получает событие**

```javascript
// updateWorker.js
channel.consume(WORKER_QUEUE, async (msg) => {
  const eventData = JSON.parse(msg.content.toString());
  await processEvent(eventData);
});
```

#### 4. **Создаются персонализированные Updates**

**Для DialogUpdate:**
```javascript
// Для каждого участника диалога
dialogMembers.forEach(member => {
  Update.create({
    userId: member.userId,
    data: {
      ...dialogData,
      dialogMemberMeta: memberMeta  // Персональные теги
    }
  });
});
```

**Для MessageUpdate:**
```javascript
// Для каждого участника диалога
dialogMembers.forEach(member => {
  Update.create({
    userId: member.userId,
    data: messageData
  });
});
```

#### 5. **Updates публикуются в RabbitMQ**

- Exchange: `chat3_updates`
- Routing key: `user.{userId}.{updateType}`
- Примеры: `user.carl.dialogupdate`, `user.marta.messageupdate`

---

## Update Worker

### 🔧 Запуск Worker:

```bash
# Через скрипт
./start-worker.sh

# Напрямую
node src/workers/updateWorker.js

# В фоне
nohup node src/workers/updateWorker.js > /tmp/worker.log 2>&1 &
```

### 📊 Что делает Worker:

1. **Подключается к MongoDB и RabbitMQ**
2. **Подписывается на exchange `chat3_events`** с routing key `#` (все события)
3. **Обрабатывает каждое событие:**
   - Определяет тип update (Dialog/Message)
   - Находит всех участников диалога
   - Создает персонализированные Updates
   - Публикует Updates в `chat3_updates`
4. **Логирует процесс** в stdout

### 📋 Примеры логов Worker:

```
✅ RabbitMQ connected successfully
   Exchange: chat3_events (topic)
   Worker Queue: update_worker_queue
   Binding: # (all events)

👂 Waiting for events...

✅ Update Worker is running

📩 Processing event: message.create (6909e1087e50f546b8c4a9a1)
✅ Created MessageUpdate for event 6909e1087e50f546b8c4aa20
Created 3 MessageUpdate for message 6909e1087e50f546b8c4a9a1
```

---

## Routing Keys

### 📮 Формат Routing Keys для Updates:

```
user.{userId}.{updateType}
```

### Примеры:

| Update Type | User ID | Routing Key | Описание |
|-------------|---------|-------------|----------|
| DialogUpdate | carl | `user.carl.dialogupdate` | Updates о диалогах для Carl |
| MessageUpdate | marta | `user.marta.messageupdate` | Updates о сообщениях для Marta |
| DialogUpdate | sara | `user.sara.dialogupdate` | Updates о диалогах для Sara |

### 🎯 Как клиент подписывается:

```javascript
// Клиент создает очередь и привязывается к нужным routing keys
const queue = await channel.assertQueue(`user_${userId}_queue`);

// Подписка на все updates пользователя
await channel.bindQueue(queue, 'chat3_updates', `user.${userId}.*`);

// Подписка только на MessageUpdates
await channel.bindQueue(queue, 'chat3_updates', `user.${userId}.messageupdate`);

// Подписка только на DialogUpdates
await channel.bindQueue(queue, 'chat3_updates', `user.${userId}.dialogupdate`);
```

---

## Примеры

### 📝 Пример 1: Создание сообщения

**1. Пользователь Carl отправляет сообщение в диалог "Техподдержка" (3 участника: carl, sara, john)**

**2. Создается Event:**
```json
{
  "_id": "6909e1087e50f546b8c4aa20",
  "tenantId": "tnt_default",
  "eventType": "message.create",
  "entityType": "message",
  "entityId": "6909e1087e50f546b8c4a9a1",
  "actorId": "carl",
  "actorType": "user",
  "data": {
    "dialogId": "6909e1087e50f546b8c4a936",
    "dialogName": "Техподдержка",
    "messageType": "text",
    "content": "Привет всем!"
  },
  "createdAt": "2025-11-04T12:18:32.000Z"
}
```

**3. Update Worker создает 3 Updates (по одному для каждого участника):**

**Update для Carl (отправитель):**
```json
{
  "_id": "6909e1087e50f546b8c4aa21",
  "tenantId": "tnt_default",
  "userId": "carl",
  "dialogId": "6909e1087e50f546b8c4a936",
  "entityId": "6909e1087e50f546b8c4a9a1",
  "eventId": "6909e1087e50f546b8c4aa20",
  "eventType": "message.create",
  "data": {
    "_id": "6909e1087e50f546b8c4a9a1",
    "tenantId": "tnt_default",
    "dialogId": "6909e1087e50f546b8c4a936",
    "senderId": "carl",
    "content": "Привет всем!",
    "type": "text",
    "reactionCounts": {},
    "createdAt": "2025-11-04T12:18:32.000Z",
    "meta": {
      "channelType": "whatsapp",
      "channelId": "WA0001"
    }
  },
  "published": true,
  "publishedAt": "2025-11-04T12:18:32.500Z",
  "createdAt": "2025-11-04T12:18:32.450Z"
}
```

**Update для Sara:**
```json
{
  "_id": "6909e1087e50f546b8c4aa22",
  "tenantId": "tnt_default",
  "userId": "sara",
  "dialogId": "6909e1087e50f546b8c4a936",
  "entityId": "6909e1087e50f546b8c4a9a1",
  "eventId": "6909e1087e50f546b8c4aa20",
  "eventType": "message.create",
  "data": { /* те же данные сообщения */ },
  "published": true,
  "publishedAt": "2025-11-04T12:18:32.501Z"
}
```

**Update для John:**
```json
{
  "_id": "6909e1087e50f546b8c4aa23",
  "tenantId": "tnt_default",
  "userId": "john",
  "dialogId": "6909e1087e50f546b8c4a936",
  "entityId": "6909e1087e50f546b8c4a9a1",
  "eventId": "6909e1087e50f546b8c4aa20",
  "eventType": "message.create",
  "data": { /* те же данные сообщения */ },
  "published": true,
  "publishedAt": "2025-11-04T12:18:32.502Z"
}
```

**4. Updates публикуются в RabbitMQ:**
- Routing key для Carl: `user.carl.messageupdate`
- Routing key для Sara: `user.sara.messageupdate`
- Routing key для John: `user.john.messageupdate`

---

### 📝 Пример 2: Добавление участника в диалог

**1. Добавляется новый участник Kirk в диалог "Проектные обсуждения"**

**2. Создается Event:**
```json
{
  "eventType": "dialog.member.add",
  "entityType": "dialogMember",
  "entityId": "6909e1087e50f546b8c4aa30",
  "data": {
    "userId": "kirk",
    "dialogId": "6909e1087e50f546b8c4a937"
  }
}
```

**3. Update Worker создает DialogUpdates для всех участников (включая Kirk)**

**Update для Kirk (новый участник):**
```json
{
  "userId": "kirk",
  "eventType": "dialog.member.add",
  "data": {
    "_id": "6909e1087e50f546b8c4a937",
    "name": "Проектные обсуждения",
    "createdBy": "system_bot",
    "meta": {
      "type": "internal",
      "maxParticipants": 50
    },
    "dialogMemberMeta": {       // Персональные мета-теги Kirk
      "role": "member",
      "muted": false,
      "notifySound": true
    }
  }
}
```

---

## Типы Updates

### 🔍 Определение типа:

```javascript
// src/utils/updateUtils.js
function getUpdateTypeFromEventType(eventType) {
  const dialogUpdateEvents = [
    'dialog.create',
    'dialog.update',
    'dialog.delete',
    'dialog.member.add',
    'dialog.member.remove'
  ];

  const messageUpdateEvents = [
    'message.create',
    'message.update',
    'message.delete',
    'message.reaction.add',
    'message.reaction.update',
    'message.reaction.remove',
    'message.status.create',
    'message.status.update'
  ];

  if (dialogUpdateEvents.includes(eventType)) {
    return 'DialogUpdate';
  }
  if (messageUpdateEvents.includes(eventType)) {
    return 'MessageUpdate';
  }
  return null;
}
```

---

## Процесс создания

### 🔄 createDialogUpdate()

**Назначение:** Создает персонализированные updates для всех участников диалога

**Параметры:**
- `tenantId` - ID тенанта
- `dialogId` - ID диалога (ObjectId)
- `eventId` - ID события (ObjectId)
- `eventType` - Тип события (dialog.create, dialog.member.add и т.д.)

**Процесс:**
1. Находит диалог по ID
2. Получает мета-теги диалога
3. Находит всех активных участников
4. Для каждого участника:
   - Получает персональные мета-теги DialogMember
   - Формирует data с общими и персональными тегами
   - Создает Update в MongoDB
   - Публикует Update в RabbitMQ

**Код:**
```javascript
export async function createDialogUpdate(tenantId, dialogId, eventId, eventType) {
  const dialog = await Dialog.findById(dialogId);
  const dialogMeta = await metaUtils.getEntityMeta(tenantId, 'dialog', dialogId.toString());
  const dialogMembers = await DialogMember.find({ tenantId, dialogId, isActive: true });

  const updates = await Promise.all(
    dialogMembers.map(async (member) => {
      const memberMeta = await metaUtils.getEntityMeta(tenantId, 'dialogMember', member._id.toString());
      
      return {
        tenantId,
        userId: member.userId,
        dialogId,
        entityId: dialogId,
        eventId,
        eventType,
        data: {
          ...dialog.toObject(),
          meta: dialogMeta,
          dialogMemberMeta: memberMeta
        },
        published: false
      };
    })
  );

  const savedUpdates = await Update.insertMany(updates);
  savedUpdates.forEach(update => publishUpdate(update));
}
```

---

### 🔄 createMessageUpdate()

**Назначение:** Создает updates для всех участников диалога при событиях с сообщениями

**Параметры:**
- `tenantId` - ID тенанта
- `dialogId` - ID диалога (ObjectId)
- `messageId` - ID сообщения (ObjectId)
- `eventId` - ID события (ObjectId)
- `eventType` - Тип события (message.create, message.reaction.add и т.д.)

**Процесс:**
1. Находит сообщение по ID
2. Получает мета-теги сообщения
3. Находит всех активных участников диалога
4. Для каждого участника:
   - Формирует data с полными данными сообщения
   - Ограничивает content до 4096 символов
   - Создает Update в MongoDB
   - Публикует Update в RabbitMQ

**Код:**
```javascript
export async function createMessageUpdate(tenantId, dialogId, messageId, eventId, eventType) {
  const message = await Message.findById(messageId);
  const messageMeta = await metaUtils.getEntityMeta(tenantId, 'message', messageId);
  const dialogMembers = await DialogMember.find({ tenantId, dialogId, isActive: true });

  const MAX_CONTENT_LENGTH = 4096;
  const messageContent = message.content.length > MAX_CONTENT_LENGTH 
    ? message.content.substring(0, MAX_CONTENT_LENGTH) 
    : message.content;

  const updates = dialogMembers.map(member => ({
    tenantId,
    userId: member.userId,
    dialogId,
    entityId: messageId,
    eventId,
    eventType,
    data: {
      ...message.toObject(),
      content: messageContent,
      meta: messageMeta
    },
    published: false
  }));

  const savedUpdates = await Update.insertMany(updates);
  savedUpdates.forEach(update => publishUpdate(update));
}
```

---

## API

### Пока API для Updates не реализован

Updates - это **внутренний механизм** для доставки обновлений клиентам через RabbitMQ.

Клиенты должны:
1. Подключаться к RabbitMQ
2. Создавать свою очередь
3. Привязывать её к exchange `chat3_updates`
4. Указывать routing key: `user.{userId}.*`

### Пример подписки клиента (Node.js):

```javascript
import amqp from 'amqplib';

const RABBITMQ_URL = 'amqp://rmuser:rmpassword@localhost:5672/';
const EXCHANGE_NAME = 'chat3_updates';
const USER_ID = 'carl';

async function subscribeToUpdates() {
  const connection = await amqp.connect(RABBITMQ_URL);
  const channel = await connection.createChannel();

  // Создаем персональную очередь
  const queue = await channel.assertQueue(`user_${USER_ID}_updates`, {
    durable: false,
    autoDelete: true
  });

  // Привязываем к exchange со всеми updates пользователя
  await channel.bindQueue(queue.queue, EXCHANGE_NAME, `user.${USER_ID}.*`);

  console.log(`Waiting for updates for user: ${USER_ID}`);

  // Получаем updates
  channel.consume(queue.queue, (msg) => {
    const update = JSON.parse(msg.content.toString());
    console.log('Received update:', update);
    
    // Обработка update
    if (update.eventType === 'message.create') {
      // Показать новое сообщение
      displayMessage(update.data);
    } else if (update.eventType === 'dialog.member.add') {
      // Обновить список диалогов
      refreshDialogList();
    }
    
    channel.ack(msg);
  });
}
```

---

## Особенности

### ✨ Персонализация

Каждый участник получает Update с **его персональными мета-тегами**:

```javascript
// DialogUpdate для участника A
{
  "data": {
    "name": "Общий чат",
    "dialogMemberMeta": {
      "role": "admin",      // Роль участника A
      "muted": false
    }
  }
}

// DialogUpdate для участника B
{
  "data": {
    "name": "Общий чат",
    "dialogMemberMeta": {
      "role": "member",     // Роль участника B
      "muted": true         // Отключил уведомления
    }
  }
}
```

### 🚀 Производительность

**Преимущества архитектуры:**

1. **Асинхронность**: API не ждет создания Updates
2. **Масштабируемость**: Worker можно запустить в нескольких экземплярах
3. **Надежность**: Updates сохраняются в MongoDB перед отправкой
4. **Оптимизация**: Compound indexes для быстрых запросов

### 🔒 Безопасность

- ✅ **Tenant Isolation**: Updates фильтруются по `tenantId`
- ✅ **User Isolation**: Каждый пользователь получает только свои Updates
- ✅ **Dialog Access**: Updates создаются только для участников диалога

---

## Мониторинг

### 📊 Проверка Updates в MongoDB:

```javascript
// Все updates пользователя
db.updates.find({ tenantId: "tnt_default", userId: "carl" })
  .sort({ createdAt: -1 })
  .limit(10);

// Неопубликованные updates
db.updates.find({ published: false });

// Updates по диалогу
db.updates.find({ dialogId: ObjectId("...") })
  .sort({ createdAt: -1 });

// Статистика по типам
db.updates.aggregate([
  { $group: { _id: "$eventType", count: { $sum: 1 } } },
  { $sort: { count: -1 } }
]);
```

### 🔍 Логи Worker:

```bash
# Просмотр логов в реальном времени
tail -f /tmp/worker.log

# Поиск ошибок
grep "Error" /tmp/worker.log

# Подсчет обработанных событий
grep "Processing event" /tmp/worker.log | wc -l

# Подсчет созданных updates
grep "Created.*Update" /tmp/worker.log | wc -l
```

---

## Диагностика

### 🐛 Типичные проблемы:

#### **1. Updates не создаются**

**Причины:**
- Worker не запущен
- RabbitMQ недоступен
- Событие не поддерживает Updates

**Решение:**
```bash
# Проверить Worker
ps aux | grep updateWorker

# Запустить Worker
./start-worker.sh

# Проверить логи
tail -f /tmp/worker.log
```

#### **2. Updates не публикуются в RabbitMQ**

**Причины:**
- RabbitMQ connection потерян
- Exchange не создан
- Ошибка публикации

**Решение:**
```bash
# Проверить RabbitMQ
curl http://localhost:15672/api/exchanges

# Проверить exchange chat3_updates
curl -u rmuser:rmpassword http://localhost:15672/api/exchanges/%2F/chat3_updates

# Перезапустить Worker
pkill -f updateWorker
./start-worker.sh
```

#### **3. Клиент не получает Updates**

**Причины:**
- Неправильный routing key
- Очередь не привязана к exchange
- Клиент не подключен к RabbitMQ

**Решение:**
- Проверить routing key: должен быть `user.{userId}.*`
- Проверить привязку очереди к exchange
- Проверить логи RabbitMQ

---

## Производительность

### 📈 Оптимизация:

**1. Batch Processing**
```javascript
// Worker может обрабатывать события пакетами
channel.prefetch(10); // Обрабатывать до 10 событий одновременно
```

**2. Индексы**
```javascript
// Оптимизированные составные индексы
updateSchema.index({ tenantId: 1, userId: 1, createdAt: -1 });
updateSchema.index({ tenantId: 1, dialogId: 1, createdAt: -1 });
```

**3. Ограничение контента**
```javascript
// Контент сообщения ограничен 4096 символами
const MAX_CONTENT_LENGTH = 4096;
const messageContent = message.content.substring(0, MAX_CONTENT_LENGTH);
```

---

## Конфигурация

### 🔧 Переменные окружения:

```bash
# MongoDB
MONGODB_URI=mongodb://localhost:27017/chat3

# RabbitMQ
RABBITMQ_URL=amqp://rmuser:rmpassword@localhost:5672/

# Exchange names (опционально)
RABBITMQ_EXCHANGE=chat3_events
RABBITMQ_UPDATES_EXCHANGE=chat3_updates
```

### 📋 Docker:

```yaml
# docker-compose.yml
services:
  chat3-worker:
    environment:
      - MONGODB_URI=${MONGODB_URI}
      - RABBITMQ_URL=${RABBITMQ_URL}
    restart: unless-stopped
```

---

## Расширение

### 🔧 Добавление новых типов Updates:

**1. Добавить eventType в списки:**

```javascript
// src/utils/updateUtils.js
const dialogUpdateEvents = [
  'dialog.create',
  'dialog.update',
  'dialog.delete',
  'dialog.member.add',
  'dialog.member.remove',
  'dialog.settings.update'  // 🆕 Новый тип
];
```

**2. Обработать в Worker:**

```javascript
// src/workers/updateWorker.js
if (shouldUpdate.dialog) {
  await updateUtils.createDialogUpdate(tenantId, dialogId, eventId, eventType);
}
```

**3. Создать Event в контроллере:**

```javascript
// Новый контроллер
await eventUtils.createEvent({
  eventType: 'dialog.settings.update',
  entityType: 'dialog',
  entityId: dialog._id,
  data: { /* данные */ }
});
```

---

## Связанные документы

- **[EVENTS.md](EVENTS.md)** - Система событий
- **[WORKERS.md](WORKERS.md)** - Update Worker
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - Архитектура проекта
- **[API.md](API.md)** - REST API

---

## Заключение

**Updates** - это ключевой механизм для **real-time уведомлений** в Chat3:

✅ Персонализированные данные для каждого пользователя  
✅ Асинхронная обработка через Worker  
✅ Надежность через MongoDB + RabbitMQ  
✅ Гибкая маршрутизация через routing keys  
✅ Масштабируемость через множественные Workers  

---

**Версия документа:** 1.0  
**Последнее обновление:** 2025-11-04

