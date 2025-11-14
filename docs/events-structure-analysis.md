# Анализ структуры событий Event

> ℹ️ **Обновление:** unified payload теперь описан в `docs/EVENTS_V2.md`. Этот файл оставлен как исторический анализ исходного состояния (до Event 2.0).

## Проверенные источники

- Модель `Event` задаёт допустимые `eventType`, `entityType`, формат `eventId` и набор индексов.

```5:78:src/models/Event.js
const eventSchema = new mongoose.Schema({
  eventId: { type: String, match: /^evt_[a-z0-9]{32}$/ },
  tenantId: { type: String, match: /^tnt_[a-z0-9]+$/ },
  eventType: {
    type: String,
    enum: [
      'dialog.create', 'dialog.update', 'dialog.delete',
      'message.create', 'message.update', 'message.delete',
      'dialog.member.add', 'dialog.member.remove', 'dialog.member.update',
      'message.status.create', 'message.status.update',
      'message.reaction.add', 'message.reaction.update', 'message.reaction.remove',
      'dialog.typing', 'tenant.create', 'tenant.update', 'tenant.delete'
    ]
  },
  entityType: { enum: ['dialog', 'message', 'dialogMember', 'messageStatus', 'messageReaction', 'tenant'] },
  entityId: { type: String, description: 'ID сущности с префиксом' },
  actorId, actorType, data, createdAt
});
```

- Примеры наполнения `data` в контроллерах:

```68:111:src/controllers/messageStatusController.js
await eventUtils.createEvent({
  eventType: oldStatus ? 'message.status.update' : 'message.status.create',
  entityType: 'messageStatus',
  entityId: `${messageId}_${userId}`,
  data: {
    messageId,
    userId,
    senderId: message.senderId,
    oldStatus: oldStatus?.status || null,
    newStatus: status,
    dialogId: message.dialogId
  }
});
```

```156:272:src/controllers/messageReactionController.js
await eventUtils.createEvent({
  eventType,
  entityType: 'messageReaction',
  entityId: `${messageId}_${userId}_${reaction}`,
  data: {
    dialogId: message.dialogId,
    messageId,
    userId,
    reaction,
    oldReaction,
    reactionCounts: updatedMessage.reactionCounts
  }
});
```

```50:67:src/controllers/typingController.js
await eventUtils.createEvent({
  eventType: 'dialog.typing',
  entityType: 'dialog',
  entityId: dialogId,
  data: {
    dialogId,
    userId,
    userInfo: sanitizeResponse({ ...user, meta: userMeta }),
    expiresInMs: DEFAULT_TYPING_EXPIRES_MS,
    timestamp: Date.now()
  }
});
```

## Категории событий и payload'ы

| Категория | `eventType` | `entityType` | Формат `entityId` | Содержимое `data` | Примечания |
| --- | --- | --- | --- | --- | --- |
| Диалоги | `dialog.create`, `dialog.update`, `dialog.delete` | `dialog` | `dlg_*` | Название, мета, опциональные патчи | Некоторые контроллеры (например, `dialogController`) кладут в `data` только изменённые поля, другие — полный срез; `dialogId` иногда дублируется строкой и ObjectId. |
| Участники | `dialog.member.add/remove` | `dialogMember` | `dlg_*:userId` | `userId`, `dialogId`, иногда снапшот участника | Нет единообразия: add передаёт только идентификаторы, remove добавляет `removedMember`. |
| Участники (дельты) | `dialog.member.update` | `dialogMember` | `dialogId:userId` | `unreadCount`, `lastSeenAt`, причина | Event хранит дельту, но `entityType` совпадает с `dialogMember`, а `entityId` — строка `dialogId:userId`; Update Worker позже использует `data.dialogId` для любых операций. |
| Сообщения | `message.create/update/delete` | `message` | `msg_*` | Контент до 4096 символов, `meta`, цитаты, имя диалога | Постоянно передаётся `dialogName`, хотя его можно получить по `dialogId`; payload может быть крупным. |
| Статусы сообщений | `message.status.create/update` | `messageStatus` | `messageId_userId` | `dialogId`, `messageId`, `userId`, `oldStatus/newStatus`, `senderId` | Нет явного поля «причина» (read/delivered), приходится выводить из `newStatus`. |
| Реакции | `message.reaction.*` | `messageReaction` | `messageId_userId_reaction` | `dialogId`, `messageId`, `userId`, `reaction`, `oldReaction`, `reactionCounts` | В `entityId` зашита текущая реакция, поэтому remove события ссылаются на удаляемый символ, а не на запись. |
| Тайпинг | `dialog.typing` | `dialog` | `dlg_*` | `dialogId`, `userId`, `userInfo`, `expiresInMs`, `timestamp` | Единственный event с полем `userInfo`; остальные события не добавляют вложенные объекты акторов. |
| Тенанты | `tenant.*` | `tenant` | `tnt_*` | Название, домен, статус | Эти события почти не используются дальше, но занимают место в enum'е. |

## Наблюдения и расхождения

1. **Разные форматы `entityId`.** Где-то используется «чистый» ID (`dlg_*`, `msg_*`), а где-то составные строки (`messageId_userId_reaction`). Это усложняет индексацию и поиск связанной записи без парсинга строки.
2. **`data` не унифицировано.** В `message.create` есть `dialogName` и `meta`, а в `dialog.member.add` — только `userId`/`dialogId`. Клиентам трудно строить универсальные парсеры, приходится смотреть `eventType`.
3. **Нет единого поля `reason`/`diff`.** Частично роль выполняют `oldStatus/newStatus`, но, например, add/remove событий участников не сообщают «кто выполнил действие» кроме `actorId` и не прикладывают причину.
4. **Дублирование данных.** У событий сообщений всегда прикладывается контент до 4096 символов, даже если событие не про текст (например, `message.delete`). Это увеличивает размер Event коллекции и трафик для Update Worker.
5. **Смешение уровней.** `dialog.typing` хранит `userInfo` вместе с событием, тогда как остальные события ссылаются на `actorId` и предлагают самим подтягивать профиль пользователя. Нет консистентности.
6. **Ограничения enum'ов** в модели требуют релиза при добавлении нового `eventType`, хотя downstream-клиенты уже умеют работать с любыми строками и, возможно, не нуждаются в жёстком перечислении.
7. **Отсутствие версионирования схемы.** Нет поля `schemaVersion` или аналогичного маркера, поэтому любое изменение структуры `data` ломает старых потребителей.

## Идеи по унификации

1. **Ввести нормализованный конверт `data` (аналогично Updates 2.0):**
   ```json
   {
     "context": { "eventId": "...", "dialogId": "...", "reason": "...", "updatedFields": [] },
     "dialog": { ... },
     "message": { ... },
     "member": { ... },
     "actor": { "id": "...", "type": "user" }
   }
   ```
   Тогда Update Worker и внешние подписчики смогут извлекать данные без `switch` по `eventType`.

2. **Стандартизировать `entityId`.** Например, хранить «нативный» ID сущности (`msg_*`, `dlg_*`, `usr_*`), а дополнительные ключи (userId, reaction) переносить в `data.context`. Это упростит поиск и ссылки.

3. **Добавить `reason` и `schemaVersion` в каждое событие.** Причина позволит легко фильтровать события одного типа (например, `reason: message_read`), а версия поможет клиентам адаптироваться к изменениям.

4. **Минимизировать избыточные поля.** Для `message.create` можно хранить `contentHash` + `preview`, а полный текст держать в самом сообщении; для `dialog.typing` хранить только `userId`, а `userInfo` доставать в Update Worker (как сейчас делается для сообщений).

5. **Автоматизировать сбор diff'ов.** Вместо ручного формирования `data` в каждом контроллере можно передавать «изменённый объект» в `createEvent`, а утилита будет строить unified payload (старые/новые значения, список полей). Это гарантирует консистентность данных и снижает вероятность ошибок в контроллерах.

Такой подход поставит события и апдейты на одну «рельсу» и сделает дальнейшее расширение (новые типы сообщений, кастомные события) предсказуемым и безопасным для всех потребителей.

