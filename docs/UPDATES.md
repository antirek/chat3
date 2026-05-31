# Система обновлений Chat3

## Обзор

Updates - это персонализированные обновления для пользователей, создаваемые на основе событий. Каждый Update содержит полные данные объекта (Dialog или Message) с учетом контекста конкретного пользователя.

**Целевые представления клиента** (`messages.list`, `dialogs.list`, `users.list`) и маршрутизация счётчиков по назначению — см. [UPDATES_UI_TARGETS.md](./UPDATES_UI_TARGETS.md).

## Модель Update

```javascript
{
  _id: ObjectId("..."),       // MongoDB ObjectId
  tenantId: "tnt_default",
  userId: "carl",              // Получатель update
  entityId: "dlg_...",         // ID сущности (dlg_* для dialog, msg_* для message, userId для user)
  eventId: ObjectId("..."),   // Ссылка на исходное событие
  eventType: "dialog.create", // Тип исходного события
  data: { ... },               // Полные данные для пользователя (context, dialog, message, member, typing, user)
  published: false,            // Отправлен ли в RabbitMQ
  publishedAt: null,           // Timestamp публикации (микросекунды)
  createdAt: 1763551369397.6482  // Timestamp создания (микросекунды)
}
```

## Соответствие событий и обновлений

| Исходное событие | Тип Update | Категория | Routing Key | Получатели | Включенные секции в data |
|------------------|-----------|-----------|-------------|-----------|-------------------------|
| `dialog.create` | `DialogUpdate` | `dialog` | `update.dialog.{userType}.{userId}.dialogupdate` | Все участники диалога | `dialog`, `context` (+ `member` если есть) |
| `dialog.update` | `DialogUpdate` | `dialog` | `update.dialog.{userType}.{userId}.dialogupdate` | Все участники диалога | `dialog`, `context` (+ `member` если есть) |
| `dialog.delete` | `DialogUpdate` | `dialog` | `update.dialog.{userType}.{userId}.dialogupdate` | Все участники диалога | `dialog`, `context` (+ `member` если есть) |
| `dialog.member.add` | `DialogUpdate` | `dialog` | `update.dialog.{userType}.{userId}.dialogupdate` | Все участники + добавленный | `dialog`, `member`, `context` |
| `dialog.member.remove` | `DialogUpdate` | `dialog` | `update.dialog.{userType}.{userId}.dialogupdate` | Все участники + удаляемый | `dialog`, `member`, `context` |
| `dialog.member.update` | `DialogMemberUpdate` | `dialog` | `update.dialog.{userType}.{userId}.dialogmemberupdate` | Конкретный участник | `dialog`, `member`, `context` |
| `message.create` | `MessageUpdate` | `dialog` | `update.dialog.{userType}.{userId}.messageupdate` | Все участники диалога | `dialog`, `message`, `context` (+ `member` если есть) |
| `message.update` | `MessageUpdate` | `dialog` | `update.dialog.{userType}.{userId}.messageupdate` | Все участники диалога | `dialog`, `message`, `context` (+ `member` если есть) |
| `message.status.update` | `MessageUpdate` | `dialog` | `update.dialog.{userType}.{userId}.messageupdate` | Все участники диалога | `dialog`, `message` (с `statusUpdate`, `statusMessageMatrix`), `context` |
| `message.reaction.update` | `MessageUpdate` | `dialog` | `update.dialog.{userType}.{userId}.messageupdate` | Все участники диалога | `dialog`, `message` (с `reactionUpdate`), `context` |
| `dialog.typing` | `TypingUpdate` | `dialog` | `update.dialog.{userType}.{userId}.typingupdate` | Все участники (кроме инициатора) | `dialog`, `typing`, `context` (+ `member` если есть) |
| `user.add` | `UserUpdate` | `user` | `update.user.{userType}.{userId}.userupdate` | Конкретный пользователь | `user`, `context` |
| `user.update` | `UserUpdate` | `user` | `update.user.{userType}.{userId}.userupdate` | Конкретный пользователь | `user`, `context` |
| `user.remove` | `UserUpdate` | `user` | `update.user.{userType}.{userId}.userupdate` | Конкретный пользователь | `user`, `context` |
| `user.stats.update`* | `UserStatsUpdate` | `user` | `update.user.{userType}.{userId}.userstatsupdate` | Конкретный пользователь | `user` (с `stats`, включая `packs.messages.*`), `context` |

**Примечания:**
- `{userType}` - тип пользователя из модели User (user, bot, contact и т.д.)
- `{userId}` - ID пользователя-получателя update
- `*` - `user.stats.update` создаётся counter-worker после пересчёта счётчиков (не доменное Event)
- **Push по пакам отключён (PR1–PR2):** `pack.stats.updated` и `user.pack.stats.updated` **не публикуются**. Per-pack unread — `GET /api/users/:userId/packs`; агрегат packed — `user.stats.update`. Binding `update.pack.*` устарел.

## Типы Updates

### Dialog Updates

Создаются для событий:
- `dialog.create`
- `dialog.update`
- `dialog.delete`
- `dialog.member.add`
- `dialog.member.remove`

**Структура data:**
```json
{
  "dialog": {
    "dialogId": "dlg_...",
    "tenantId": "tnt_default",
    "name": "VIP чат",
    "createdBy": "carl",
    "createdAt": 1763551369397.6482,
    "updatedAt": 1763551369397.6482,
    "meta": {}
  },
  "member": {
    "userId": "carl",
    "meta": {},
    "state": {
      "unreadCount": 5,
      "lastSeenAt": 1763551369397.6482,
      "lastMessageAt": 1763551369397.6482,
      "isActive": true
    }
  },
  "context": {
    "eventType": "dialog.create",
    "dialogId": "dlg_...",
    "entityId": "dlg_...",
    "includedSections": ["dialog", "member"]
  }
}
```

### Dialog Member Updates

Создаются для событий:
- `dialog.member.update`

**Структура data:**
```json
{
  "dialog": { ... },
  "member": {
    "userId": "carl",
    "meta": {},
    "state": {
      "unreadCount": 0,
      "lastSeenAt": 1763551369397.6482,
      "lastMessageAt": null,
      "isActive": true
    }
  },
  "context": {
    "eventType": "dialog.member.update",
    "dialogId": "dlg_...",
    "entityId": "dlg_...",
    "includedSections": ["dialog", "member"]
  }
}
```

### Message Updates

Создаются для событий:
- `message.create`
- `message.update`
- `message.reaction.update`
- `message.status.update`

**Примечание:** События `message.delete`, `message.reaction.add`, `message.reaction.remove`, `message.status.create` не создают MessageUpdate, но могут быть получены через Events.

**Структура data:**

Для `message.create` и `message.update`:
```json
{
  "dialog": { ... },
  "message": {
    "messageId": "msg_...",
    "dialogId": "dlg_...",
    "senderId": "carl",
    "type": "internal.text",
    "content": "Hello!",
    "meta": {},
    "statuses": [],
    "senderInfo": {
      "userId": "carl",
      "name": "Carl Johnson",
      "createdAt": 1763551369397.6482,
      "meta": {}
    }
  },
  "context": {
    "eventType": "message.create",
    "dialogId": "dlg_...",
    "entityId": "msg_...",
    "messageId": "msg_...",
    "includedSections": ["dialog", "message"]
  }
}
```

Для `message.status.update`:
```json
{
  "dialog": { ... },
  "message": {
    "messageId": "msg_...",
    "dialogId": "dlg_...",
    "senderId": "carl",
    "type": "internal.text",
    "statusUpdate": {
      "userId": "alice",
      "status": "read",
      "readAt": 1763551369397.6482,
      "createdAt": 1763551369397.6482
    },
    "statusMessageMatrix": [
      {
        "userType": "user",
        "status": "read",
        "count": 3
      }
    ]
  },
  "context": {
    "eventType": "message.status.update",
    "dialogId": "dlg_...",
    "entityId": "msg_...",
    "messageId": "msg_...",
    "includedSections": ["dialog", "message", "statusUpdate"]
  }
}
```

Для `message.reaction.update`:
```json
{
  "dialog": { ... },
  "message": {
    "messageId": "msg_...",
    "dialogId": "dlg_...",
    "senderId": "carl",
    "type": "internal.text",
    "reactionUpdate": {
      "userId": "alice",
      "reaction": "👍",
      "createdAt": 1763551369397.6482
    }
  },
  "context": {
    "eventType": "message.reaction.update",
    "dialogId": "dlg_...",
    "entityId": "msg_...",
    "messageId": "msg_...",
    "includedSections": ["dialog", "message", "reactionUpdate"]
  }
}
```

### Typing Updates

Создаются для событий:
- `dialog.typing`

**Структура data:**
```json
{
  "dialog": { ... },
  "typing": {
    "userId": "carl",
    "expiresInMs": 5000,
    "timestamp": 1763551369397.6482,
    "userInfo": null
  },
  "context": {
    "eventType": "dialog.typing",
    "dialogId": "dlg_...",
    "entityId": "dlg_...",
    "includedSections": ["dialog", "typing"]
  }
}
```

**Примечание:** TypingUpdate создается для всех участников диалога, кроме инициатора печати.

### User Updates

Создаются для событий:
- `user.add`
- `user.update`
- `user.remove`

**Структура data:**
```json
{
  "user": {
    "userId": "carl",
    "type": "user",
    "meta": {}
  },
  "context": {
    "eventType": "user.add",
    "entityId": "carl",
    "includedSections": ["user"]
  }
}
```

### User Stats Updates

Создаются автоматически для событий:
- `user.stats.update` (создается автоматически при изменении статистики)

**Структура data:**
```json
{
  "user": {
    "userId": "carl",
    "type": "user",
    "meta": {},
    "stats": {
      "dialogCount": 5,
      "unreadDialogsCount": 2
    }
  },
  "context": {
    "eventType": "user.stats.update",
    "entityId": "carl",
    "includedSections": ["user"],
    "updatedFields": ["user.stats.dialogCount", "user.stats.unreadDialogsCount"]
  }
}
```

**Примечание:** UserStatsUpdate создается автоматически при:
- Добавлении/удалении участника из диалога (изменяется `dialogCount`)
- Изменении `unreadCount` участника диалога (изменяется `unreadDialogsCount`)
- Создании нового сообщения (может измениться `unreadDialogsCount`)

### Per-pack unread (GET, без push)

Push **`user.pack.stats.updated`** и **`pack.stats.updated`** отключены. Counter-worker пересчитывает `UserPackUnreadBySenderType` и `PackStats` в MongoDB; клиент читает:

- агрегат packed unread — **`user.stats.update`** (`user.stats.packs.messages.*`)
- unread по каждому паку — **`GET /api/users/:userId/packs`**

Исторический формат секции `userPackStats` (если встретится в старых Update в БД): `packId`, `userId`, `unreadCount`, `unreadBySenderType`, `lastUpdatedAt`.

## RabbitMQ Exchange

### Exchange: chat3_updates

- **Тип:** topic
- **Durable:** true

### Routing Keys

Формат: `update.{category}.{userType}.{userId}.{updateType}`

**Компоненты:**
- `category` - категория обновления: `dialog` (DialogUpdate, …), `user` (UserUpdate, UserStatsUpdate)
- `userType` - тип пользователя из модели User (user, bot, contact и т.д.)
- `userId` - ID пользователя-получателя
- `updateType` - тип обновления в нижнем регистре: `dialogupdate`, `dialogmemberupdate`, `messageupdate`, `typingupdate`, `userupdate`, `userstatsupdate`

**Примеры:**
- `update.dialog.user.carl.dialogupdate` - обновление диалога для пользователя carl типа user
- `update.dialog.user.carl.messageupdate` - обновление сообщения для пользователя carl
- `update.dialog.bot.bot_123.messageupdate` - обновление сообщения для бота bot_123
- `update.user.user.carl.userstatsupdate` - обновление статистики для пользователя carl

**Примечание:** Если пользователь не найден в модели User, используется тип `user` по умолчанию.

### Подписка на обновления

#### Подписка для конкретного пользователя

```javascript
const userId = 'carl';
const userType = 'user'; // Получается из модели User

const queueName = `user_${userId}_updates`;
await channel.assertQueue(queueName, {
  durable: true,
  arguments: {
    'x-message-ttl': 3600000 // 1 час TTL
  }
});

// Подписка на все обновления пользователя
// Формат: update.{category}.{userType}.{userId}.*
await channel.bindQueue(queueName, 'chat3_updates', `update.*.${userType}.${userId}.*`);
```

#### Подписка для всех пользователей определенного типа

```javascript
// Все обновления для пользователей типа bot
await channel.bindQueue(queueName, 'chat3_updates', 'update.*.bot.*.*');

// Все обновления диалогов для пользователей типа user
await channel.bindQueue(queueName, 'chat3_updates', 'update.dialog.user.*.*');

// Все обновления статистики для всех пользователей
await channel.bindQueue(queueName, 'chat3_updates', 'update.user.*.*.userstatsupdate');
```

#### Подписка на все обновления

```javascript
// Все обновления для всех пользователей
await channel.bindQueue(queueName, 'chat3_updates', 'update.*.*.*.*');
```

## Создание Updates

Updates создаются автоматически Update Worker при обработке событий:

1. Событие получается из RabbitMQ
2. Worker определяет тип события и нужность создания Update
3. Для Dialog Updates:
   - Получаются все активные участники диалога
   - Для каждого участника создается Update с его персональными данными
4. Для Message Updates:
   - Получаются все активные участники диалога
   - Для каждого участника создается Update с полным сообщением
5. Updates сохраняются в MongoDB
6. Updates публикуются в RabbitMQ exchange `chat3_updates`

## Получение Updates

### Через RabbitMQ (рекомендуется)

```javascript
import amqp from 'amqplib';

const connection = await amqp.connect('amqp://localhost:5672');
const channel = await connection.createChannel();

const userId = 'carl';
const userType = 'user'; // Получается из модели User

const queueName = `user_${userId}_updates`;
await channel.assertQueue(queueName, {
  durable: true,
  arguments: { 'x-message-ttl': 3600000 }
});

// Подписка на все обновления пользователя
await channel.bindQueue(queueName, 'chat3_updates', `update.*.${userType}.${userId}.*`);

channel.consume(queueName, (msg) => {
  if (msg) {
    const update = JSON.parse(msg.content.toString());
    console.log('Update received:', update.eventType);
    
    // Обработка update
    handleUpdate(update);
    
    channel.ack(msg);
  }
});
```

### Через API (для отладки)

Updates можно получить напрямую из MongoDB через AdminJS или напрямую:

```javascript
// Получить последние updates для пользователя
const updates = await Update.find({
  tenantId: 'tnt_default',
  userId: 'carl'
})
.sort({ createdAt: -1 })
.limit(10);
```

## Специальные случаи

### Удаление участника (dialog.member.remove)

При удалении участника из диалога:
- Update создается для удаляемого пользователя
- В member.state устанавливается `isActive: false`
- Update доставляется даже если пользователь уже не активный участник

### Обновление содержимого сообщения

При обновлении содержимого сообщения:
- Создается событие `message.update`
- Создается Update для всех участников диалога
- В meta тегах сообщения устанавливается `updated: true`

## TTL для очередей

Персональные очереди пользователей имеют TTL 1 час (3600000 мс). Это означает:
- Сообщения в очереди автоматически удаляются через 1 час
- Пользователи должны обрабатывать updates своевременно
- Для долгосрочного хранения используйте MongoDB

## Пример обработки Update

```javascript
function handleUpdate(update) {
  const { eventType, data } = update;
  
  switch (eventType) {
    // Dialog Updates
    case 'dialog.create':
    case 'dialog.update':
    case 'dialog.delete':
      handleDialogUpdate(data);
      break;
      
    // Dialog Member Updates
    case 'dialog.member.add':
      handleMemberAdded(data);
      break;
      
    case 'dialog.member.remove':
      handleMemberRemoved(data);
      break;
      
    case 'dialog.member.update':
      handleMemberUpdated(data);
      break;
      
    // Message Updates
    case 'message.create':
    case 'message.update':
    case 'message.status.update':
    case 'message.reaction.update':
      handleMessageUpdate(data);
      break;
      
    // Typing Updates
    case 'dialog.typing':
      handleTypingUpdate(data);
      break;
      
    // User Updates
    case 'user.add':
    case 'user.update':
    case 'user.remove':
      handleUserUpdate(data);
      break;
      
    // User Stats Updates
    case 'user.stats.update':
      handleUserStatsUpdate(data);
      break;
  }
}

function handleDialogUpdate(data) {
  const { dialog, member } = data;
  
  // Обновить локальное состояние диалога
  updateLocalDialog(dialog);
  
  // Обновить состояние участника
  if (member) {
    updateLocalMemberState(member);
  }
}

function handleMessageUpdate(data) {
  const { dialog, message } = data;
  
  // Добавить/обновить сообщение в локальном состоянии
  addOrUpdateMessage(dialog.dialogId, message);
  
  // Если есть statusUpdate или reactionUpdate, обработать их
  if (message.statusUpdate) {
    updateMessageStatus(dialog.dialogId, message.messageId, message.statusUpdate);
  }
  if (message.reactionUpdate) {
    updateMessageReaction(dialog.dialogId, message.messageId, message.reactionUpdate);
  }
}

function handleTypingUpdate(data) {
  const { dialog, typing } = data;
  
  // Показать индикатор печати
  showTypingIndicator(dialog.dialogId, typing.userId, typing.expiresInMs);
}

function handleUserUpdate(data) {
  const { user } = data;
  
  // Обновить информацию о пользователе
  updateUserInfo(user);
}

function handleUserStatsUpdate(data) {
  const { user } = data;
  
  // Обновить статистику пользователя
  updateUserStats(user.userId, user.stats);
}
```

---

## Для интегрируемых приложений

**Updates** — персонализированные уведомления для пользователей. Каждый Update адресован конкретному `userId` и содержит полные данные (диалог, сообщение, участник и т.д.) с учётом контекста получателя.

**Где смотреть:**
- **Полный справочник по обновлениям** — этот документ (UPDATES.md).
- **Справочник по событиям (источники Updates)** — [EVENTS.md](EVENTS.md).
- **Пошаговая интеграция, подписка на очередь, примеры обработки** — [INTEGRATION.md](INTEGRATION.md).

**Updates — ключевые данные для интегратора:**

| Параметр | Значение |
|----------|----------|
| Exchange | `chat3_updates` (type: topic) |
| Формат routing key | `update.{category}.{userType}.{userId}.{updateType}` |
| category | `dialog` (DialogUpdate, …), `user` (UserUpdate, UserStatsUpdate) |
| updateType | `dialogupdate`, `dialogmemberupdate`, `messageupdate`, `typingupdate`, `userupdate`, `userstatsupdate` |
| Подписка (все обновления пользователя) | `update.*.{userType}.{userId}.*` (например `update.*.user.carl.*`) |

**Типы Updates (кратко):** DialogUpdate, DialogMemberUpdate, MessageUpdate, TypingUpdate, UserUpdate, UserStatsUpdate. Per-pack unread — GET, не push (PR2).

**Рекомендация:** Подписывайтесь на Updates по `userId` (и при необходимости `userType`), создавайте отдельную очередь на пользователя или сервис, обрабатывайте payload по `eventType` и типу update — примеры в [INTEGRATION.md](INTEGRATION.md).

