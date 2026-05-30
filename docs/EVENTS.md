# Система событий Chat3

## Обзор

Chat3 использует событийно-ориентированную архитектуру. Все изменения в системе генерируют события, которые сохраняются в MongoDB и публикуются в RabbitMQ.

## Модель Event

```javascript
{
  _id: ObjectId("..."),      // MongoDB ObjectId
  eventId: "evt_...",        // Уникальный ID события (evt_ + 32 hex символа)
  tenantId: "tnt_default",   // ID тенанта
  eventType: "dialog.create", // Тип события
  entityType: "dialog",      // Тип сущности
  entityId: "dlg_...",       // ID сущности
  actorId: "carl",           // ID пользователя, инициировавшего событие (опционально)
  actorType: "api",          // Тип актора (user, system, bot, api)
  data: { ... },             // Данные события (context, dialog, message, member, typing, user, actor)
  createdAt: 1763551369397.6482  // Timestamp создания (микросекунды)
}
```

**Поддерживаемые типы событий (доменные, без суффикса `.update`):**
- `dialog.create`, `dialog.changed`, `dialog.delete`
- `message.create`, `message.changed`
- `dialog.member.add`, `dialog.member.remove`, `dialog.member.changed`
- `message.status.changed`
- `message.reaction.changed`
- `dialog.typing`
- `dialog.topic.create`, `dialog.topic.changed`
- `dialog.messages.bulk_read` — массовое прочтение (после записи `MessageStatus`)
- `user.add`, `user.changed`, `user.remove`
- `pack.create`, `pack.delete`, `pack.dialog.add`, `pack.dialog.remove`

**Updates со счётчиками** (`user.stats.update`, `user.pack.stats.updated`, `pack.stats.updated`, `dialog.member.changed` с unread) публикует **counter-worker**, не tenant-api.

### Миграция имён (breaking, v0.0.71+)

| Было | Стало |
|------|-------|
| `dialog.update` | `dialog.changed` |
| `message.update` | `message.changed` |
| `dialog.member.update` | `dialog.member.changed` |
| `message.status.update` | `message.status.changed` |
| `message.reaction.update` | `message.reaction.changed` |
| `dialog.topic.update` | `dialog.topic.changed` |
| `user.update` | `user.changed` |

**Outbox:** события пишутся в MongoDB + `OutboxEvent`, в RabbitMQ — через **outbox-relay** (не fire-and-forget из API).

## Соответствие событий и обновлений

| Событие (Event) | Entity Type | Routing Key (Events) | Создаваемый Update | Routing Key (Updates) | Получатели | Дополнительные Updates |
|-----------------|-------------|---------------------|-------------------|---------------------|-----------|----------------------|
| `dialog.create` | `dialog` | `dialog.create.{tenantId}` | `DialogUpdate` | `update.dialog.{userType}.{userId}.dialogupdate` | Все участники диалога | - |
| `dialog.update` | `dialog` | `dialog.update.{tenantId}` | `DialogUpdate` | `update.dialog.{userType}.{userId}.dialogupdate` | Все участники диалога | - |
| `dialog.delete` | `dialog` | `dialog.delete.{tenantId}` | `DialogUpdate` | `update.dialog.{userType}.{userId}.dialogupdate` | Все участники диалога | - |
| `dialog.member.add` | `dialogMember` | `dialogMember.add.{tenantId}` | `DialogUpdate` | `update.dialog.{userType}.{userId}.dialogupdate` | Все участники диалога | `UserStatsUpdate` для добавленного пользователя (`dialogCount`) |
| `dialog.member.remove` | `dialogMember` | `dialogMember.remove.{tenantId}` | `DialogUpdate` | `update.dialog.{userType}.{userId}.dialogupdate` | Все участники + удаляемый пользователь | `UserStatsUpdate` для удаленного пользователя (`dialogCount`) |
| `dialog.member.update` | `dialogMember` | `dialogMember.update.{tenantId}` | `DialogMemberUpdate` | `update.dialog.{userType}.{userId}.dialogmemberupdate` | Конкретный участник | `UserStatsUpdate` (если изменился `unreadCount`) |
| `message.create` | `message` | `message.create.{tenantId}` | `MessageUpdate` | `update.dialog.{userType}.{userId}.messageupdate` | Все участники диалога | `UserStatsUpdate` для участников (если диалог стал непрочитанным) |
| `message.update` | `message` | `message.update.{tenantId}` | `MessageUpdate` | `update.dialog.{userType}.{userId}.messageupdate` | Все участники диалога | - |
| `message.status.update` | `messageStatus` | `messageStatus.update.{tenantId}` | `MessageUpdate` | `update.dialog.{userType}.{userId}.messageupdate` | Все участники диалога | - |
| `message.reaction.update` | `messageReaction` | `messageReaction.update.{tenantId}` | `MessageUpdate` | `update.dialog.{userType}.{userId}.messageupdate` | Все участники диалога | - |
| `dialog.typing` | `dialog` | `dialog.typing.{tenantId}` | `TypingUpdate` | `update.dialog.{userType}.{userId}.typingupdate` | Все участники (кроме инициатора) | - |
| `user.add` | `user` | `user.add.{tenantId}` | `UserUpdate` | `update.user.{userType}.{userId}.userupdate` | Конкретный пользователь | - |
| `user.update` | `user` | `user.update.{tenantId}` | `UserUpdate` | `update.user.{userType}.{userId}.userupdate` | Конкретный пользователь | - |
| `user.remove` | `user` | `user.remove.{tenantId}` | `UserUpdate` | `update.user.{userType}.{userId}.userupdate` | Конкретный пользователь | - |
| `pack.create` | `pack` | `pack.create.{tenantId}` | - | - | Сервисы, кеширующие состав паков | - |
| `pack.delete` | `pack` | `pack.delete.{tenantId}` | - | - | Сервисы, кеширующие состав паков | - |
| `pack.dialog.add` | `pack` | `pack.dialog.add.{tenantId}` | - | - | Обработчики синхронизации связок пак ↔ диалог | - |
| `pack.dialog.remove` | `pack` | `pack.dialog.remove.{tenantId}` | - | - | Обработчики синхронизации связок пак ↔ диалог | - |
| `pack.stats.updated` | `packStats` | `pack.stats.updated.{tenantId}` | `PackStatsUpdate` | `update.pack.{userType}.{userId}.packstatsupdate` | Все пользователи с UserPackStats по этому паку | Генерация воркером после пересчёта |
| `user.pack.stats.updated` | `userPackStats` | `user.pack.stats.updated.{tenantId}` | `UserPackStatsUpdate` | `update.pack.{userType}.{userId}.userpackstatsupdate` | Конкретный пользователь (unreadCount по паку) | Генерация воркером после пересчёта |

**Примечания:**
- `{userType}` - тип пользователя из модели User (user, bot, contact и т.д.)
- `{userId}` - ID пользователя-получателя update
- `{tenantId}` - ID тенанта (например, tnt_default)
- Routing keys для Updates имеют формат: `update.{category}.{userType}.{userId}.{updateType}`
- Routing keys для Events имеют формат: `{entityType}.{action}.{tenantId}`
- `UserStatsUpdate` создается автоматически при изменении статистики пользователя (не является прямым результатом события)

## Типы событий

### Dialog Events

#### dialog.create
Создание диалога

**Routing Key:** `dialog.create.{tenantId}` (например, `dialog.create.tnt_default`)

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

**Routing Key:** `dialog.update.{tenantId}`

#### dialog.delete
Удаление диалога

**Routing Key:** `dialog.delete.{tenantId}`

### Dialog Member Events

#### dialog.member.add
Добавление участника в диалог

**Routing Key:** `dialogMember.add.{tenantId}` (например, `dialogMember.add.tnt_default`)

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

**Routing Key:** `dialogMember.remove.{tenantId}`

#### dialog.member.update
Обновление участника диалога

**Routing Key:** `dialogMember.update.{tenantId}`

### Pack Events

#### pack.create
Создание пака.

**Routing Key:** `pack.create.{tenantId}`

Payload содержит секцию `pack` с метаданными пака и текущим количеством диалогов (на момент создания всегда `0`).

#### pack.delete
Удаление пака. Содержит секции `pack` и, при наличии, `packStats`, чтобы подписчики могли очистить кэш агрегатов.

**Routing Key:** `pack.delete.{tenantId}`

#### pack.dialog.add
Привязка диалога к паку.

**Routing Key:** `pack.dialog.add.{tenantId}`

Секции: `pack` (актуальный список/счётчик диалогов), `dialog` (основные данные диалога).

#### pack.dialog.remove
Удаление диалога из пака.

**Routing Key:** `pack.dialog.remove.{tenantId}`

#### pack.stats.updated
Актуализация агрегатов пака (messageCount, uniqueMemberCount и т.д.), генерируется update-worker после пересчёта.

**Routing Key:** `pack.stats.updated.{tenantId}`

**Data пример:**
```json
{
  "context": {
    "eventType": "pack.stats.updated",
    "packId": "pck_...",
    "entityId": "pck_...",
    "includedSections": ["packStats"],
    "updatedFields": ["packStats"]
  },
  "packStats": {
    "packId": "pck_...",
    "messageCount": 42,
    "uniqueMemberCount": 10,
    "sumMemberCount": 18,
    "uniqueTopicCount": 5,
    "sumTopicCount": 7,
    "dialogCount": 3,
    "lastUpdatedAt": 1763551369397.6482
  }
}
```

#### user.pack.stats.updated
Актуализация счётчика непрочитанных сообщений пака конкретного пользователя.

**Routing Key:** `user.pack.stats.updated.{tenantId}`

Секция `userPackStats` содержит пару `packId`/`userId` и новое значение `unreadCount`.

### Message Events

#### message.create
Создание сообщения

**Routing Key:** `message.create.{tenantId}` (например, `message.create.tnt_default`)

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

**Routing Key:** `message.update.{tenantId}`

**Примечание:** Создается при обновлении содержимого сообщения через `PUT /api/messages/:messageId`

### Message Status Events

#### message.status.update
Обновление статуса сообщения

**Routing Key:** `messageStatus.update.{tenantId}` (например, `messageStatus.update.tnt_default`)

**Data:**
```json
{
  "context": {
    "eventType": "message.status.update",
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

**Примечание:** Создается при изменении статуса сообщения через `POST /api/users/:userId/dialogs/:dialogId/messages/:messageId/status/:status`

### Message Reaction Events

#### message.reaction.update
Обновление реакции на сообщение

**Routing Key:** `messageReaction.update.{tenantId}` (например, `messageReaction.update.tnt_default`)

**Data:**
```json
{
  "context": {
    "eventType": "message.reaction.update",
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

**Примечание:** Создается при добавлении или удалении реакции через `POST /api/users/:userId/dialogs/:dialogId/messages/:messageId/reactions/:action` (action: `set` или `unset`)

### Typing Events

#### dialog.typing
Индикатор печати

**Routing Key:** `dialog.typing.{tenantId}` (например, `dialog.typing.tnt_default`)

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
    "expiresInMs": 5000,
    "timestamp": 1763551369397.6482,
    "userInfo": null
  },
  "actor": { ... }
}
```

**Примечание:** Typing события не создают Updates, они публикуются напрямую в RabbitMQ

### User Events

#### user.add
Создание пользователя

**Routing Key:** `user.add.{tenantId}` (например, `user.add.tnt_default`)

**Data:**
```json
{
  "context": {
    "eventType": "user.add",
    "entityId": "carl",
    "includedSections": ["user", "actor"]
  },
  "user": {
    "userId": "carl",
    "type": "user",
    "meta": {}
  },
  "actor": { ... }
}
```

#### user.update
Обновление пользователя

**Routing Key:** `user.update.{tenantId}`

**Data:**
```json
{
  "context": {
    "eventType": "user.update",
    "entityId": "carl",
    "includedSections": ["user", "actor"],
    "updatedFields": ["name", "type"]
  },
  "user": {
    "userId": "carl",
    "type": "bot",
    "meta": {}
  },
  "actor": { ... }
}
```

#### user.remove
Удаление пользователя

**Routing Key:** `user.remove.{tenantId}`

### Tenant Events

#### tenant.create
Создание тенанта

**Routing Key:** `tenant.create.{tenantId}`

#### tenant.update
Обновление тенанта

**Routing Key:** `tenant.update.{tenantId}`

#### tenant.delete
Удаление тенанта

**Routing Key:** `tenant.delete.{tenantId}`

## RabbitMQ Exchange

### Exchange: chat3_events

- **Тип:** topic
- **Durable:** true

### Routing Keys

Формат: `{entityType}.{action}.{tenantId}`

Где:
- `entityType` - тип сущности (dialog, message, dialogMember, messageStatus, messageReaction, user, tenant)
- `action` - действие (последняя часть eventType: create, update, delete, add, remove, typing)
- `tenantId` - ID тенанта (например, tnt_default)

**Примеры:**
- `dialog.create.tnt_default` - создание диалога
- `message.create.tnt_default` - создание сообщения
- `dialogMember.add.tnt_default` - добавление участника
- `messageStatus.update.tnt_default` - обновление статуса сообщения
- `messageReaction.update.tnt_default` - обновление реакции
- `dialog.typing.tnt_default` - индикатор печати
- `user.add.tnt_default` - создание пользователя

### Подписка на события

```javascript
// Подписка на все события диалогов для конкретного тенанта
channel.bindQueue(queueName, 'chat3_events', 'dialog.*.tnt_default');

// Подписка на все события создания диалогов для всех тенантов
channel.bindQueue(queueName, 'chat3_events', 'dialog.create.*');

// Подписка на все события сообщений для конкретного тенанта
channel.bindQueue(queueName, 'chat3_events', 'message.*.tnt_default');

// Подписка на конкретное событие для конкретного тенанта
channel.bindQueue(queueName, 'chat3_events', 'dialog.create.tnt_default');

// Подписка на все события для конкретного тенанта
channel.bindQueue(queueName, 'chat3_events', '*.*.tnt_default');

// Подписка на все события всех тенантов
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
  "packId": null,
  "userId": null,
  "messageId": null,
  "includedSections": ["dialog", "actor"],
  "updatedFields": []
}
```

Поля `packId` и `userId` используются для pack-событий (`pack.*`, `user.pack.*`) и указывают, к какому паку/пользователю относится изменение.

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

---

## Для интегрируемых приложений

Внешние системы могут подписываться на **Events** в RabbitMQ, чтобы реагировать на изменения в Chat3 (создание/обновление диалогов, сообщений, участников, статусов, реакций, паков и т.д.).

**Где смотреть:**
- **Полный справочник по событиям** — этот документ (EVENTS.md).
- **Подписка на Updates (персонализированные уведомления для пользователей)** — [UPDATES.md](UPDATES.md).
- **Пошаговая интеграция, примеры кода, подписка на Updates** — [INTEGRATION.md](INTEGRATION.md).

**Events — ключевые данные для интегратора:**

| Параметр | Значение |
|----------|----------|
| Exchange | `chat3_events` (type: topic) |
| Формат routing key | `{entityType}.{action}.{tenantId}` |
| Примеры | `dialog.create.tnt_default`, `message.create.tnt_default`, `message.status.update.tnt_default` |
| Подписка (wildcard) | `#` — все события тенанта; `message.#` — все события сообщений; `*.create.tnt_default` — все создания |

**Типы событий (кратко):** `dialog.create/update/delete`, `dialog.member.add/remove/update`, `message.create/update`, `message.status.update`, `message.reaction.update`, `dialog.typing`, `user.add/update/remove`, `pack.create/delete`, `pack.dialog.add/remove`, `pack.stats.updated`, `user.pack.stats.updated`.

**Важно:** События обрабатываются Update Worker; на их основе создаются **Updates** для конкретных пользователей. Для доставки уведомлений «конкретному пользователю» подписывайтесь на exchange **chat3_updates** (см. [UPDATES.md](UPDATES.md) и [INTEGRATION.md](INTEGRATION.md)).

