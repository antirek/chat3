# Система событий Chat3

## Обзор

Chat3 использует событийно-ориентированную архитектуру. Все изменения в системе генерируют события, которые сохраняются в MongoDB и публикуются в RabbitMQ.

## Модель Event

```javascript
{
  eventId: "evt_...",        // Уникальный ID события
  tenantId: "tnt_default",   // ID тенанта
  eventType: "dialog.create", // Тип события
  entityType: "dialog",      // Тип сущности
  entityId: "dlg_...",       // ID сущности
  actorId: "carl",           // ID пользователя, инициировавшего событие
  actorType: "api",          // Тип актора (user, system, bot, api)
  data: { ... },             // Данные события
  createdAt: 1763551369397.6482  // Timestamp создания
}
```

## Типы событий

### Dialog Events

#### dialog.create
Создание диалога

**Routing Key:** `dialog.dialog.create`

**Data:**
```json
{
  "context": {
    "eventType": "dialog.create",
    "dialogId": "dlg_...",
    "entityId": "dlg_...",
    "includedSections": ["dialog", "actor"]
  },
  "dialog": {
    "dialogId": "dlg_...",
    "tenantId": "tnt_default",
    "name": "VIP чат",
    "createdBy": "carl",
    "createdAt": 1763551369397.6482,
    "updatedAt": 1763551369397.6482,
    "meta": {}
  },
  "actor": {
    "actorId": "api-key-name",
    "actorType": "api"
  }
}
```

#### dialog.update
Обновление диалога

**Routing Key:** `dialog.dialog.update`

#### dialog.delete
Удаление диалога

**Routing Key:** `dialog.dialog.delete`

### Dialog Member Events

#### dialog.member.add
Добавление участника в диалог

**Routing Key:** `dialogMember.dialog.member.add`

**Data:**
```json
{
  "context": {
    "eventType": "dialog.member.add",
    "dialogId": "dlg_...",
    "entityId": "dlg_...",
    "includedSections": ["dialog", "member", "actor"]
  },
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
  "actor": { ... }
}
```

#### dialog.member.remove
Удаление участника из диалога

**Routing Key:** `dialogMember.dialog.member.remove`

#### dialog.member.update
Обновление участника диалога

**Routing Key:** `dialogMember.dialog.member.update`

### Message Events

#### message.create
Создание сообщения

**Routing Key:** `message.message.create`

**Data:**
```json
{
  "context": {
    "eventType": "message.create",
    "dialogId": "dlg_...",
    "entityId": "msg_...",
    "messageId": "msg_...",
    "includedSections": ["dialog", "message", "actor"]
  },
  "dialog": { ... },
  "message": {
    "messageId": "msg_...",
    "dialogId": "dlg_...",
    "senderId": "carl",
    "type": "internal.text",
    "content": "Hello!",
    "meta": {},
    "statuses": [],
    "reactionCounts": {}
  },
  "actor": { ... }
}
```

#### message.update
Обновление сообщения

**Routing Key:** `message.message.update`

**Примечание:** Создается при обновлении содержимого сообщения через `PUT /api/messages/:messageId/content`

#### message.delete
Удаление сообщения

**Routing Key:** `message.message.delete`

### Message Status Events

#### message.status.create
Создание статуса сообщения

**Routing Key:** `messageStatus.message.status.create`

**Data:**
```json
{
  "context": {
    "eventType": "message.status.create",
    "dialogId": "dlg_...",
    "entityId": "msg_...",
    "messageId": "msg_...",
    "includedSections": ["dialog", "message", "statusUpdate", "actor"]
  },
  "dialog": { ... },
  "message": { ... },
  "statusUpdate": {
    "userId": "carl",
    "status": "read",
    "readAt": 1763551369397.6482,
    "createdAt": 1763551369397.6482
  },
  "actor": { ... }
}
```

#### message.status.update
Обновление статуса сообщения

**Routing Key:** `messageStatus.message.status.update`

### Message Reaction Events

#### message.reaction.add
Добавление реакции на сообщение

**Routing Key:** `messageReaction.message.reaction.add`

**Data:**
```json
{
  "context": {
    "eventType": "message.reaction.add",
    "dialogId": "dlg_...",
    "entityId": "msg_...",
    "messageId": "msg_...",
    "includedSections": ["dialog", "message", "reactionUpdate", "actor"]
  },
  "dialog": { ... },
  "message": { ... },
  "reactionUpdate": {
    "userId": "carl",
    "reaction": "👍",
    "createdAt": 1763551369397.6482
  },
  "actor": { ... }
}
```

#### message.reaction.update
Обновление реакции

**Routing Key:** `messageReaction.message.reaction.update`

#### message.reaction.remove
Удаление реакции

**Routing Key:** `messageReaction.message.reaction.remove`

### Typing Events

#### dialog.typing
Индикатор печати

**Routing Key:** `dialog.dialog.typing`

**Data:**
```json
{
  "context": {
    "eventType": "dialog.typing",
    "dialogId": "dlg_...",
    "entityId": "dlg_...",
    "includedSections": ["dialog", "typing", "actor"]
  },
  "dialog": { ... },
  "typing": {
    "userId": "carl",
    "isTyping": true,
    "expiresAt": 1763551369402.6482
  },
  "actor": { ... }
}
```

**Примечание:** Typing события не создают Updates, они публикуются напрямую в RabbitMQ

### Tenant Events

#### tenant.create
Создание тенанта

**Routing Key:** `tenant.tenant.create`

#### tenant.update
Обновление тенанта

**Routing Key:** `tenant.tenant.update`

#### tenant.delete
Удаление тенанта

**Routing Key:** `tenant.tenant.delete`

## RabbitMQ Exchange

### Exchange: chat3_events

- **Тип:** topic
- **Durable:** true

### Routing Keys

Формат: `{entityType}.{eventType}`

**Примеры:**
- `dialog.dialog.create`
- `message.message.create`
- `dialogMember.dialog.member.add`
- `messageStatus.message.status.create`
- `messageReaction.message.reaction.add`
- `dialog.dialog.typing`

### Подписка на события

```javascript
// Подписка на все события диалогов
channel.bindQueue(queueName, 'chat3_events', 'dialog.*');

// Подписка на все события сообщений
channel.bindQueue(queueName, 'chat3_events', 'message.*');

// Подписка на конкретное событие
channel.bindQueue(queueName, 'chat3_events', 'dialog.dialog.create');

// Подписка на все события
channel.bindQueue(queueName, 'chat3_events', '#');
```

## Структура данных события

### Context Section

```json
{
  "version": 2,
  "eventType": "dialog.create",
  "dialogId": "dlg_...",
  "entityId": "dlg_...",
  "messageId": null,
  "includedSections": ["dialog", "actor"],
  "updatedFields": []
}
```

### Dialog Section

```json
{
  "dialogId": "dlg_...",
  "tenantId": "tnt_default",
  "name": "VIP чат",
  "createdBy": "carl",
  "createdAt": 1763551369397.6482,
  "updatedAt": 1763551369397.6482,
  "meta": {}
}
```

### Member Section

```json
{
  "userId": "carl",
  "meta": {},
  "state": {
    "unreadCount": 0,
    "lastSeenAt": 1763551369397.6482,
    "lastMessageAt": null,
    "isActive": true
  }
}
```

### Message Section

```json
{
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
}
```

### Actor Section

```json
{
  "actorId": "api-key-name",
  "actorType": "api"
}
```

## Обработка событий

События обрабатываются Update Worker:

1. Событие публикуется в RabbitMQ exchange `chat3_events`
2. Update Worker получает событие из очереди `update_worker_queue`
3. Worker определяет, нужно ли создавать Update
4. Если нужно, создаются Update записи для всех затронутых пользователей
5. Updates публикуются в RabbitMQ exchange `chat3_updates`

## Версионирование

События используют версию payload: `version: 2`

При изменении структуры данных события версия должна быть увеличена.

