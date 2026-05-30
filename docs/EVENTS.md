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

| Событие (Event) | Entity Type | Routing Key (Events) | Update (источник) | Routing Key (Updates) | Получатели |
|-----------------|-------------|---------------------|-------------------|----------------------|-----------|
| `dialog.create` | `dialog` | `dialog.create.{tenantId}` | `DialogUpdate` (**update-worker**) | `update.dialog.{userType}.{userId}.dialogupdate` | Участники диалога |
| `dialog.changed` | `dialog` | `dialog.changed.{tenantId}` | `DialogUpdate` (**update-worker**) | `update.dialog.{userType}.{userId}.dialogupdate` | Участники диалога |
| `dialog.delete` | `dialog` | `dialog.delete.{tenantId}` | `DialogUpdate` (**update-worker**) | `update.dialog.{userType}.{userId}.dialogupdate` | Участники диалога |
| `dialog.member.add` | `dialogMember` | `dialogMember.add.{tenantId}` | `DialogUpdate` + counter stats (**counter-worker**) | см. Updates | Участники + stats |
| `dialog.member.remove` | `dialogMember` | `dialogMember.remove.{tenantId}` | `DialogUpdate` + counter stats (**counter-worker**) | см. Updates | Участники + stats |
| `dialog.member.changed` | `dialogMember` | `dialogMember.changed.{tenantId}` | `DialogMemberUpdate` (**counter-worker**, unread) | `update.dialog.{userType}.{userId}.dialogmemberupdate` | Участник |
| `message.create` | `message` | `message.create.{tenantId}` | `MessageUpdate` (**update-worker**) + counter stats | см. Updates | Участники |
| `message.changed` | `message` | `message.changed.{tenantId}` | `MessageUpdate` (**update-worker**) | `update.dialog.{userType}.{userId}.messageupdate` | Участники |
| `message.status.changed` | `messageStatus` | `messageStatus.changed.{tenantId}` | `MessageUpdate` (**update-worker**) + counter stats | см. Updates | Участники |
| `message.reaction.changed` | `messageReaction` | `messageReaction.changed.{tenantId}` | `MessageUpdate` (**update-worker**) | `update.dialog.{userType}.{userId}.messageupdate` | Участники |
| `dialog.messages.bulk_read` | `dialogMember` | `dialogMember.bulk_read.{tenantId}` * | counter stats (**counter-worker**) | `DialogMemberUpdate`, `UserStatsUpdate`, … | Участник |
| `dialog.topic.create` / `dialog.topic.changed` | `topic` | `dialogTopic.create/changed.{tenantId}` | counter stats при create | — | — |
| `dialog.typing` | `dialog` | `dialog.typing.{tenantId}` | `TypingUpdate` (**update-worker**) | `update.dialog.{userType}.{userId}.typingupdate` | Участники |
| `user.add` / `user.changed` / `user.remove` | `user` | `user.add/changed/remove.{tenantId}` | `UserUpdate` (**update-worker**) | `update.user.{userType}.{userId}.userupdate` | Пользователь |
| `pack.create` / `pack.delete` | `pack` | `pack.create/delete.{tenantId}` | — | — | Кеши паков |
| `pack.dialog.add` / `pack.dialog.remove` | `pack` | `pack.dialog.add/remove.{tenantId}` | counter stats (**counter-worker**) | `UserPackStatsUpdate`, … | Пользователи пака |

\* routing key формируется из `entityType` + последний сегмент `eventType`; для `dialog.messages.bulk_read` см. [INTEGRATORS_COUNTERS_MIGRATION.md](./INTEGRATORS_COUNTERS_MIGRATION.md).

**Updates только в `chat3_updates` (не доменные Event в journal):**

| Update eventType (в документе Update) | Источник | Routing Key (Updates) |
|---------------------------------------|----------|------------------------|
| `user.stats.update` | **counter-worker** | `update.user.{userType}.{userId}.userstatsupdate` |
| `pack.stats.updated` | **counter-worker** | `update.pack.{userType}.{userId}.packstatsupdate` |
| `user.pack.stats.updated` | **counter-worker** | `update.pack.{userType}.{userId}.userpackstatsupdate` |

**Примечания:**
- `{userType}` — тип пользователя из модели User (user, bot, contact и т.д.)
- `{userId}` — ID пользователя-получателя update
- `{tenantId}` — ID тенанта (например, tnt_default)
- Routing keys для Updates: `update.{category}.{userType}.{userId}.{updateType}`
- Routing keys для Events: `{entityType}.{action}.{tenantId}`, где `action` — последний сегмент `eventType`
- **counter-worker** — единственный writer stats; **update-worker** — domain Updates без записи stats
- Подробнее для внешних интеграторов: [INTEGRATORS_COUNTERS_MIGRATION.md](./INTEGRATORS_COUNTERS_MIGRATION.md)

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

#### dialog.changed
Обновление диалога

**Routing Key:** `dialog.changed.{tenantId}`

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

#### dialog.member.changed
Обновление участника диалога

**Routing Key:** `dialogMember.changed.{tenantId}`

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

> **Update only** — не публикуется в `chat3_events`. Генерируется **counter-worker** в `chat3_updates`.
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

> **Update only** — не публикуется в `chat3_events`. Генерируется **counter-worker** в `chat3_updates`.
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

#### message.changed
Обновление сообщения

**Routing Key:** `message.changed.{tenantId}`

**Примечание:** Создается при обновлении содержимого сообщения через `PUT /api/messages/:messageId`

### Message Status Events

#### message.status.changed
Обновление статуса сообщения

**Routing Key:** `messageStatus.changed.{tenantId}` (например, `messageStatus.changed.tnt_default`)

**Data:**
```json
{
  "context": {
    "eventType": "message.status.changed",
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

#### message.reaction.changed
Обновление реакции на сообщение

**Routing Key:** `messageReaction.changed.{tenantId}` (например, `messageReaction.changed.tnt_default`)

**Data:**
```json
{
  "context": {
    "eventType": "message.reaction.changed",
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

#### user.changed
Обновление пользователя

**Routing Key:** `user.changed.{tenantId}`

**Data:**
```json
{
  "context": {
    "eventType": "user.changed",
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
- `messageStatus.changed.tnt_default` - изменение статуса сообщения
- `messageReaction.changed.tnt_default` - изменение реакции
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
2. **outbox-relay** публикует событие в `chat3_events`
3. **update-worker** и **counter-worker** получают событие из своих очередей
4. **update-worker** создаёт domain Updates (`DialogUpdate`, `MessageUpdate`, …)
5. **counter-worker** пересчитывает stats и публикует counter-Updates (`UserStatsUpdate`, `DialogMemberUpdate`, …)
6. Updates доставляются в RabbitMQ exchange `chat3_updates`

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
| Примеры | `dialog.create.tnt_default`, `message.create.tnt_default`, `message.status.changed.tnt_default` |
| Подписка (wildcard) | `#` — все события; `message.#` — сообщения; `*.changed.tnt_default` — все `.changed` |

**Типы событий (кратко):** `dialog.create/changed/delete`, `dialog.member.add/remove/changed`, `message.create/changed`, `message.status.changed`, `message.reaction.changed`, `dialog.messages.bulk_read`, `dialog.typing`, `user.add/changed/remove`, `pack.create/delete`, `pack.dialog.add/remove`.

**Важно:** Domain Events → **update-worker** (контент) и **counter-worker** (stats). Counter-Updates (`user.stats.update`, pack stats) — только в **`chat3_updates`**, не в `chat3_events`. Для UI unread подписывайтесь на **chat3_updates** ([UPDATES.md](UPDATES.md), [INTEGRATORS_COUNTERS_MIGRATION.md](./INTEGRATORS_COUNTERS_MIGRATION.md)).

