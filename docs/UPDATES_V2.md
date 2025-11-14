# 🔄 Updates 2.0 — нормализованные payload'ы

## Зачем понадобился рефакторинг

Мы привели систему Updates к общему контракту:

1. **Единый конверт `data`** с секциями `dialog`, `member`, `message`, `typing`, `context`.
2. **Персональные мета-теги (`dialogMemberMeta`) теперь приходят во всех апдейтах**, а не только в `DialogUpdate`.
3. **Routing key для `dialog.member.update`** вынесен в отдельное значение `user.{userId}.dialogmemberupdate`.
4. **Больше никакого `dialogInfo` и дублирования корневых полей** — весь контекст лежит в `data.dialog`.
5. **“Тяжёлые” события сообщений разделены:** `message.create/update/delete` несут полный срез, а `message.status.*` и `message.reaction.*` доставляют дельты.

## Универсальный конверт

```json
{
  "dialog": {
    "dialogId": "dlg_xxx",
    "tenantId": "tnt_demo",
    "name": "Support",
    "createdBy": "system_bot",
    "createdAt": 1731500000000,
    "updatedAt": 1731500100000,
    "meta": { "channel": "whatsapp" }
  },
  "member": {
    "userId": "agent_1",
    "meta": { "role": "agent", "muted": false },
    "state": {
      "unreadCount": 0,
      "lastSeenAt": 1731500200000,
      "lastMessageAt": 1731500150000,
      "isActive": true
    }
  },
  "message": {
    "...": "зависит от типа события (см. ниже)"
  },
  "typing": {
    "...": "присутствует только для dialog.typing"
  },
  "context": {
    "eventType": "message.status.update",
    "dialogId": "dlg_xxx",
    "entityId": "msg_xxx",
    "messageId": "msg_xxx",
    "reason": "message_status",
    "includedSections": ["dialog", "member", "message.status"],
    "updatedFields": ["message.status"]
  }
}
```

### Секции

- **`dialog`** — обязательная часть. Всегда содержит идентификаторы, автора, таймстемпы и мета-теги диалога.
- **`member`** — всегда присутствует, даже если событие касается другого пользователя (например, typing). В `state` лежит последняя известная информация для получателя апдейта.
- **`message`** — либо полный документ (для `message.create/update/delete`), либо компактная дельта (для `message.status.*` / `message.reaction.*`).
- **`typing`** — присутствует только у `dialog.typing` и описывает инициатора печати.
- **`context`** — служебная секция, в которой перечислены:
  - `includedSections` — какие части payload'а заполнены;
  - `updatedFields` — какие поля точно изменились;
  - `reason` — человекочитаемая причина (когда есть).

## Mapping «событие → содержимое»

| Событие | `message` | `typing` | Доп. сведения |
| --- | --- | --- | --- |
| `dialog.create/update/delete`, `dialog.member.add/remove` | — | — | Только `dialog` + `member`. |
| `dialog.member.update` | — | — | `member.state` обновляется, routing key: `user.{id}.dialogmemberupdate`. |
| `message.create/update/delete` | Полный документ сообщения (content, meta, statuses, senderInfo) | — | `includedSections` содержит `message.full`. |
| `message.status.*` | `{ messageId, dialogId, senderId, statusUpdate }` | — | Только дельта статуса, без полного контента. |
| `message.reaction.*` | `{ messageId, dialogId, senderId, reactionUpdate, counts? }` | — | Если контроллер передал новые `reactionCounts`, они попадают в `reactionUpdate.counts`. |
| `dialog.typing` | — | `{ userId, expiresInMs, timestamp, userInfo }` | У получателя остаётся своя `member.meta`. |

> 🎯 Поведение по умолчанию: если секции нет в `includedSections`, можно считать, что она не изменилась.

## Routing keys

| Update type | Routing key |
| --- | --- |
| `DialogUpdate` | `user.{userId}.dialogupdate` |
| `DialogMemberUpdate` | `user.{userId}.dialogmemberupdate` |
| `MessageUpdate` | `user.{userId}.messageupdate` |
| `Typing` | `user.{userId}.typing` |

Теперь можно подписываться выборочно — например, выделить очередь только для unread-дельт, не обрабатывая все `DialogUpdate`.

## Примеры

### 1. `message.create`

```json
{
  "dialog": { "...": "полный срез" },
  "member": { "...": "персональные мета + state" },
  "message": {
    "messageId": "msg_q1",
    "dialogId": "dlg_x",
    "senderId": "carol",
    "content": "Привет!",
    "meta": { "channelType": "whatsapp" },
    "statuses": [],
    "reactionCounts": {}
  },
  "context": {
    "eventType": "message.create",
    "includedSections": ["dialog", "member", "message.full"],
    "updatedFields": ["message"]
  }
}
```

### 2. `message.status.update`

```json
{
  "dialog": { "...": "как выше" },
  "member": { "...": "для получателя" },
  "message": {
    "messageId": "msg_q1",
    "dialogId": "dlg_x",
    "senderId": "carol",
    "type": "internal.text",
    "statusUpdate": {
      "userId": "john",
      "status": "read",
      "oldStatus": "delivered"
    }
  },
  "context": {
    "eventType": "message.status.update",
    "reason": "message_status",
    "includedSections": ["dialog", "member", "message.status"],
    "updatedFields": ["message.status"]
  }
}
```

### 3. `dialog.member.update`

```json
{
  "dialog": { "...": "инфо по диалогу" },
  "member": {
    "userId": "john",
    "meta": { "role": "agent" },
    "state": {
      "unreadCount": 4,
      "lastSeenAt": 1731500300000,
      "lastMessageAt": 1731500290000,
      "isActive": true
    }
  },
  "context": {
    "eventType": "dialog.member.update",
    "includedSections": ["dialog", "member"],
    "updatedFields": ["member.state.unreadCount"]
  }
}
```

### 4. `dialog.typing`

```json
{
  "dialog": { "...": "контекст" },
  "member": { "...": "получатель с его meta" },
  "typing": {
    "userId": "carl",
    "expiresInMs": 4000,
    "timestamp": 1731500400000,
    "userInfo": { "name": "Carl" }
  },
  "context": {
    "eventType": "dialog.typing",
    "reason": "typing",
    "includedSections": ["dialog", "member", "typing"]
  }
}
```

## Что нужно знать интеграторам

- **Backward compatibility**: структура `data` изменилась. Если клиент ожидал `dialogInfo` или `memberData`, следует переключиться на новые секции.
- **Дельты сообщений**: для `message.status.*` и `message.reaction.*` больше не присылаем полный текст сообщения. Если нужен полный срез — он уже должен быть в состоянии клиента или его нужно запросить заново.
- **Персональные настройки** всегда доступны в `data.member.meta`, независимо от типа события.
- **Фильтрация событий** теперь проще: используйте routing key, соответствующий нужному типу апдейтов.

## Где посмотреть код

- Нормализация реализована в `src/utils/updateUtils.js` (функции `createDialogUpdate`, `createDialogMemberUpdate`, `createMessageUpdate`, `createTypingUpdate`).
- Тесты можно посмотреть в `src/utils/__tests__/updateUtils.test.js`.

Если требуются дополнительные секции или обратная совместимость, добавьте поля в `context.includedSections`/`context.updatedFields`, чтобы потребители могли корректно реагировать на изменения.

