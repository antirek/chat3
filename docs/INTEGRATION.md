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
  const queueName = `user.${userType}.${userId}`;
  
  // Создаем очередь с TTL 1 час
  await channel.assertQueue(queueName, {
    durable: true,
    arguments: {
      'x-message-ttl': 3600000 // 1 час
    }
  });
  
  // Привязываем к exchange с routing key
  const routingKey = `user.${userType}.${userId}.*`;
  await channel.bindQueue(queueName, 'chat3_updates', routingKey);
  
  console.log(`✅ Subscribed to updates for user ${userId} (type: ${userType})`);
  console.log(`   Queue: ${queueName}`);
  console.log(`   Routing key: ${routingKey}`);
  
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

### Message Updates

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
      
    case 'message.delete':
      // Сообщение удалено
      await removeMessageFromDialog(dialog.dialogId, message.messageId);
      break;
      
    case 'message.status.create':
    case 'message.status.update':
      // Статус сообщения изменился
      await updateMessageStatus(dialog.dialogId, message);
      break;
      
    case 'message.reaction.add':
    case 'message.reaction.update':
    case 'message.reaction.remove':
      // Реакция изменилась
      await updateMessageReactions(dialog.dialogId, message);
      break;
  }
}
```

## Подписка на события (опционально)

Если нужны события напрямую (без обработки через Updates):

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
    const queueName = `user.${this.userType}.${this.userId}`;
    
    await this.channel.assertQueue(queueName, {
      durable: true,
      arguments: { 'x-message-ttl': 3600000 }
    });
    
    const routingKey = `user.${this.userType}.${this.userId}.*`;
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
      case 'dialog.create':
      case 'dialog.update':
      case 'dialog.delete':
      case 'dialog.member.add':
      case 'dialog.member.remove':
        await this.handleDialogUpdate(update);
        break;
        
      case 'message.create':
      case 'message.update':
      case 'message.delete':
      case 'message.status.create':
      case 'message.status.update':
      case 'message.reaction.add':
      case 'message.reaction.update':
      case 'message.reaction.remove':
        await this.handleMessageUpdate(update);
        break;
    }
  }
  
  async handleDialogUpdate(update) {
    // Ваша реализация
    console.log('Dialog update:', update.data.dialog);
  }
  
  async handleMessageUpdate(update) {
    // Ваша реализация
    console.log('Message update:', update.data.message);
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

```
# Все обновления для пользователя carl типа user
user.user.carl.*

# Все обновления диалогов для пользователя carl
user.user.carl.dialog

# Все обновления сообщений для пользователя carl
user.user.carl.message

# Все обновления для всех пользователей типа bot
user.bot.*.*

# Все обновления диалогов для всех пользователей типа user
user.user.*.dialog
```

## Поддержка

Для вопросов и проблем обращайтесь к документации:
- [ARCHITECTURE.md](ARCHITECTURE.md) - Архитектура системы
- [API.md](API.md) - API документация
- [EVENTS.md](EVENTS.md) - Система событий
- [UPDATES.md](UPDATES.md) - Система обновлений

