# Система обновлений Chat3

## Обзор

Updates - это персонализированные обновления для пользователей, создаваемые на основе событий. Каждый Update содержит полные данные объекта (Dialog или Message) с учетом контекста конкретного пользователя.

## Модель Update

```javascript
{
  tenantId: "tnt_default",
  userId: "carl",              // Получатель update
  dialogId: "dlg_...",
  entityId: "dlg_...",         // ID сущности (dlg_* или msg_*)
  eventId: ObjectId("..."),   // Ссылка на исходное событие
  eventType: "dialog.create",
  data: { ... },               // Полные данные для пользователя
  published: false,            // Отправлен ли в RabbitMQ
  publishedAt: null,
  createdAt: 1763551369397.6482
}
```

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
- `message.delete`
- `message.reaction.add`
- `message.reaction.update`
- `message.reaction.remove`
- `message.status.create`
- `message.status.update`

**Структура data:**
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
    "reactionCounts": {},
    "senderInfo": {
      "userId": "carl",
      "name": "Carl Johnson",
      "lastActiveAt": 1763551369397.6482,
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

## RabbitMQ Exchange

### Exchange: chat3_updates

- **Тип:** topic
- **Durable:** true

### Routing Keys

Формат: `user.{type}.{userId}.{updateType}`

**Компоненты:**
- `type` - тип пользователя из модели User (user, bot, contact и т.д.)
- `userId` - ID пользователя
- `updateType` - тип обновления: `dialog` или `message`

**Примеры:**
- `user.user.carl.dialog` - обновление диалога для пользователя carl типа user
- `user.bot.bot_123.message` - обновление сообщения для бота bot_123
- `user.contact.cnt_72a454kho.dialog` - обновление диалога для контакта

**Примечание:** Если пользователь не найден в модели User, используется тип `user` по умолчанию.

### Подписка на обновления

#### Подписка для конкретного пользователя

```javascript
const userId = 'carl';
const userType = 'user'; // Получается из модели User

const queueName = `user.${userType}.${userId}`;
await channel.assertQueue(queueName, {
  durable: true,
  arguments: {
    'x-message-ttl': 3600000 // 1 час TTL
  }
});

// Подписка на все обновления пользователя
await channel.bindQueue(queueName, 'chat3_updates', `user.${userType}.${userId}.*`);
```

#### Подписка для всех пользователей определенного типа

```javascript
// Все обновления для пользователей типа bot
await channel.bindQueue(queueName, 'chat3_updates', 'user.bot.*.*');

// Все обновления диалогов для пользователей типа user
await channel.bindQueue(queueName, 'chat3_updates', 'user.user.*.dialog');
```

#### Подписка на все обновления

```javascript
await channel.bindQueue(queueName, 'chat3_updates', 'user.*.*.*');
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

const queueName = `user.user.carl`;
await channel.assertQueue(queueName, {
  durable: true,
  arguments: { 'x-message-ttl': 3600000 }
});

await channel.bindQueue(queueName, 'chat3_updates', 'user.user.carl.*');

channel.consume(queueName, (msg) => {
  if (msg) {
    const update = JSON.parse(msg.content.toString());
    console.log('Update received:', update);
    
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
    case 'dialog.create':
    case 'dialog.update':
      handleDialogUpdate(data);
      break;
      
    case 'message.create':
    case 'message.update':
      handleMessageUpdate(data);
      break;
      
    case 'dialog.member.add':
      handleMemberAdded(data);
      break;
      
    case 'dialog.member.remove':
      handleMemberRemoved(data);
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
}
```

