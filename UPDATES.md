# 📤 Система Updates (Обновления)

## Обзор

Система Updates формирует потоки обновлений для участников диалогов на основе событий (Events). Каждый участник диалога получает персональные обновления о состоянии диалогов и сообщений через отдельные очереди RabbitMQ.

## Архитектура

### Два типа Updates:

1. **DialogUpdate** - обновления состояния диалога
2. **MessageUpdate** - обновления состояния сообщения

### Принцип работы:

- Updates генерируются **асинхронно** после создания событий
- Каждый участник диалога получает свой набор updates
- Updates публикуются в RabbitMQ в персональные очереди пользователей
- Updates сохраняются в MongoDB для истории и аудита

## Модель данных Update

```javascript
{
  _id: ObjectId,
  tenantId: ObjectId,           // Tenant к которому относится update
  userId: String,               // ID пользователя-получателя update
  dialogId: ObjectId,          // ID диалога
  entityId: ObjectId,          // ID сущности (Dialog или Message)
  eventId: ObjectId,           // ID исходного события
  eventType: String,           // Тип исходного события (определяет тип Update)
  data: Object,                // Полные данные объекта для пользователя
  published: Boolean,          // Отправлен ли в RabbitMQ
  publishedAt: Date,           // Время публикации
  createdAt: Date,             // Время создания
  updatedAt: Date             // Время обновления
}
```

**Примечание**: Тип Update (DialogUpdate или MessageUpdate) определяется из поля `eventType`:
- События `dialog.*` → DialogUpdate
- События `message.*` → MessageUpdate

## Генерация Updates

### DialogUpdate

Генерируется для событий:
- `dialog.create` - создание диалога
- `dialog.update` - обновление диалога
- `dialog.delete` - удаление диалога
- `dialog.member.add` - добавление участника
- `dialog.member.remove` - удаление участника

**Структура data:**
```json
{
  "_id": "6904cad5da30b5d60761e0fd",
  "tenantId": "6904cad5da30b5d60761e0bb",
  "name": "Общий чат",
  "createdBy": "system_bot",
  "createdAt": "2025-10-31T12:00:00.000Z",
  "updatedAt": "2025-10-31T12:00:00.000Z",
  "meta": {
    "type": "internal",
    "channelType": "whatsapp",
    "welcomeMessage": "Добро пожаловать!",
    "maxParticipants": 50,
    "features": ["file_sharing", "voice_calls"],
    "securityLevel": "high"
  },
  "dialogMemberMeta": {
    "role": "admin",
    "permissions": ["send", "delete"],
    "notificationSettings": {
      "sound": true,
      "vibrate": false
    }
  }
}
```

**Примечание**: Поле `dialogMemberMeta` содержит мета теги конкретного участника диалога (DialogMember) и уникально для каждого участника в каждом DialogUpdate.

### MessageUpdate

Генерируется для событий:
- `message.create` - создание сообщения
- `message.update` - обновление сообщения
- `message.delete` - удаление сообщения
- `message.reaction.add` - добавление реакции
- `message.reaction.update` - обновление реакции
- `message.reaction.remove` - удаление реакции
- `message.status.create` - создание статуса
- `message.status.update` - обновление статуса

**Структура data:**
```json
{
  "_id": "6904cad5da30b5d60761e0fd",
  "tenantId": "6904cad5da30b5d60761e0bb",
  "dialogId": "6904cad5da30b5d60761e0fc",
  "senderId": "carl",
  "content": "Текст сообщения (до 4096 символов)",
  "type": "text",
  "reactionCounts": {
    "👍": 5,
    "❤️": 3
  },
  "createdAt": "2025-10-31T12:00:00.000Z",
  "updatedAt": "2025-10-31T12:00:00.000Z",
  "meta": {
    "channelType": "whatsapp",
    "channelId": "W0000"
  }
}
```

## RabbitMQ Integration

### Exchange

- **Имя**: `chat3_updates`
- **Тип**: `topic`
- **Durable**: `true`

### Очереди

Для каждого пользователя создается очередь:
- **Имя**: `user_{userId}_updates`
- **TTL**: 1 час (3600000 мс)
- **Durable**: `true`
- **Binding**: `user.{userId}.*` → `chat3_updates`

### Routing Keys

- `user.{userId}.dialogupdate` - для DialogUpdate
- `user.{userId}.messageupdate` - для MessageUpdate

Примеры:
- `user.carl.dialogupdate`
- `user.marta.messageupdate`

### Автоматическое создание очередей

Очереди создаются автоматически при первой публикации update для пользователя через функцию `ensureUserUpdatesQueue()`.

## Подписчики

### Кто получает Updates:

- **Все участники диалога** (`DialogMember` с `isActive: true`)
- Updates генерируются для каждого участника отдельно
- Каждый участник получает updates только для диалогов, где он является участником

### Пример подписчика (Node.js)

```javascript
const amqp = require('amqplib');

async function subscribeToUserUpdates(userId) {
  const connection = await amqp.connect('amqp://rmuser:rmpassword@localhost:5672');
  const channel = await connection.createChannel();
  
  const queueName = `user_${userId}_updates`;
  
  // Очередь уже создана сервером, просто декларируем
  await channel.assertQueue(queueName, {
    durable: true,
    arguments: { 'x-message-ttl': 3600000 }
  });
  
  console.log(`👂 Listening for updates on queue: ${queueName}`);
  
  channel.consume(queueName, (msg) => {
    if (msg) {
      const update = JSON.parse(msg.content.toString());
      
      // Определяем тип update из eventType
      const isDialogUpdate = update.eventType.startsWith('dialog.');
      const isMessageUpdate = update.eventType.startsWith('message.');
      
      console.log(`📥 Received ${update.eventType}:`, update.data);
      
      // Обработка update
      if (isDialogUpdate) {
        handleDialogUpdate(update.data);
      } else if (isMessageUpdate) {
        handleMessageUpdate(update.data);
      }
      
      channel.ack(msg);
    }
  });
}

function handleDialogUpdate(dialogData) {
  console.log('Dialog updated:', dialogData.name);
  // Обновить UI диалога
}

function handleMessageUpdate(messageData) {
  console.log('Message updated:', messageData.content);
  // Обновить UI сообщения
}

// Подписка для пользователя carl
subscribeToUserUpdates('carl');
```

### Пример подписчика (Python)

```python
import pika
import json

def callback(ch, method, properties, body):
    update = json.loads(body)
    event_type = update['eventType']
    
    # Определяем тип update из eventType
    is_dialog_update = event_type.startswith('dialog.')
    is_message_update = event_type.startswith('message.')
    
    print(f"Received {event_type}: {update['data']}")
    
    if is_dialog_update:
        handle_dialog_update(update['data'])
    elif is_message_update:
        handle_message_update(update['data'])
    
    ch.basic_ack(delivery_tag=method.delivery_tag)

def handle_dialog_update(dialog_data):
    print(f"Dialog updated: {dialog_data['name']}")

def handle_message_update(message_data):
    print(f"Message updated: {message_data['content']}")

# Подключение
credentials = pika.PlainCredentials('rmuser', 'rmpassword')
connection = pika.BlockingConnection(
    pika.ConnectionParameters(
        host='localhost',
        credentials=credentials
    )
)
channel = connection.channel()

# Подписка для пользователя carl
user_id = 'carl'
queue_name = f'user_{user_id}_updates'

channel.queue_declare(
    queue=queue_name,
    durable=True,
    arguments={'x-message-ttl': 3600000}
)

print(f'Waiting for updates on queue: {queue_name}')
channel.basic_consume(
    queue=queue_name,
    on_message_callback=callback
)

channel.start_consuming()
```

## Структура сообщения в RabbitMQ

### Headers

```javascript
{
  userId: 'carl',
  dialogId: '6904cad5da30b5d60761e0fd',
  entityId: '6904cad5da30b5d60761e0fc',
  eventType: 'dialog.create',  // Определяет тип Update (dialog.* → DialogUpdate, message.* → MessageUpdate)
  contentType: 'application/json',
  timestamp: 1698765432000
}
```

### Body (JSON)

```json
{
  "_id": "6904cad5da30b5d60761e100",
  "tenantId": "6904cad5da30b5d60761e0bb",
  "userId": "carl",
  "dialogId": "6904cad5da30b5d60761e0fd",
  "entityId": "6904cad5da30b5d60761e0fc",
  "eventId": "6904cad5da30b5d60761e0ff",
  "eventType": "message.create",
  "data": {
    "_id": "6904cad5da30b5d60761e0fc",
    "tenantId": "6904cad5da30b5d60761e0bb",
    "dialogId": "6904cad5da30b5d60761e0fd",
    "senderId": "marta",
    "content": "Привет!",
    "type": "text",
    "reactionCounts": {},
    "createdAt": "2025-10-31T12:00:00.000Z",
    "updatedAt": "2025-10-31T12:00:00.000Z",
    "meta": {
      "channelType": "whatsapp",
      "channelId": "W0000"
    }
  },
  "published": true,
  "publishedAt": "2025-10-31T12:00:01.000Z",
  "createdAt": "2025-10-31T12:00:00.000Z"
}
```

## Особенности

### Асинхронная генерация

- Updates генерируются **параллельно** с событиями
- Не блокируют основной поток выполнения
- Если генерация update не удалась, событие все равно сохраняется

### Персональные очереди

- Каждый пользователь имеет свою очередь `user_{userId}_updates`
- Очереди создаются автоматически при первой публикации
- TTL 1 час для предотвращения накопления старых updates

### Полные данные

- Update содержит **полное текущее состояние** объекта
- DialogUpdate включает все метаданные диалога
- MessageUpdate включает контент (до 4096 символов), реакции, метаданные

### Фильтрация

- Updates генерируются только для **активных участников** диалога (`isActive: true`)
- Участники получают updates только для диалогов, где они являются участниками

## Отказоустойчивость

- Если RabbitMQ недоступен, updates сохраняются в MongoDB
- Можно вручную переопубликовать неопубликованные updates
- Статус `published` отслеживает успешность публикации

## Использование

### Просмотр Updates в AdminJS

- Откройте AdminJS: http://localhost:3000/admin
- Перейдите в раздел "Система" → "Update"
- Просмотрите все updates, отфильтруйте по пользователю, типу, диалогу

### Просмотр Updates в MongoDB

```javascript
// Все updates для пользователя carl
db.updates.find({ userId: "carl" }).sort({ createdAt: -1 })

// Неопубликованные updates
db.updates.find({ published: false })

// Updates для конкретного диалога
db.updates.find({ dialogId: ObjectId("6904cad5da30b5d60761e0fd") })
```

## Конфигурация

### Переменные окружения

```bash
# RabbitMQ настройки (для updates используется тот же RabbitMQ)
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USER=rmuser
RABBITMQ_PASSWORD=rmpassword
RABBITMQ_VHOST=/
```

### Exchange и очереди

- Exchange `chat3_updates` создается автоматически при запуске сервера
- Очереди `user_{userId}_updates` создаются автоматически при первой публикации

## Примеры использования

### Реальное время обновлений UI

Клиентское приложение подписывается на очередь пользователя и обновляет UI в реальном времени:

```javascript
// Подписка на updates для текущего пользователя
subscribeToUserUpdates(currentUserId);

function handleDialogUpdate(dialog) {
  // Обновить список диалогов
  updateDialogList(dialog);
}

function handleMessageUpdate(message) {
  // Обновить сообщение в чате
  updateMessageInChat(message);
  
  // Обновить счетчики реакций
  updateReactionCounts(message.reactionCounts);
}
```

### Синхронизация между устройствами

Когда пользователь открывает приложение на другом устройстве, он получает все updates через свою очередь и синхронизирует состояние.

### Аналитика и мониторинг

Можно отслеживать:
- Сколько updates создано для каждого пользователя
- Какие updates не были опубликованы
- Время доставки updates

## Связь с событиями

Updates являются производными от событий, но работают параллельно:

```
Event (событие) → [Параллельно] → Update (обновление)
     ↓                                    ↓
  MongoDB                              MongoDB + RabbitMQ
  (аудит)                              (доставка пользователям)
```

Каждое событие может породить несколько updates (по одному для каждого участника диалога).




