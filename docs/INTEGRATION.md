# Интеграция с Chat3

## Обзор

Этот документ описывает процесс интеграции внешних систем с Chat3 через RabbitMQ для получения событий и обновлений в реальном времени.

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
- `userType` - тип пользователя из модели User (user, bot, contact и т.д.)
- `userId` - ID пользователя-получателя
- `updateType` - тип обновления в нижнем регистре:
  - `dialogupdate` - DialogUpdate
  - `dialogmemberupdate` - DialogMemberUpdate
  - `messageupdate` - MessageUpdate
  - `typingupdate` - TypingUpdate
  - `userupdate` - UserUpdate
  - `userstatsupdate` - UserStatsUpdate

**Примеры routing keys:**
- `update.dialog.user.carl.dialogupdate` - обновление диалога для пользователя carl
- `update.dialog.user.carl.messageupdate` - обновление сообщения для пользователя carl
- `update.user.user.carl.userstatsupdate` - обновление статистики для пользователя carl

Для подписки используйте wildcards:
- `update.*.user.carl.*` - все обновления для пользователя carl
- `update.dialog.user.carl.*` - все обновления диалогов для пользователя carl

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

## Обработка различных типов обновлений

### Dialog Updates

Создаются для событий: `dialog.create`, `dialog.update`, `dialog.delete`, `dialog.member.add`, `dialog.member.remove`

```javascript
async function handleDialogUpdate(update) {
  const { eventType, data } = update;
  const { dialog, member, context } = data;
  
  switch (eventType) {
    case 'dialog.create':
      // Новый диалог создан
      await addDialogToLocalState(dialog, member);
      break;
      
    case 'dialog.update':
      // Диалог обновлен
      await updateDialogInLocalState(dialog);
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

### Typing Updates

Создаются для событий: `dialog.typing`

```javascript
async function handleTypingUpdate(update) {
  const { eventType, data } = update;
  const { dialog, typing, context } = data;
  
  // Пользователь печатает в диалоге
  await showTypingIndicator(dialog.dialogId, typing.userId, typing.expiresInMs);
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

**Примечание:** Этот тип update создается автоматически при изменении статистики пользователя (количество диалогов, непрочитанных диалогов).

```javascript
async function handleUserStatsUpdate(update) {
  const { eventType, data } = update;
  const { user, context } = data;
  
  // Обновлена статистика пользователя
  // user.stats.dialogCount - количество диалогов
  // user.stats.unreadDialogsCount - количество непрочитанных диалогов
  await updateUserStats(user.userId, user.stats);
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
    console.log('Message update:', update.data.message);
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

