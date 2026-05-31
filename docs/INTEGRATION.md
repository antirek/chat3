# Интеграция с Chat3

## Обзор

Этот документ описывает процесс интеграции внешних систем с Chat3 через RabbitMQ для получения событий и обновлений в реальном времени.

**Events и Updates — где что искать:**
- **[EVENTS.md](EVENTS.md)** — полный справочник по событиям: типы событий, структура `data`, routing keys в `chat3_events`, соответствие событий и создаваемых Updates. Для интеграторов в конце документа есть раздел «Для интегрируемых приложений».
- **[UPDATES.md](UPDATES.md)** — полный справочник по обновлениям: типы Updates, структура `data`, routing keys в `chat3_updates`, соответствие событий и Updates. Для интеграторов в конце — раздел «Для интегрируемых приложений».
- **Ниже** — пошаговая настройка подключения к RabbitMQ, подписка на Updates по пользователю, примеры обработки в коде.

## Архитектура интеграции

```mermaid
graph LR
    A[Chat3 API] -->|События| B[RabbitMQ Events]
    B -->|Обработка| C[Update Worker]
    C -->|Updates| D[RabbitMQ Updates]
    D -->|Подписка| E[Ваша система]
    E -->|Обработка| F[Локальное состояние]
```

## Предварительные требования

1. **RabbitMQ подключение**
   - URL: `amqp://rmuser:rmpassword@localhost:5672/`
   - Exchange: `chat3_events` (topic)
   - Exchange: `chat3_updates` (topic)

2. **API ключ Chat3**
   - Получить через `npm run generate-key`
   - Использовать в заголовке `X-API-Key`

3. **Tenant ID**
   - По умолчанию: `tnt_default`
   - Или создать свой через API

## Подключение к RabbitMQ

### Node.js пример

```javascript
import amqp from 'amqplib';

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://rmuser:rmpassword@localhost:5672/';
const UPDATES_EXCHANGE = 'chat3_updates';

async function connectToChat3() {
  const connection = await amqp.connect(RABBITMQ_URL);
  const channel = await connection.createChannel();
  
  // Проверяем наличие exchange
  await channel.assertExchange(UPDATES_EXCHANGE, 'topic', { durable: true });
  
  return { connection, channel };
}
```

### Формат Routing Keys для Updates

Updates публикуются в exchange `chat3_updates` с routing key в формате:

```
update.{category}.{userType}.{userId}.{updateType}
```

Где:
- `category` - категория обновления:
  - `dialog` - для DialogUpdate, DialogMemberUpdate, MessageUpdate, TypingUpdate
  - `user` - для UserUpdate, UserStatsUpdate
  - `pack` - для UserPackStatsUpdate (unread по пакам пользователя)
- `userType` - тип пользователя из модели User (user, bot, contact и т.д.)
- `userId` - ID пользователя-получателя
- `updateType` - тип обновления в нижнем регистре:
  - `dialogupdate`, `dialogmemberupdate`, `messageupdate`, `typingupdate`, `userupdate`, `userstatsupdate`, `packstatsupdate`, `userpackstatsupdate`

**Примеры routing keys:**
- `update.dialog.user.carl.dialogupdate` - обновление диалога для пользователя carl
- `update.dialog.user.carl.messageupdate` - обновление сообщения для пользователя carl
- `update.user.user.carl.userstatsupdate` - обновление статистики для пользователя carl
- `update.pack.user.carl.userpackstatsupdate` - обновление unreadCount по паку для пользователя carl

Для подписки используйте wildcards:
- `update.*.{userType}.{userId}.*` - все обновления для пользователя (dialog, user, pack)
- `update.dialog.{userType}.{userId}.*` - все обновления диалогов для пользователя
- `update.pack.{userType}.{userId}.*` - UserPackStatsUpdate для пользователя (unread по пакам)

## Подписка на обновления пользователя

### Шаг 1: Получить тип пользователя

Тип пользователя хранится в модели User. Используйте API:

```bash
GET /api/users/:userId
```

Или получите из Update (поле `userId` в routing key).

### Шаг 2: Создать очередь для пользователя

```javascript
async function subscribeToUserUpdates(channel, userId, userType = 'user') {
  const queueName = `user_${userId}_updates`;
  
  // Создаем очередь с TTL 1 час
  await channel.assertQueue(queueName, {
    durable: true,
    arguments: {
      'x-message-ttl': 3600000 // 1 час
    }
  });
  
  // Привязываем к exchange с routing key
  // Формат: update.{category}.{userType}.{userId}.*
  // category: dialog (DialogUpdate, DialogMemberUpdate, MessageUpdate, TypingUpdate) или user (UserUpdate, UserStatsUpdate)
  const routingKey = `update.*.${userType}.${userId}.*`;
  await channel.bindQueue(queueName, 'chat3_updates', routingKey);
  
  console.log(`✅ Subscribed to updates for user ${userId} (type: ${userType})`);
  console.log(`   Queue: ${queueName}`);
  console.log(`   Routing key pattern: ${routingKey}`);
  
  return queueName;
}
```

### Шаг 3: Обработка обновлений

```javascript
async function consumeUserUpdates(channel, queueName, userId) {
  await channel.consume(queueName, async (msg) => {
    if (!msg) return;
    
    try {
      const update = JSON.parse(msg.content.toString());
      
      console.log(`📩 Update received for ${userId}:`, update.eventType);
      
      // Обработка update
      await handleUpdate(update);
      
      // Подтверждаем обработку
      channel.ack(msg);
    } catch (error) {
      console.error('Error processing update:', error);
      // Отклоняем сообщение (можно настроить retry логику)
      channel.nack(msg, false, false);
    }
  });
  
  console.log(`👂 Listening for updates on queue: ${queueName}`);
}
```

### Подписка только на pack updates пользователя

Чтобы получать **UserPackStatsUpdate** по пакам для конкретного пользователя, привяжите очередь к exchange `chat3_updates` с routing key `update.pack.{userType}.{userId}.*`:

```javascript
async function subscribeToUserPackUpdates(channel, userId, userType = 'user') {
  const queueName = `user_${userId}_pack_updates`;
  await channel.assertQueue(queueName, { durable: true, arguments: { 'x-message-ttl': 3600000 } });
  const routingKey = `update.pack.${userType}.${userId}.*`;
  await channel.bindQueue(queueName, 'chat3_updates', routingKey);
  console.log(`✅ Subscribed to pack updates for user ${userId}: ${routingKey}`);
  return queueName;
}
```

**Примечание:** агрегаты пака (`messageCount`, `uniqueMemberCount`, …) доступны через GET API; push **`pack.stats.updated` не используется**. В очередь `update.pack.*` приходит только **`UserPackStatsUpdate`**. Подробнее см. [UPDATES_UI_TARGETS.md](UPDATES_UI_TARGETS.md) и [UPDATES.md](UPDATES.md).

## Обработка различных типов обновлений

### Dialog Updates

Создаются для событий: `dialog.create`, `dialog.update`, `dialog.delete`, `dialog.member.add`, `dialog.member.remove`, `dialog.topic.create`, `dialog.topic.update`

**Важно:** В секции `dialog` каждого Update теперь содержится поле `stats` с информацией о непрочитанных сообщениях для получателя update:

```javascript
{
  dialog: {
    dialogId: "dlg_...",
    tenantId: "tnt_default",
    createdAt: 1234567890,
    meta: {},
    stats: {                    // Статистика для получателя update
      unreadCount: 10           // Количество непрочитанных сообщений в диалоге
    }
  }
}
```

```javascript
async function handleDialogUpdate(update) {
  const { eventType, data } = update;
  const { dialog, member, context } = data;
  
  // dialog.stats.unreadCount содержит количество непрочитанных сообщений
  // для пользователя, которому адресован этот update
  const unreadCount = dialog.stats?.unreadCount || 0;
  
  switch (eventType) {
    case 'dialog.create':
      // Новый диалог создан
      await addDialogToLocalState(dialog, member);
      await updateDialogUnreadCount(dialog.dialogId, unreadCount);
      break;
      
    case 'dialog.update':
      // Диалог обновлен
      await updateDialogInLocalState(dialog);
      await updateDialogUnreadCount(dialog.dialogId, unreadCount);
      break;
      
    case 'dialog.delete':
      // Диалог удален
      await removeDialogFromLocalState(dialog.dialogId);
      break;
      
    case 'dialog.member.add':
      // Добавлен участник
      await addMemberToDialog(dialog.dialogId, member);
      break;
      
    case 'dialog.member.remove':
      // Удален участник
      if (member.userId === currentUserId) {
        // Пользователь удален из диалога
        await removeDialogFromLocalState(dialog.dialogId);
      } else {
        // Другой участник удален
        await removeMemberFromDialog(dialog.dialogId, member.userId);
      }
      break;
      
    case 'dialog.topic.create':
      // Создан новый топик в диалоге
      // topic информация может быть в data.topic
      await handleTopicCreated(dialog.dialogId, data.topic);
      break;
      
    case 'dialog.topic.update':
      // Топик обновлен
      await handleTopicUpdated(dialog.dialogId, data.topic);
      break;
  }
}
```

### Dialog Member Updates

Создаются для событий: `dialog.member.update`

```javascript
async function handleDialogMemberUpdate(update) {
  const { eventType, data } = update;
  const { dialog, member, context } = data;
  
  // Обновлено состояние участника (unreadCount, lastSeenAt и т.д.)
  await updateMemberStateInDialog(dialog.dialogId, member);
}
```

### Message Updates

Создаются для событий: `message.create`, `message.update`, `message.reaction.update`, `message.status.update`

**Примечание:** События `message.delete`, `message.reaction.add`, `message.reaction.remove` не создают MessageUpdate, но могут быть получены через Events.

```javascript
async function handleMessageUpdate(update) {
  const { eventType, data } = update;
  const { dialog, message, context } = data;
  
  switch (eventType) {
    case 'message.create':
      // Новое сообщение
      // message.topicId - ID топика (если сообщение в топике)
      // message.topic - объект с информацией о топике (topicId, meta)
      await addMessageToDialog(dialog.dialogId, message);
      break;
      
    case 'message.update':
      // Сообщение обновлено
      await updateMessageInDialog(dialog.dialogId, message);
      break;
      
    case 'message.status.update':
      // Статус сообщения изменился (прочитано, доставлено)
      await updateMessageStatus(dialog.dialogId, message);
      break;
      
    case 'message.reaction.update':
      // Реакция изменилась
      await updateMessageReactions(dialog.dialogId, message);
      break;
  }
}
```

### Топики (Topics)

Топики позволяют организовывать сообщения внутри диалога по темам. Каждое сообщение может быть привязано к топику через поле `topicId`.

#### Структура топика в событиях и updates

В событиях `message.create` и `message.update`, а также в MessageUpdate, сообщения могут содержать информацию о топике:

```javascript
{
  message: {
    messageId: "msg_...",
    dialogId: "dlg_...",
    senderId: "user123",
    content: "Сообщение в топике",
    topicId: "topic_abc123...",  // ID топика (если сообщение в топике)
    topic: {                      // Объект с информацией о топике
      topicId: "topic_abc123...",
      dialogId: "dlg_...",
      createdAt: 1234567890,
      meta: {
        // Мета-теги топика (например, название, цвет и т.д.)
        name: "Важная тема",
        color: "#FF5733"
      }
    }
  }
}
```

Если сообщение не привязано к топику, поля `topicId` и `topic` будут `null`.

#### События, связанные с топиками

Топики создаются и обновляются через события:
- `dialog.topic.create` - создание нового топика в диалоге
- `dialog.topic.update` - обновление топика (мета-теги)

Эти события создают DialogUpdate для всех участников диалога.

#### API для работы с топиками

**Получение списка топиков диалога:**

Поддерживается параметр `filter` в операторном формате (поля: `topicId`, `dialogId`, `meta.*`). Доступны AND (`&`), OR (`|`) и группировка скобками. Подробнее — в docs/API.md, раздел «Фильтрация».

```bash
GET /api/dialogs/{dialogId}/topics?page=1&limit=20
# С фильтром по meta:
GET /api/dialogs/{dialogId}/topics?filter=(meta.priority,in,[support,general])
GET /api/dialogs/{dialogId}/topics?filter=(meta.name,eq,a)|(meta.name,eq,b)
```

**Получение топиков в контексте пользователя (с количеством непрочитанных сообщений):**

Тот же формат `filter`, что и для списка топиков диалога.

```bash
GET /api/users/{userId}/dialogs/{dialogId}/topics?page=1&limit=20
```

Ответ включает `unreadCount` для каждого топика:
```json
{
  "data": [
    {
      "topicId": "topic_abc123...",
      "dialogId": "dlg_...",
      "createdAt": 1234567890,
      "meta": {
        "name": "Важная тема"
      },
      "unreadCount": 5  // Количество непрочитанных сообщений в топике для пользователя
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 10
  }
}
```

**Создание топика:**
```bash
POST /api/dialogs/{dialogId}/topics
Content-Type: application/json

{
  "meta": {
    "name": "Новый топик",
    "color": "#FF5733"
  }
}
```

**Создание сообщения с топиком:**
```bash
POST /api/dialogs/{dialogId}/messages
Content-Type: application/json

{
  "senderId": "user123",
  "content": "Сообщение в топике",
  "type": "internal.text",
  "topicId": "topic_abc123..."  // Указываем ID топика
}
```

#### Поиск диалогов по топикам

API поддерживает поиск диалогов пользователя по топикам и их мета-тегам через фильтры в `GET /api/users/{userId}/dialogs`. Поддерживаются комбинирование через `&` (AND), `|` (OR) и группировка скобками; при одновременном использовании AND и OR скобки обязательны. Лимит: не более 5 веток в OR и 5 операндов в одной группе. Подробнее — docs/API.md, раздел «Фильтрация».

**Фильтрация по topicId:**

```bash
# Диалоги с конкретным топиком
GET /api/users/{userId}/dialogs?filter=(topic.topicId,eq,topic_abc123...)

# Диалоги с любыми топиками
GET /api/users/{userId}/dialogs?filter=(topic.topicId,ne,null)

# Диалоги с любым из указанных топиков
GET /api/users/{userId}/dialogs?filter=(topic.topicId,in,[topic1,topic2])

# Диалоги без указанных топиков
GET /api/users/{userId}/dialogs?filter=(topic.topicId,nin,[topic1,topic2])
```

**Фильтрация по мета-тегам топиков:**

```bash
# Диалоги с топиками, имеющими мета-тег category=support
GET /api/users/{userId}/dialogs?filter=(topic.meta.category,eq,support)

# Диалоги с топиками, приоритет которых high или urgent
GET /api/users/{userId}/dialogs?filter=(topic.meta.priority,in,[high,urgent])

# Диалоги с топиками, статус которых НЕ archived
GET /api/users/{userId}/dialogs?filter=(topic.meta.status,ne,archived)

# Диалоги с топиками, имеющими мета-тег assignedTo (любое значение)
GET /api/users/{userId}/dialogs?filter=(topic.meta.assignedTo,exists,true)

# Диалоги с топиками, НЕ имеющими мета-тег archived
GET /api/users/{userId}/dialogs?filter=(topic.meta.archived,exists,false)
```

**Фильтрация по количеству топиков:**

```bash
# Диалоги с хотя бы одним топиком
GET /api/users/{userId}/dialogs?filter=(topic.topicCount,gt,0)

# Диалоги без топиков
GET /api/users/{userId}/dialogs?filter=(topic.topicCount,eq,0)

# Диалоги с 5 и более топиками
GET /api/users/{userId}/dialogs?filter=(topic.topicCount,gte,5)
```

**Комбинированные фильтры (AND и OR):**

Условия можно комбинировать через `&` (AND) и `|` (OR). При одновременном использовании `&` и `|` обязательна группировка скобками.

```bash
# AND: диалоги с топиками категории "support" и приоритетом "high"
GET /api/users/{userId}/dialogs?filter=(topic.meta.category,eq,support)&(topic.meta.priority,eq,high)

# AND: диалоги с топиками приоритета "high" или "urgent", не архивные
GET /api/users/{userId}/dialogs?filter=(topic.meta.priority,in,[high,urgent])&(topic.meta.status,ne,archived)

# AND: диалоги с конкретным топиком, имеющим назначенного пользователя
GET /api/users/{userId}/dialogs?filter=(topic.topicId,eq,topic_abc123)&(topic.meta.assignedTo,exists,true)

# OR: диалоги с топиками категории "support" или "sales"
GET /api/users/{userId}/dialogs?filter=(topic.meta.category,eq,support)|(topic.meta.category,eq,sales)

# Группировка: (support и high) или (sales и urgent)
GET /api/users/{userId}/dialogs?filter=((topic.meta.category,eq,support)&(topic.meta.priority,eq,high))|((topic.meta.category,eq,sales)&(topic.meta.priority,eq,urgent))
```

**Примеры использования:**

```javascript
// Поиск диалогов с топиками категории "support"
const response = await fetch(
  `/api/users/${userId}/dialogs?filter=(topic.meta.category,eq,support)`,
  {
    headers: {
      'X-API-Key': apiKey,
      'X-Tenant-ID': tenantId
    }
  }
);

// Поиск диалогов с топиками приоритета "high" или "urgent"
const response = await fetch(
  `/api/users/${userId}/dialogs?filter=(topic.meta.priority,in,[high,urgent])`,
  {
    headers: {
      'X-API-Key': apiKey,
      'X-Tenant-ID': tenantId
    }
  }
);

// Комбинированный поиск: support топики с назначенным пользователем
const response = await fetch(
  `/api/users/${userId}/dialogs?filter=(topic.meta.category,eq,support)&(topic.meta.assignedTo,exists,true)`,
  {
    headers: {
      'X-API-Key': apiKey,
      'X-Tenant-ID': tenantId
    }
  }
);

// ИЛИ: диалоги с топиками категории "support" или "sales"
const responseOr = await fetch(
  `/api/users/${userId}/dialogs?filter=(topic.meta.category,eq,support)|(topic.meta.category,eq,sales)`,
  {
    headers: {
      'X-API-Key': apiKey,
      'X-Tenant-ID': tenantId
    }
  }
);
```

**Поддерживаемые операторы для фильтров топиков:**

- `eq` - равно
- `ne` - не равно
- `in` - в массиве значений
- `nin` - не в массиве значений
- `exists` - существование поля (true/false)
- `regex` - регулярное выражение
- `gt`, `gte`, `lt`, `lte` - для `topic.topicCount` (количество топиков)

**Алфавит meta-ключа:**  
Ключ meta может содержать только буквы, цифры и подчёркивание (без точки и дефиса). Используйте подчёркивание как разделитель (например, `contact_phone`). Подробнее — docs/API.md, раздел «Фильтрация».

**Фильтрация сообщений по топикам:**

В `GET /api/dialogs/{dialogId}/messages` и `GET /api/users/{userId}/dialogs/{dialogId}/messages` можно фильтровать сообщения по топику; поддерживаются AND/OR и группировка:

```bash
# Сообщения конкретного топика
GET /api/dialogs/{dialogId}/messages?filter=(topicId,eq,topic_abc123...)

# Сообщения без топика
GET /api/dialogs/{dialogId}/messages?filter=(topicId,eq,null)

# Сообщения из топика A или B (ИЛИ)
GET /api/dialogs/{dialogId}/messages?filter=(topicId,eq,topic_a)|(topicId,eq,topic_b)
```

#### Обработка топиков в вашей системе

```javascript
async function handleMessageUpdate(update) {
  const { eventType, data } = update;
  const { dialog, message } = data;
  
  if (message.topicId) {
    // Сообщение привязано к топику
    const topic = message.topic;
    
    // Сохраняем информацию о топике
    await saveTopicInfo(dialog.dialogId, topic);
    
    // Добавляем сообщение в топик
    await addMessageToTopic(dialog.dialogId, message.topicId, message);
  } else {
    // Сообщение без топика (в основном потоке диалога)
    await addMessageToDialog(dialog.dialogId, message);
  }
}

async function handleDialogUpdate(update) {
  const { eventType, data } = update;
  const { dialog, topic } = data;  // topic может быть в dialog.update событиях
  
  if (eventType === 'dialog.topic.create') {
    // Новый топик создан
    await addTopicToDialog(dialog.dialogId, topic);
  } else if (eventType === 'dialog.topic.update') {
    // Топик обновлен
    await updateTopicInDialog(dialog.dialogId, topic);
  }
}
```

#### Статистика по топикам

В секции `dialog` каждого Update теперь содержится поле `stats` с информацией о непрочитанных сообщениях:

```javascript
{
  dialog: {
    dialogId: "dlg_...",
    tenantId: "tnt_default",
    createdAt: 1234567890,
    meta: {},
    stats: {                    // Статистика для получателя update
      unreadCount: 10           // Общее количество непрочитанных сообщений в диалоге
    }
  }
}
```

Для получения детальной статистики по топикам используйте endpoint `/api/users/{userId}/dialogs/{dialogId}/topics`, который возвращает `unreadCount` для каждого топика.

### Typing Updates

Создаются для событий: `dialog.typing`

**Важно:** В секции `dialog` также содержится поле `stats` с информацией о непрочитанных сообщениях для получателя update.

```javascript
async function handleTypingUpdate(update) {
  const { eventType, data } = update;
  const { dialog, typing, context } = data;
  
  // Пользователь печатает в диалоге
  await showTypingIndicator(dialog.dialogId, typing.userId, typing.expiresInMs);
  
  // dialog.stats.unreadCount содержит актуальное количество непрочитанных сообщений
  const unreadCount = dialog.stats?.unreadCount || 0;
  await updateDialogUnreadCount(dialog.dialogId, unreadCount);
}
```

### User Updates

Создаются для событий: `user.add`, `user.update`, `user.remove`

```javascript
async function handleUserUpdate(update) {
  const { eventType, data } = update;
  const { user, context } = data;
  
  switch (eventType) {
    case 'user.add':
      await addUserToLocalState(user);
      break;
      
    case 'user.update':
      await updateUserInLocalState(user);
      break;
      
    case 'user.remove':
      await removeUserFromLocalState(user.userId);
      break;
  }
}
```

### User Stats Updates

Создаются автоматически для событий: `user.stats.update`

**Примечание:** Этот тип update создается автоматически при изменении статистики пользователя (количество диалогов, непрочитанных диалогов, `packs.messages.*` и т.д.).

**Snapshot (replace):** `data.user.stats` — **полный снимок**. На клиенте заменяйте объект целиком, не merge по полям:

```javascript
async function handleUserStatsUpdate(update) {
  const { userId, data } = update;
  const { user, context } = data;

  // store.users[userId].stats = user.stats  — replace целиком
  await replaceUserStats(userId, user.stats);

  // context.updatedFields — подсказка для UI (анимации, логи), не patch
  console.log('Updated fields hint:', context?.updatedFields);
}
```

### UI targets (`context` v3)

В `data.context` каждого Update (версия `3`) есть поле **`uiTarget`** — куда применить update в клиенте. Routing key RabbitMQ может остаться прежним; **маршрутизация внутри приложения** — по `uiTarget`.

| updateType | `context.uiTarget` |
|------------|-------------------|
| `MessageUpdate`, `TypingUpdate` | `messages.list` |
| `DialogUpdate`, `DialogMemberUpdate` | `dialogs.list` |
| `UserStatsUpdate`, `UserUpdate`, `UserPackStatsUpdate` | `users.list` |

Дополнительные поля контекста:

| Поле | Значение |
|------|----------|
| `sourceEventType` | доменное событие-источник (`message.create`, …) |
| `sourceEventId` | id события-источника (`evt_...`) |
| `updatedFields` | подсказка, какие поля изменились (не patch) |

Пример фильтрации по target:

```javascript
async function handleUpdate(update) {
  const uiTarget = update.data?.context?.uiTarget;
  if (uiTarget === 'messages.list') {
    await applyMessagesListUpdate(update);
  } else if (uiTarget === 'dialogs.list') {
    await applyDialogsListUpdate(update);
  } else if (uiTarget === 'users.list') {
    await applyUsersListUpdate(update);
  }
}
```

Подробная спецификация: [UPDATES_UI_TARGETS.md](UPDATES_UI_TARGETS.md).

### User Pack Stats Updates

Создаются автоматически для `user.pack.stats.updated` (counter-worker). **Snapshot (replace):** `data.userPackStats` — полный снимок unread по паку для пользователя:

```javascript
async function handleUserPackStatsUpdate(update) {
  const { userPackStats, context } = update.data;
  const { packId, userId } = userPackStats;

  // store.userPacks[userId][packId] = userPackStats  — replace целиком
  await replaceUserPackStats(userId, packId, userPackStats);
}
```

## Подписка на события (опционально)

Если нужны события напрямую (без обработки через Updates):

**Важно:** Некоторые события не создают Updates, но доступны через Events:
- `message.delete` - удаление сообщения
- `message.reaction.add` - добавление реакции
- `message.reaction.remove` - удаление реакции

Для получения этих событий подпишитесь на exchange `chat3_events`:

```javascript
async function subscribeToEvents(channel) {
  const queueName = 'my_events_queue';
  
  await channel.assertQueue(queueName, { durable: true });
  
  // Подписка на все события диалогов
  await channel.bindQueue(queueName, 'chat3_events', 'dialog.*');
  
  // Подписка на все события сообщений
  await channel.bindQueue(queueName, 'chat3_events', 'message.*');
  
  await channel.consume(queueName, (msg) => {
    if (msg) {
      const event = JSON.parse(msg.content.toString());
      console.log('Event received:', event.eventType);
      handleEvent(event);
      channel.ack(msg);
    }
  });
}
```

**Формат routing key для событий:** `{entityType}.{action}.{tenantId}`

Примеры:
- `dialog.create.tnt_default` - создание диалога
- `message.delete.tnt_default` - удаление сообщения
- `dialog.member.add.tnt_default` - добавление участника

Для подписки на все события используйте wildcard: `#` (все события) или `*.create.*` (все события создания).

## Полный пример интеграции

```javascript
import amqp from 'amqplib';

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://rmuser:rmpassword@localhost:5672/';
const UPDATES_EXCHANGE = 'chat3_updates';

class Chat3Integration {
  constructor(userId, userType = 'user') {
    this.userId = userId;
    this.userType = userType;
    this.connection = null;
    this.channel = null;
  }
  
  async connect() {
    this.connection = await amqp.connect(RABBITMQ_URL);
    this.channel = await this.connection.createChannel();
    
    await this.channel.assertExchange(UPDATES_EXCHANGE, 'topic', { durable: true });
    
    console.log('✅ Connected to Chat3 RabbitMQ');
  }
  
  async subscribe() {
    const queueName = `user_${this.userId}_updates`;
    
    await this.channel.assertQueue(queueName, {
      durable: true,
      arguments: { 'x-message-ttl': 3600000 }
    });
    
    // Подписываемся на все updates для пользователя
    // Формат routing key: update.{category}.{userType}.{userId}.{updateType}
    const routingKey = `update.*.${this.userType}.${this.userId}.*`;
    await this.channel.bindQueue(queueName, UPDATES_EXCHANGE, routingKey);
    
    await this.channel.consume(queueName, async (msg) => {
      if (!msg) return;
      
      try {
        const update = JSON.parse(msg.content.toString());
        await this.handleUpdate(update);
        this.channel.ack(msg);
      } catch (error) {
        console.error('Error processing update:', error);
        this.channel.nack(msg, false, false);
      }
    });
    
    console.log(`👂 Listening for updates: ${routingKey}`);
  }
  
  async handleUpdate(update) {
    const { eventType, data } = update;
    
    console.log(`📩 ${eventType} for user ${this.userId}`);
    
    // Ваша логика обработки
    switch (eventType) {
      // Dialog Updates
      case 'dialog.create':
      case 'dialog.update':
      case 'dialog.delete':
      case 'dialog.member.add':
      case 'dialog.member.remove':
        await this.handleDialogUpdate(update);
        break;
        
      // Dialog Member Updates
      case 'dialog.member.update':
        await this.handleDialogMemberUpdate(update);
        break;
        
      // Message Updates
      case 'message.create':
      case 'message.update':
      case 'message.status.update':
      case 'message.reaction.update':
        await this.handleMessageUpdate(update);
        break;
        
      // Typing Updates
      case 'dialog.typing':
        await this.handleTypingUpdate(update);
        break;
        
      // User Updates
      case 'user.add':
      case 'user.update':
      case 'user.remove':
        await this.handleUserUpdate(update);
        break;
        
      // User Stats Updates
      case 'user.stats.update':
        await this.handleUserStatsUpdate(update);
        break;
        
      // User Pack Stats Updates
      case 'user.pack.stats.updated':
        await this.handleUserPackStatsUpdate(update);
        break;
    }
  }
  
  async handleDialogUpdate(update) {
    // Ваша реализация
    console.log('Dialog update:', update.data.dialog);
  }
  
  async handleDialogMemberUpdate(update) {
    // Ваша реализация
    console.log('Dialog member update:', update.data.member);
  }
  
  async handleMessageUpdate(update) {
    // Ваша реализация
    const { dialog, message } = update.data;
    
    // dialog.stats.unreadCount содержит актуальное количество непрочитанных сообщений
    const unreadCount = dialog.stats?.unreadCount || 0;
    
    // message.topicId и message.topic содержат информацию о топике (если есть)
    if (message.topicId) {
      console.log('Message in topic:', message.topicId, message.topic);
    }
    
    console.log('Message update:', message);
    console.log('Dialog unread count:', unreadCount);
  }
  
  async handleTypingUpdate(update) {
    // Ваша реализация
    console.log('Typing update:', update.data.typing);
  }
  
  async handleUserUpdate(update) {
    // Ваша реализация
    console.log('User update:', update.data.user);
  }
  
  async handleUserStatsUpdate(update) {
    // Ваша реализация
    console.log('User stats update:', update.data.user.stats);
  }
  
  async handleUserPackStatsUpdate(update) {
    // user.pack.stats.updated — replace snapshot unread по паку для этого пользователя
    const { userPackStats } = update.data;
    console.log('User pack stats update:', userPackStats?.packId, 'unreadCount:', userPackStats?.unreadCount);
  }
  
  async disconnect() {
    if (this.channel) await this.channel.close();
    if (this.connection) await this.connection.close();
    console.log('✅ Disconnected from Chat3');
  }
}

// Использование
async function main() {
  const integration = new Chat3Integration('carl', 'user');
  
  await integration.connect();
  await integration.subscribe();
  
  // Обработка сигналов для graceful shutdown
  process.on('SIGINT', async () => {
    await integration.disconnect();
    process.exit(0);
  });
}

main().catch(console.error);
```

## Обработка ошибок и переподключение

```javascript
class Chat3Integration {
  // ... предыдущий код ...
  
  async connect() {
    try {
      this.connection = await amqp.connect(RABBITMQ_URL);
      this.channel = await this.connection.createChannel();
      
      // Обработка ошибок соединения
      this.connection.on('error', (err) => {
        console.error('Connection error:', err);
        this.reconnect();
      });
      
      this.connection.on('close', () => {
        console.warn('Connection closed, reconnecting...');
        this.reconnect();
      });
      
      await this.channel.assertExchange(UPDATES_EXCHANGE, 'topic', { durable: true });
      console.log('✅ Connected to Chat3 RabbitMQ');
    } catch (error) {
      console.error('Failed to connect:', error);
      this.reconnect();
    }
  }
  
  async reconnect() {
    await new Promise(resolve => setTimeout(resolve, 5000)); // Ждем 5 секунд
    try {
      await this.connect();
      await this.subscribe();
    } catch (error) {
      console.error('Reconnection failed:', error);
      this.reconnect(); // Повторная попытка
    }
  }
}
```

## Тестирование интеграции

### 1. Создать тестового пользователя

```bash
curl -X POST http://localhost:3000/api/users \
  -H "X-API-Key: your-key" \
  -H "X-Tenant-ID: tnt_default" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test_user",
    "name": "Test User",
    "type": "user"
  }'
```

### 2. Создать диалог

```bash
curl -X POST http://localhost:3000/api/dialogs \
  -H "X-API-Key: your-key" \
  -H "X-Tenant-ID: tnt_default" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Dialog",
    "createdBy": "test_user",
    "members": [
      {"userId": "test_user", "type": "user"}
    ]
  }'
```

### 3. Добавить сообщение

```bash
curl -X POST http://localhost:3000/api/dialogs/{dialogId}/messages \
  -H "X-API-Key: your-key" \
  -H "X-Tenant-ID: tnt_default" \
  -H "Content-Type: application/json" \
  -d '{
    "senderId": "test_user",
    "content": "Hello!",
    "type": "internal.text"
  }'
```

**Примечание:** Замените `{dialogId}` на реальный ID диалога, полученный из ответа на шаге 2.

### 4. Проверить получение Updates

Ваш consumer должен получить Update для `test_user` с типом `message.create`.

## Best Practices

1. **Обработка дубликатов**
   - Используйте `eventId` из Update для дедупликации
   - Храните последний обработанный `eventId`

2. **Обработка порядка**
   - Updates могут приходить не по порядку
   - Используйте `createdAt` для сортировки
   - Применяйте updates в правильном порядке

3. **Обработка ошибок**
   - Всегда подтверждайте сообщения (`ack`) после успешной обработки
   - Используйте `nack` с `requeue: false` для критических ошибок
   - Логируйте все ошибки

4. **Производительность**
   - Обрабатывайте updates асинхронно
   - Используйте батчинг для массовых операций
   - Кэшируйте часто используемые данные

5. **Мониторинг**
   - Отслеживайте количество необработанных сообщений
   - Мониторьте задержки обработки
   - Логируйте важные события

## Примеры routing keys

Формат routing key: `update.{category}.{userType}.{userId}.{updateType}`

Где:
- `category` - категория обновления: `dialog` (DialogUpdate, DialogMemberUpdate, MessageUpdate, TypingUpdate) или `user` (UserUpdate, UserStatsUpdate)
- `userType` - тип пользователя из модели User (user, bot, contact и т.д.)
- `userId` - ID пользователя
- `updateType` - тип обновления в нижнем регистре (dialogupdate, dialogmemberupdate, messageupdate, typingupdate, userupdate, userstatsupdate)

**Примеры routing keys:**

```
# Все обновления для пользователя carl типа user
update.*.user.carl.*

# Все обновления диалогов для пользователя carl
update.dialog.user.carl.*

# Все обновления сообщений для пользователя carl
update.dialog.user.carl.messageupdate

# Все обновления для всех пользователей типа bot
update.*.bot.*.*

# Все обновления диалогов для всех пользователей типа user
update.dialog.user.*.dialogupdate

# Все обновления статистики пользователей
update.user.*.*.userstatsupdate
```

**Примеры для подписки (wildcards):**

```javascript
// Все обновления для пользователя carl
await channel.bindQueue(queueName, 'chat3_updates', 'update.*.user.carl.*');

// Только обновления диалогов для пользователя carl
await channel.bindQueue(queueName, 'chat3_updates', 'update.dialog.user.carl.*');

// Все обновления для всех пользователей типа bot
await channel.bindQueue(queueName, 'chat3_updates', 'update.*.bot.*.*');

// Все обновления диалогов для всех пользователей типа user
await channel.bindQueue(queueName, 'chat3_updates', 'update.dialog.user.*.*');
```

## Поддержка

Для вопросов и проблем обращайтесь к документации:
- [ARCHITECTURE.md](ARCHITECTURE.md) - Архитектура системы
- [API.md](API.md) - API документация
- [EVENTS.md](EVENTS.md) - Система событий
- [UPDATES.md](UPDATES.md) - Система обновлений

