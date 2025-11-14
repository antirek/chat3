# 📡 Events 2.0 — единый формат payload'ов

## Зачем понадобилось изменение

События Event теперь приводятся к общему контракту, чтобы Update Worker, аналитика и внешние потребители могли разбирать их без `switch/case` по `eventType`. Основные принципы:

1. **Унифицированный конверт `data`** с секциями `context`, `dialog`, `message`, `member`, `typing`, `actor`.
2. **Стандартизированный `entityId`** — всегда ID базовой сущности (`dlg_*` для диалогов, `msg_*` для сообщений). Дополнительные параметры (userId, реакция) лежат в секциях.
3. **События сами собирают дельту** — контроллеры передают данные в `eventUtils.build*`, который формирует однообразный JSON.
4. **Текст сообщения сохраняется в событиях** (`message.create/update/delete` несут контент до 4096 символов).

## Структура payload'а

```json
{
  "context": {
    "version": 2,
    "eventType": "message.reaction.add",
    "dialogId": "dlg_x",
    "entityId": "msg_y",
    "messageId": "msg_y",
    "includedSections": ["dialog", "member", "message.reaction", "actor"],
    "updatedFields": ["message.reaction"]
  },
  "dialog": {
    "dialogId": "dlg_x",
    "tenantId": "tnt_demo",
    "name": "Support",
    "createdBy": "system_bot",
    "createdAt": 1731500000000,
    "updatedAt": 1731500100000,
    "meta": { "channel": "whatsapp" }
  },
  "member": {
    "userId": "agent_1",
    "meta": {},
    "state": {
      "unreadCount": 3,
      "lastSeenAt": 1731500200000,
      "lastMessageAt": 1731500150000,
      "isActive": true
    }
  },
  "message": {
    "messageId": "msg_y",
    "dialogId": "dlg_x",
    "senderId": "alice",
    "type": "internal.text",
    "content": "Привет!",
    "reactionUpdate": {
      "userId": "bob",
      "reaction": "🔥",
      "oldReaction": null,
      "counts": { "🔥": 1 }
    }
  },
  "actor": {
    "actorId": "bob",
    "actorType": "user",
    "info": null
  }
}
```

### Секции

| Секция | Содержимое | Применимость |
| --- | --- | --- |
| `context` | Технические данные: тип события, `dialogId`, `entityId`, `includedSections`, `updatedFields`, версия схемы. | Всегда |
| `dialog` | Базовая информация о диалоге + `meta`. | Всегда, если доступен диалог |
| `member` | `userId`, персональные мета-теги, состояние (`unreadCount`, `lastSeenAt`, ...). | Для событий, где конкретный участник важен (`dialog.member.*`, `message.status.*`, реакции, typing) |
| `message` | Контент сообщения (для create/update/delete) или дельты (`statusUpdate`, `reactionUpdate`). | Все `message.*` события |
| `typing` | `{ userId, expiresInMs, timestamp, userInfo }`. | Только `dialog.typing` |
| `actor` | Инициатор события (`actorId`, `actorType`, опционально `info`). | Всегда |

## Mapping событий → секции

| `eventType` | `entityId` | Заполненные секции |
| --- | --- | --- |
| `dialog.create`, `dialog.delete` | `dlg_*` | `context`, `dialog`, `actor` |
| `dialog.member.add/remove` | `dlg_*` | `context`, `dialog`, `member`, `actor` |
| `dialog.member.update` | `dlg_*` | `context`, `dialog`, `member`, `actor` |
| `message.create/update/delete` | `msg_*` | `context`, `dialog`, `message.full`, `actor` |
| `message.status.*` | `msg_*` | `context`, `dialog`, `message.status`, `member`, `actor` |
| `message.reaction.*` | `msg_*` | `context`, `dialog`, `message.reaction`, `member`, `actor` |
| `dialog.typing` | `dlg_*` | `context`, `dialog`, `member`, `typing`, `actor` |
| `tenant.*` | `tnt_*` | (Не менялись, см. `docs/EVENTS.md`) |

## Примеры

### `dialog.member.update`

```json
{
  "context": {
    "eventType": "dialog.member.update",
    "dialogId": "dlg_x",
    "entityId": "dlg_x",
    "includedSections": ["dialog", "member", "actor"],
    "updatedFields": ["member.state.unreadCount", "member.state.lastSeenAt"]
  },
  "dialog": { "dialogId": "dlg_x" },
  "member": {
    "userId": "alice",
    "state": {
      "unreadCount": 2,
      "lastSeenAt": 1731500300000,
      "isActive": true
    }
  },
  "actor": {
    "actorId": "sync-service",
    "actorType": "api"
  },
  "extra": {
    "delta": {
      "unreadCount": { "from": 5, "to": 2 }
    }
  }
}
```

### `message.status.update`

```json
{
  "context": {
    "eventType": "message.status.update",
    "dialogId": "dlg_x",
    "entityId": "msg_y",
    "messageId": "msg_y",
    "includedSections": ["dialog", "message.status", "member", "actor"],
    "updatedFields": ["message.status"]
  },
  "dialog": { "dialogId": "dlg_x" },
  "message": {
    "messageId": "msg_y",
    "dialogId": "dlg_x",
    "senderId": "alice",
    "type": "internal.text",
    "content": "Привет!",
    "statusUpdate": {
      "userId": "bob",
      "status": "read",
      "oldStatus": "delivered"
    }
  },
  "member": { "userId": "bob" },
  "actor": { "actorId": "bob", "actorType": "user" }
}
```

### `message.reaction.remove`

```json
{
  "context": {
    "eventType": "message.reaction.remove",
    "dialogId": "dlg_x",
    "entityId": "msg_y",
    "messageId": "msg_y",
    "includedSections": ["dialog", "message.reaction", "member", "actor"],
    "updatedFields": ["message.reaction"]
  },
  "dialog": { "dialogId": "dlg_x" },
  "member": { "userId": "bob" },
  "message": {
    "messageId": "msg_y",
    "reactionUpdate": {
      "userId": "bob",
      "reaction": null,
      "oldReaction": "🔥",
      "counts": {}
    }
  },
  "actor": { "actorId": "bob", "actorType": "user" }
}
```

### `dialog.typing`

```json
{
  "context": {
    "eventType": "dialog.typing",
    "dialogId": "dlg_x",
    "entityId": "dlg_x",
    "includedSections": ["dialog", "member", "typing", "actor"],
    "updatedFields": ["typing"]
  },
  "dialog": { "dialogId": "dlg_x" },
  "member": { "userId": "alice" },
  "typing": {
    "userId": "alice",
    "expiresInMs": 4000,
    "timestamp": 1731500400000,
    "userInfo": { "name": "Alice" }
  },
  "actor": {
    "actorId": "alice",
    "actorType": "user",
    "info": { "name": "Alice" }
  }
}
```

## Где искать реализацию

- Обновлённые билдеры: `src/utils/eventUtils.js` (`buildEventContext`, `buildDialogSection`, ...).
- Контроллеры: `messageController`, `messageStatusController`, `messageReactionController`, `dialogController`, `dialogMemberController`, `typingController`.
- Update Worker теперь читает секции из `data.context`, `data.message`, `data.member` (`src/workers/updateWorker.js`).

## Совместимость

- Старые события (до миграции) остаются в БД как есть. Новый код умеет работать и с прежним форматом (Update Worker проверяет fallback поля).
- Новые клиенты должны читать нужные данные из секций, а не из произвольных полей (`data.dialogId`, `data.userId` больше не заполняются).

## Следующие шаги

- При добавлении новых типов событий достаточно заполнить нужные секции и описать их в `context.includedSections`.
- Если потребуется дополнительный атрибут (например, `tenant` или `attachment`), стоит добавить новую секцию и задокументировать её в этом файле.

