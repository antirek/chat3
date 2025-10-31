# 📊 Система событий Chat3

## Обзор

Система событий (Events) позволяет отслеживать все действия в Chat3 для:
- **Аудита** - кто, что и когда изменил
- **Аналитики** - статистика по действиям пользователей
- **Отладки** - восстановление последовательности действий
- **Триггеров** - будущая интеграция с внешними системами

## Модель данных

```javascript
{
  _id: ObjectId,
  tenantId: ObjectId,           // Tenant к которому относится событие
  eventType: String,            // Тип события (см. ниже)
  entityType: String,           // Тип сущности (dialog, message, etc.)
  entityId: ObjectId,           // ID сущности
  actorId: String,              // ID пользователя/системы инициатора
  actorType: String,            // Тип актора: user, system, bot, api
  data: Object,                 // Дополнительные данные события
  metadata: {                   // Метаданные запроса
    ipAddress: String,
    userAgent: String,
    apiKeyId: ObjectId,
    source: String
  },
  createdAt: Date              // Время создания события
}
```

## Типы событий

Все события системы сведены в единую таблицу:

| Категория | Тип события | Описание | API Endpoint | Entity Type |
|-----------|-------------|----------|--------------|-------------|
| **Диалоги** | `dialog.create` | Создан новый диалог | `POST /api/dialogs` | `dialog` |
| | `dialog.update` | Обновлен диалог | `PUT /api/dialogs/:id` | `dialog` |
| | `dialog.delete` | Удален диалог | `DELETE /api/dialogs/:id` | `dialog` |
| **Сообщения** | `message.create` | Создано новое сообщение | `POST /api/dialogs/:id/messages` | `message` |
| | `message.update` | Обновлено сообщение | `PUT /api/messages/:id` | `message` |
| | `message.delete` | Удалено сообщение | `DELETE /api/messages/:id` | `message` |
| **Участники** | `dialog.member.add` | Добавлен участник | `POST /api/dialogs/:id/members/:userId` | `dialogMember` |
| | `dialog.member.remove` | Удален участник | `DELETE /api/dialogs/:id/members/:userId` | `dialogMember` |
| | `dialog.member.update` | Обновлен участник | `PUT /api/dialogs/:id/members/:userId` | `dialogMember` |
| **Статусы** | `message.status.create` | Создан статус сообщения | `PUT /api/messages/:id/status` (новый) | `messageStatus` |
| | `message.status.update` | Обновлен статус сообщения | `PUT /api/messages/:id/status` (существующий) | `messageStatus` |
| **Реакции** | `message.reaction.add` | Добавлена реакция на сообщение | `POST /api/messages/:id/reactions` | `messageReaction` |
| | `message.reaction.update` | Обновлена реакция на сообщение | `POST /api/messages/:id/reactions` (существующая) | `messageReaction` |
| | `message.reaction.remove` | Удалена реакция на сообщение | `DELETE /api/messages/:id/reactions/:reaction` | `messageReaction` |
| **Tenant** | `tenant.create` | Создан tenant | `POST /api/tenants` | `tenant` |
| | `tenant.update` | Обновлен tenant | `PUT /api/tenants/:id` | `tenant` |
| | `tenant.delete` | Удален tenant | `DELETE /api/tenants/:id` | `tenant` |

### Примеры данных событий

#### `dialog.create`
```json
{
  "dialogName": "Общий чат",
  "createdBy": "carl"
}
```

#### `dialog.delete`
```json
{
  "dialogName": "Старый чат",
  "deletedDialog": {
    "name": "Старый чат",
    "createdBy": "carl",
    "createdAt": "2025-10-31T12:00:00.000Z"
  }
}
```

#### `message.create`
```json
{
  "dialogId": "6541a1b2c3d4e5f6g7h8i9j0",
  "dialogName": "Общий чат",
  "messageType": "text",
  "content": "Текст сообщения (до 4096 символов)",
  "meta": {
    "channelType": "whatsapp",
    "channelId": "123456789",
    "mediaUrl": "https://example.com/media.jpg"
  }
}
```

**Примечание:** 
- Поле `content` содержит текст сообщения (ограничено до 4096 символов)
- Поле `meta` содержит все мета-теги сообщения (если они были установлены при создании)
- Если сообщение длиннее 4096 символов, оно автоматически обрезается, используйте `entityId` для получения полного контента из API

#### `dialog.member.add`
```json
{
  "userId": "carl",
  "dialogId": "6541a1b2c3d4e5f6g7h8i9j0"
}
```

#### `dialog.member.remove`
```json
{
  "userId": "marta",
  "dialogId": "6541a1b2c3d4e5f6g7h8i9j0",
  "removedMember": {
    "userId": "marta",
    "joinedAt": "2025-10-25T10:00:00.000Z",
    "lastSeenAt": "2025-10-30T15:30:00.000Z",
    "unreadCount": 5
  }
}
```

#### `message.status.update`
```json
{
  "messageId": "6541a1b2c3d4e5f6g7h8i9j0",
  "userId": "carl",
  "oldStatus": "unread",
  "newStatus": "read",
  "dialogId": "6541a1b2c3d4e5f6g7h8i9j0"
}
```

#### `message.reaction.add`
```json
{
  "messageId": "6541a1b2c3d4e5f6g7h8i9j0",
  "reaction": "👍",
  "reactionCounts": {
    "👍": 5,
    "❤️": 3
  }
}
```

#### `message.reaction.update`
```json
{
  "messageId": "6541a1b2c3d4e5f6g7h8i9j0",
  "reaction": "❤️",
  "oldReaction": "👍",
  "reactionCounts": {
    "👍": 4,
    "❤️": 4
  }
}
```

#### `message.reaction.remove`
```json
{
  "messageId": "6541a1b2c3d4e5f6g7h8i9j0",
  "reaction": "👍",
  "reactionCounts": {
    "👍": 4,
    "❤️": 3
  }
}
```

## API Endpoints

### Получить все события

```bash
GET /api/events
```

**Query параметры:**
- `page` - номер страницы (по умолчанию: 1)
- `limit` - событий на странице (по умолчанию: 50)
- `eventType` - фильтр по типу события
- `entityType` - фильтр по типу сущности
- `entityId` - фильтр по ID сущности
- `actorId` - фильтр по ID актора
- `actorType` - фильтр по типу актора
- `startDate` - начальная дата (ISO 8601)
- `endDate` - конечная дата (ISO 8601)
- `sort` - сортировка в формате `(field,direction)`

**Примеры:**

```bash
# Все события
GET /api/events

# События создания диалогов
GET /api/events?eventType=dialog.create

# События пользователя carl
GET /api/events?actorId=carl

# События за последнюю неделю
GET /api/events?startDate=2025-10-24T00:00:00Z&endDate=2025-10-31T23:59:59Z

# События по типу сущности
GET /api/events?entityType=message

# С сортировкой по возрастанию
GET /api/events?sort=(createdAt,asc)
```

### Получить событие по ID

```bash
GET /api/events/:id
```

### Получить события для конкретной сущности

```bash
GET /api/events/entity/:entityType/:entityId
```

**Пример:**
```bash
# Все события диалога
GET /api/events/entity/dialog/6541a1b2c3d4e5f6g7h8i9j0

# Все события сообщения
GET /api/events/entity/message/6541a1b2c3d4e5f6g7h8i9j0
```

### Получить события по типу

```bash
GET /api/events/type/:eventType
```

**Примеры:**
```bash
# Все создания диалогов
GET /api/events/type/dialog.create

# Все обновления статусов
GET /api/events/type/message.status.update
```

### Получить события пользователя (актора)

```bash
GET /api/events/actor/:actorId
```

**Примеры:**
```bash
# Все действия пользователя carl
GET /api/events/actor/carl

# Все действия с фильтром по типу
GET /api/events/actor/carl?eventType=message.create
```

### Получить статистику по событиям

```bash
GET /api/events/stats
```

**Query параметры:**
- `startDate` - начальная дата
- `endDate` - конечная дата

**Пример ответа:**
```json
{
  "data": [
    {
      "eventType": "message.create",
      "count": 156,
      "lastEvent": "2025-10-31T15:30:00.000Z"
    },
    {
      "eventType": "dialog.create",
      "count": 45,
      "lastEvent": "2025-10-31T14:20:00.000Z"
    },
    {
      "eventType": "message.status.update",
      "count": 892,
      "lastEvent": "2025-10-31T15:45:00.000Z"
    }
  ]
}
```

### Удалить старые события

```bash
DELETE /api/events/cleanup
```

**Request body:**
```json
{
  "beforeDate": "2025-10-01T00:00:00Z"
}
```

**Требуется право:** `delete`

## Примеры использования

### JavaScript (fetch)

```javascript
const apiKey = 'your_api_key';

// Получить последние события
fetch('http://localhost:3000/api/events?limit=10', {
  headers: { 'X-API-Key': apiKey }
})
  .then(res => res.json())
  .then(data => console.log(data));

// Получить события создания сообщений
fetch('http://localhost:3000/api/events?eventType=message.create', {
  headers: { 'X-API-Key': apiKey }
})
  .then(res => res.json())
  .then(data => console.log(data));

// Получить статистику
fetch('http://localhost:3000/api/events/stats', {
  headers: { 'X-API-Key': apiKey }
})
  .then(res => res.json())
  .then(data => console.log(data));
```

### cURL

```bash
# Получить события диалога
curl -H "X-API-Key: your_api_key" \
  "http://localhost:3000/api/events/entity/dialog/6541a1b2c3d4e5f6g7h8i9j0"

# Получить статистику за последний месяц
curl -H "X-API-Key: your_api_key" \
  "http://localhost:3000/api/events/stats?startDate=2025-10-01&endDate=2025-10-31"

# Удалить старые события
curl -X DELETE \
  -H "X-API-Key: your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"beforeDate":"2025-09-01T00:00:00Z"}' \
  "http://localhost:3000/api/events/cleanup"
```

## Индексы MongoDB

Для оптимизации запросов созданы следующие индексы:

- `tenantId` - основной индекс
- `eventType` - для фильтрации по типу
- `entityType` - для фильтрации по типу сущности
- `entityId` - для фильтрации по ID сущности
- `createdAt` - для сортировки по времени
- `tenantId + eventType + createdAt` - составной индекс
- `tenantId + entityType + entityId + createdAt` - составной индекс
- `tenantId + actorId + createdAt` - составной индекс

## Лучшие практики

### 1. Регулярная очистка

Рекомендуется периодически удалять старые события для экономии места:

```javascript
// Удалять события старше 90 дней
const ninetyDaysAgo = new Date();
ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

await fetch('http://localhost:3000/api/events/cleanup', {
  method: 'DELETE',
  headers: {
    'X-API-Key': apiKey,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    beforeDate: ninetyDaysAgo.toISOString()
  })
});
```

### 2. Использование статистики

Используйте статистику для анализа активности:

```javascript
// Получить статистику за сегодня
const today = new Date();
today.setHours(0, 0, 0, 0);

const stats = await fetch(
  `http://localhost:3000/api/events/stats?startDate=${today.toISOString()}`,
  { headers: { 'X-API-Key': apiKey } }
).then(res => res.json());

console.log('Активность сегодня:', stats.data);
```

### 3. Аудит действий пользователя

Отслеживайте действия конкретного пользователя:

```javascript
// Все действия пользователя за последний час
const oneHourAgo = new Date();
oneHourAgo.setHours(oneHourAgo.getHours() - 1);

const userEvents = await fetch(
  `http://localhost:3000/api/events/actor/carl?startDate=${oneHourAgo.toISOString()}`,
  { headers: { 'X-API-Key': apiKey } }
).then(res => res.json());
```

### 4. История сущности

Просмотр всех изменений конкретной сущности:

```javascript
// История диалога
const dialogHistory = await fetch(
  'http://localhost:3000/api/events/entity/dialog/6541a1b2c3d4e5f6g7h8i9j0',
  { headers: { 'X-API-Key': apiKey } }
).then(res => res.json());

console.log('История диалога:', dialogHistory.data);
```

## Типы акторов

- **user** - обычный пользователь
- **system** - системное действие
- **bot** - действие бота
- **api** - действие через API (без явного пользователя)

## Безопасность

- Все запросы требуют API ключ с правом `read`
- Удаление событий требует право `delete`
- События изолированы по tenant'ам
- Метаданные включают IP адрес и User-Agent для аудита

## 🐰 Интеграция с RabbitMQ

### Обзор

Все события автоматически публикуются в RabbitMQ для:
- **Реального времени** - мгновенная обработка событий
- **Масштабируемости** - распределенная обработка
- **Интеграций** - подключение внешних систем
- **Аналитики** - потоковая обработка данных

### Конфигурация

Используйте скрипт `start.sh` для запуска с предустановленными переменными окружения:

```bash
./start.sh
```

Или установите переменные окружения вручную:

```bash
export RABBITMQ_HOST=localhost
export RABBITMQ_PORT=5672
export RABBITMQ_USER=rmuser
export RABBITMQ_PASSWORD=rmpassword
export RABBITMQ_VHOST=/
export RABBITMQ_EXCHANGE=chat3_events
npm start
```

**Переменные окружения:**
- `RABBITMQ_HOST` - хост RabbitMQ (по умолчанию: localhost)
- `RABBITMQ_PORT` - порт RabbitMQ (по умолчанию: 5672)
- `RABBITMQ_USER` - пользователь RabbitMQ (по умолчанию: rmuser)
- `RABBITMQ_PASSWORD` - пароль RabbitMQ (по умолчанию: rmpassword)
- `RABBITMQ_VHOST` - vhost RabbitMQ (по умолчанию: /)
- `RABBITMQ_EXCHANGE` - exchange для событий (по умолчанию: chat3_events)
- `RABBITMQ_URL` - полный URL (переопределяет все вышеперечисленные, если установлен)

**По умолчанию (без переменных окружения):**
- URL: `amqp://rmuser:rmpassword@localhost:5672/`
- Exchange: `chat3_events`
- Type: `topic` (для гибкой маршрутизации)

### Создание пользователя RabbitMQ

Если используете Docker Compose, создайте пользователя `rmuser`:

```bash
docker-compose up -d rabbitmq
./docker/create-rabbitmq-user.sh
```

### Routing Keys

События публикуются с routing keys в формате:
```
{entityType}.{action}.{tenantId}
```

**Примеры:**
- `dialog.create.6541a1b2c3d4e5f6g7h8i9j0` - создание диалога
- `message.create.6541a1b2c3d4e5f6g7h8i9j0` - создание сообщения
- `dialogMember.add.6541a1b2c3d4e5f6g7h8i9j0` - добавление участника
- `messageStatus.update.6541a1b2c3d4e5f6g7h8i9j0` - обновление статуса

### Автоматическая очередь chat3_events

При запуске сервера автоматически создается очередь `chat3_events` со следующими параметрами:

- **Имя**: `chat3_events`
- **TTL**: 1 час (3600 секунд / 3600000 мс)
- **Durable**: Да (переживет перезапуск RabbitMQ)
- **Routing**: Все события (`#`) автоматически попадают в эту очередь

**Особенности:**
- Сообщения автоматически удаляются через 1 час после попадания в очередь
- Очередь предотвращает накопление старых событий
- Все события системы автоматически маршрутизируются в эту очередь
- Очередь создается при первом подключении к RabbitMQ

**Использование:**
Можно подписаться на эту очередь для обработки всех событий в реальном времени:

```javascript
import amqp from 'amqplib';

const connection = await amqp.connect('amqp://rmuser:rmpassword@localhost:5672');
const channel = await connection.createChannel();

// Используем очередь chat3_events (уже создана сервером)
await channel.assertQueue('chat3_events', {
  durable: true,
  arguments: { 'x-message-ttl': 3600000 }
});

channel.consume('chat3_events', (msg) => {
  if (msg) {
    const event = JSON.parse(msg.content.toString());
    console.log('Event:', event.eventType);
    channel.ack(msg);
  }
});
```

### Паттерны подписки (для дополнительных очередей)

Если вы создаете дополнительные очереди, используйте wildcard паттерны для подписки на группы событий:

```javascript
// Все события диалогов
'dialog.*.*'

// Все события создания
'*.create.*'

// Все события конкретного tenant
'*.*.6541a1b2c3d4e5f6g7h8i9j0'

// Все события
'#'

// Создание и удаление диалогов
'dialog.create.*'
'dialog.delete.*'
```

### Пример подписчика (Node.js)

```javascript
import amqp from 'amqplib';

async function subscribeToEvents() {
  const connection = await amqp.connect('amqp://rmuser:rmpassword@localhost:5672');
  const channel = await connection.createChannel();
  
  const exchange = 'chat3_events';
  const queueName = 'chat3_events'; // Очередь по умолчанию (создана сервером)
  
  await channel.assertExchange(exchange, 'topic', { durable: true });
  
  // Используем очередь chat3_events (создана сервером с TTL 1 час)
  await channel.assertQueue(queueName, {
    durable: true,
    arguments: { 'x-message-ttl': 3600000 } // TTL 1 час
  });
  
  // Очередь уже привязана к exchange с routing key '#' на сервере
  // Все события автоматически попадают в эту очередь
  
  console.log('Waiting for events from queue:', queueName);
  
  channel.consume(queueName, (msg) => {
    if (msg) {
      const event = JSON.parse(msg.content.toString());
      console.log('Received event:', event);
      
      // Обработка события
      processEvent(event);
      
      // Подтверждаем обработку
      channel.ack(msg);
    }
  });
}

function processEvent(event) {
  switch (event.eventType) {
    case 'dialog.create':
      console.log('New dialog created:', event.data.dialogName);
      break;
    case 'message.create':
      console.log('New message in dialog:', event.data.dialogId);
      break;
    // ... другие события
  }
}

subscribeToEvents();
```

### Пример подписчика (Python)

```python
import pika
import json

def callback(ch, method, properties, body):
    event = json.loads(body)
    print(f"Received event: {event['eventType']}")
    
    # Обработка события
    process_event(event)
    
    # Подтверждаем обработку
    ch.basic_ack(delivery_tag=method.delivery_tag)

def process_event(event):
    if event['eventType'] == 'message.create':
        print(f"New message: {event['data']['contentLength']} chars")

# Подключение
credentials = pika.PlainCredentials('rmuser', 'rmpassword')
connection = pika.BlockingConnection(
    pika.ConnectionParameters(
        host='localhost',
        credentials=credentials
    )
)
channel = connection.channel()

# Используем очередь chat3_events (создана сервером с TTL 1 час)
queue_name = 'chat3_events'
channel.queue_declare(
    queue=queue_name,
    durable=True,
    arguments={'x-message-ttl': 3600000}  # TTL 1 час
)

# Очередь уже привязана к exchange с routing key '#' на сервере
# Все события автоматически попадают в эту очередь

print('Waiting for events...')
channel.basic_consume(
    queue=queue_name,
    on_message_callback=callback
)

channel.start_consuming()
```

### Структура сообщения

Каждое сообщение в RabbitMQ содержит:

**Headers:**
```javascript
{
  eventType: 'message.create',
  entityType: 'message',
  tenantId: '6541a1b2c3d4e5f6g7h8i9j0',
  contentType: 'application/json',
  timestamp: 1698765432000
}
```

**Body (JSON):**
```json
{
  "_id": "6541a1b2c3d4e5f6g7h8i9j0",
  "tenantId": "6541a1b2c3d4e5f6g7h8i9j0",
  "eventType": "message.create",
  "entityType": "message",
  "entityId": "6541a1b2c3d4e5f6g7h8i9j1",
  "actorId": "carl",
  "actorType": "user",
  "data": {
    "dialogId": "6541a1b2c3d4e5f6g7h8i9j2",
    "dialogName": "Общий чат",
    "messageType": "text",
    "content": "Текст сообщения (до 4096 символов)",
    "meta": {
      "channelType": "whatsapp",
      "channelId": "123456789"
    }
  },
  "metadata": {
    "ipAddress": "192.168.1.100",
    "userAgent": "Mozilla/5.0...",
    "apiKeyId": "6541a1b2c3d4e5f6g7h8i9j3",
    "source": "api"
  },
  "createdAt": "2025-10-31T16:00:00.000Z"
}
```

**Примечание:** Поле `content` в `data` ограничено до 4096 символов. Если сообщение длиннее, оно автоматически обрезается. Для получения полного контента используйте `entityId` и запрос к API.

### Отказоустойчивость

Система спроектирована для работы без RabbitMQ:

1. **События всегда сохраняются в MongoDB** - даже если RabbitMQ недоступен
2. **Автоматическое переподключение** - попытка reconnect каждые 5 секунд
3. **Graceful degradation** - приложение продолжает работать
4. **Логирование** - все ошибки RabbitMQ логируются

### Мониторинг

Проверить статус RabbitMQ:

```bash
curl http://localhost:3000/
```

Ответ:
```json
{
  "message": "Chat3 API is running",
  "rabbitmq": {
    "url": "amqp://localhost:5672",
    "exchange": "chat3_events",
    "exchangeType": "topic",
    "connected": true
  }
}
```

### Docker Compose

Быстрый запуск RabbitMQ с management UI:

```yaml
version: '3.8'
services:
  rabbitmq:
    image: rabbitmq:3-management
    ports:
      - "5672:5672"   # AMQP
      - "15672:15672" # Management UI
    environment:
      RABBITMQ_DEFAULT_USER: admin
      RABBITMQ_DEFAULT_PASS: admin
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq

volumes:
  rabbitmq_data:
```

Запуск:
```bash
docker-compose up -d
```

Management UI: http://localhost:15672 (admin/admin)

### Кейсы использования

#### 1. Уведомления в реальном времени
```javascript
// Подписка на новые сообщения для отправки push-уведомлений
channel.bindQueue(queue, exchange, 'message.create.*');
```

#### 2. Аналитика и отчеты
```javascript
// Подписка на все события для аналитики
channel.bindQueue(queue, exchange, '#');
```

#### 3. Интеграция с внешними системами
```javascript
// Синхронизация с CRM при создании диалогов
channel.bindQueue(queue, exchange, 'dialog.create.*');
```

#### 4. Аудит и безопасность
```javascript
// Мониторинг критичных действий
channel.bindQueue(queue, exchange, '*.delete.*');
```

## Будущие улучшения

- [x] Интеграция с RabbitMQ для событий в реальном времени
- [ ] WebSocket уведомления на основе событий RabbitMQ
- [ ] Экспорт событий в различные форматы (CSV, JSON)
- [ ] Триггеры на основе событий
- [ ] Интеграция с внешними системами аналитики (Kafka, Elasticsearch)
- [ ] Расширенные фильтры и поиск
- [ ] Агрегированные отчеты
- [ ] Dead Letter Queue для failed events

