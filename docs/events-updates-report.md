# Анализ системы Events и Updates

**Версия документа:** 0.0.14  
**Последнее обновление:** 2025-01-04

## 📊 Общая статистика

| Показатель | Значение |
|-----------|----------|
| **Всего типов событий** | 14 |
| **Активно используется** | 14 (100%) |
| **Типов Updates** | 5 |
| **Событий на Update** | 1:1 (DialogUpdate, UserUpdate), 1:N (MessageUpdate, DialogMemberUpdate, UserStatsUpdate) |

---

## 📋 Таблица типов Events

| Тип события | Описание | Где создается | Создает Update | Получатели |
|------------|----------|--------------|----------------|------------|
| `dialog.create` | Создан диалог | `dialogController.create` | `DialogUpdate` | Все участники |
| `dialog.update` | Обновлен диалог | `metaController.setMeta/deleteMeta` (для диалогов) | `DialogUpdate` | Все участники |
| `dialog.delete` | Удален диалог | `dialogController.delete` | `DialogUpdate` | Все участники |
| `message.create` | Создано сообщение | `messageController.create` | `MessageUpdate` | Все участники |
| `message.update` | Обновлено сообщение | `messageController.update`, `metaController.setMeta/deleteMeta` (для сообщений) | `MessageUpdate` | Все участники |
| `dialog.member.add` | Добавлен участник | `dialogMemberController.addMember`, `dialogController.create` (при создании диалога с участниками) | `DialogUpdate`, `UserStatsUpdate` | Все участники + UserStatsUpdate для добавленного |
| `dialog.member.remove` | Удален участник | `dialogMemberController.removeMember` | `DialogUpdate`, `UserStatsUpdate` | Все участники + удаляемый + UserStatsUpdate для удаленного |
| `dialog.member.update` | Обновлен участник | `userDialogController.updateMessageStatus`, `dialogMemberController.updateMember`, `metaController.setMeta/deleteMeta` (для участников) | `DialogMemberUpdate`, `UserStatsUpdate` (если изменился unreadCount) | Только этот участник | Изменение unreadCount, lastSeenAt или мета-тегов |
| `message.status.update` | Обновлен статус | `userDialogController.updateMessageStatus` | `MessageUpdate`, `UserStatsUpdate` (если диалог стал прочитанным) | Все участники + UserStatsUpdate для пользователя, если диалог стал прочитанным |
| `message.reaction.update` | Обновлена реакция | `messageReactionController.setOrUnsetReaction` | `MessageUpdate` | Все участники |
| `dialog.typing` | Пользователь печатает | `typingController.setTyping` | `TypingUpdate` | Все участники (кроме инициатора) |
| `user.add` | Добавлен пользователь | `userController.createUser` | `UserUpdate` | Только этот пользователь |
| `user.update` | Обновлен пользователь | `userController.updateUser` (при изменении type), `metaController.setMeta/deleteMeta` (для пользователей) | `UserUpdate` | Только этот пользователь | Изменение type или мета-тегов |
| `user.remove` | Удален пользователь | `userController.deleteUser` | `UserUpdate` | Только этот пользователь |

---

## 📦 Структура секций в Events и Updates

### Секции Events (в поле `data`)

| Тип события | Секции в Event.data | Описание |
|------------|---------------------|----------|
| `dialog.create` | `context`, `dialog` | Контекст события, данные диалога |
| `dialog.update` | `context`, `dialog` | Контекст события, обновленные данные диалога |
| `dialog.delete` | `context`, `dialog` | Контекст события, данные удаляемого диалога |
| `message.create` | `context`, `dialog`, `message` | Контекст события, данные диалога, полное сообщение (без attachments, без statuses) |
| `message.update` | `context`, `dialog`, `message` | Контекст события, данные диалога, обновленное сообщение |
| `dialog.member.add` | `context`, `dialog`, `member` | Контекст события, данные диалога, данные добавляемого участника |
| `dialog.member.remove` | `context`, `dialog`, `member` | Контекст события, данные диалога, данные удаляемого участника |
| `dialog.member.update` | `context`, `dialog`, `member` | Контекст события, данные диалога, обновленные данные участника |
| `message.status.update` | `context`, `dialog`, `message` | Контекст события, данные диалога, данные сообщения со статусом (statusUpdate, statusMessageMatrix, meta) |
| `message.reaction.update` | `context`, `dialog`, `message` | Контекст события, данные диалога, данные сообщения с реакцией (reactionUpdate, reactionSet) |
| `dialog.typing` | `context`, `dialog`, `typing` | Контекст события, данные диалога, данные о печатании |
| `user.add` | `context`, `user` | Контекст события, данные пользователя (userId, type, meta, stats) |
| `user.update` | `context`, `user` | Контекст события, обновленные данные пользователя (userId, type, meta, stats) |
| `user.remove` | `context`, `user` | Контекст события, данные удаляемого пользователя (userId, type, meta) |

**Примечания:**
- `context` - всегда присутствует, содержит метаданные события (eventType, dialogId, entityId, includedSections, updatedFields)
- `dialog` - данные диалога (dialogId, tenantId, createdAt, meta). **Поля `name` и `createdBy` удалены из модели Dialog**
- `member` - данные участника диалога (userId, meta, state: {unreadCount, lastSeenAt, lastMessageAt, isActive})
- `message` - данные сообщения (messageId, dialogId, senderId, type, content, meta, statusUpdate, reactionUpdate, statusMessageMatrix)
- `typing` - данные о печатании (userId, expiresInMs, timestamp, userInfo)
- `user` - данные пользователя (userId, type, meta, stats: {dialogCount, unreadDialogsCount})
- `actor` - **убрана из всех событий** (информация об инициаторе доступна в корне Event: `event.actorId`, `event.actorType`)

### Секции Updates (в поле `data`)

| Тип Update | Секции в Update.data | Описание |
|-----------|---------------------|----------|
| **DialogUpdate** | `context`, `dialog` (опционально `member`) | Контекст события, данные диалога. `member` только если присутствует в event.data (для `dialog.member.add/remove`) |
| **DialogMemberUpdate** | `context`, `dialog`, `member` | Контекст события, данные диалога, обновленные данные конкретного участника (берется из event.data) |
| **MessageUpdate** | `context`, `dialog`, `message` | Контекст события, данные диалога, данные сообщения. `member` секция не добавляется |
| **TypingUpdate** | `context`, `dialog`, `typing` (опционально `member`) | Контекст события, данные диалога, данные о печатании. `member` только если присутствует в event.data |
| **UserUpdate** | `context`, `user` | Контекст события, данные пользователя (userId, type, meta, stats). Используется для событий `user.add`, `user.update`, `user.remove` |
| **UserStatsUpdate** | `context`, `user` | Контекст события, данные пользователя со статистикой (userId, type, meta, stats: {dialogCount, unreadDialogsCount}). Создается в update-worker при изменении статистики |

**Примечания:**
- `context` - всегда присутствует, содержит метаданные события
- `dialog` - данные диалога (берется из event.data для оптимизации)
- `member` - данные участника (берется из event.data, если присутствует). **Не строится в update-worker**, добавляется только если есть в event.data
- `message` - данные сообщения (может быть полным или содержать только изменения: statusUpdate, reactionUpdate, statusMessageMatrix)
- `typing` - данные о печатании (временное уведомление)
- `user` - данные пользователя (userId, type, meta, stats). Для UserStatsUpdate статистика пересчитывается в update-worker

### Детальное описание секций

#### Секция `context`
```javascript
{
  version: 2,
  eventType: 'message.create',
  dialogId: 'dlg_...',
  entityId: 'msg_...',
  messageId: 'msg_...', // опционально
  includedSections: ['dialog', 'message'],
  updatedFields: ['message']
}
```

#### Секция `dialog`
```javascript
{
  dialogId: 'dlg_...',
  tenantId: 'tnt_...',
  createdAt: 1234567890.123456,
  meta: { /* мета-теги диалога */ }
}
```
**Примечания:**
- Поля `name` и `createdBy` удалены из модели Dialog
- Поле `updatedAt` удалено из всех моделей

#### Секция `member`
```javascript
{
  userId: 'user_id',
  meta: { /* мета-теги участника */ },
  state: {
    unreadCount: 5,
    lastSeenAt: 1234567890.123456,
    lastMessageAt: 1234567890.123456,
    isActive: true
  }
}
```

#### Секция `message`
```javascript
{
  messageId: 'msg_...',
  dialogId: 'dlg_...',
  senderId: 'user_id',
  type: 'internal.text',
  content: 'Message text',
  meta: { /* мета-теги сообщения */ },
  // Опционально для message.status.update:
  statusUpdate: { userId, status, oldStatus },
  statusMessageMatrix: [ /* матрица статусов других пользователей */ ],
  // Опционально для message.reaction.update:
  reactionUpdate: { userId, reaction, oldReaction, reactionSet }
}
```
**Примечания:**
- `statusUpdate` присутствует только в `message.status.update` (не добавляется если `null`)
- `reactionUpdate` присутствует только в `message.reaction.update` (не добавляется если `null`)
- `statusMessageMatrix` - матрица статусов, исключающая статусы отправителя сообщения

#### Секция `typing`
```javascript
{
  userId: 'user_id',
  expiresInMs: 5000,
  timestamp: 1234567890,
  userInfo: { /* информация о пользователе */ }
}
```

#### Секция `user`
```javascript
{
  userId: 'user_id',
  type: 'user', // 'user' | 'bot' | 'contact'
  meta: { /* мета-теги пользователя */ },
  stats: { // опционально, только для UserStatsUpdate
    dialogCount: 5,
    unreadDialogsCount: 2
  }
}
```

#### Секция `actor` (удалена)
**Примечание:** Секция `actor` полностью удалена из всех событий. Информация об инициаторе доступна в корне Event:
- `event.actorId` - ID инициатора
- `event.actorType` - тип инициатора ('user' | 'bot' | 'api' | 'system')

---

## 🔄 Типы Updates и их источники

| Тип Update | События-источники | Получатели | Особенности |
|-----------|-------------------|------------|-------------|
| **DialogUpdate** | `dialog.create`, `dialog.update`, `dialog.delete`, `dialog.member.add`, `dialog.member.remove` | Все активные участники диалога | При `dialog.member.remove` также создается для удаляемого пользователя |
| **DialogMemberUpdate** | `dialog.member.update` | Только конкретный участник | Персонализированный update для одного пользователя |
| **MessageUpdate** | `message.create`, `message.update`, `message.status.update`, `message.reaction.update` | Все активные участники диалога | Может содержать полное сообщение или только изменения (status/reaction) |
| **TypingUpdate** | `dialog.typing` | Все участники кроме инициатора | Временное событие с expiresInMs |
| **UserUpdate** | `user.add`, `user.update`, `user.remove` | Только этот пользователь | Обновления данных пользователя (type, meta) |
| **UserStatsUpdate** | Создается в update-worker на основе `dialog.member.add`, `dialog.member.remove`, `dialog.member.update`, `message.create`, `message.status.update` | Только этот пользователь | Пересчитывает статистику (dialogCount, unreadDialogsCount) при изменении |

---

## 🔗 Маппинг событий на Updates

### DialogUpdate Events
```javascript
DIALOG_UPDATE_EVENTS = [
  'dialog.create',
  'dialog.update',
  'dialog.delete',
  'dialog.member.add',
  'dialog.member.remove'
]
```

### DialogMemberUpdate Events
```javascript
DIALOG_MEMBER_UPDATE_EVENTS = [
  'dialog.member.update'
]
```

### MessageUpdate Events
```javascript
MESSAGE_UPDATE_EVENTS = [
  'message.create',
  'message.update',
  'message.reaction.update',
  'message.status.update'
]
```

### TypingUpdate Events
```javascript
TYPING_EVENTS = [
  'dialog.typing'
]
```

### UserUpdate Events
```javascript
USER_UPDATE_EVENTS = [
  'user.add',
  'user.update',
  'user.remove'
]
```

**Примечание:** `UserStatsUpdate` создается в update-worker, а не на основе событий. Он генерируется автоматически при:
- `dialog.member.add` - увеличивается `dialogCount`
- `dialog.member.remove` - уменьшается `dialogCount`
- `dialog.member.update` с изменением `unreadCount` - изменяется `unreadDialogsCount` (если диалог переходит через 0: прочитан ↔ непрочитан)
- `message.create` когда диалог становится непрочитанным (unreadCount 0 → 1) - увеличивается `unreadDialogsCount`
- `message.status.update` когда диалог становится прочитанным (unreadCount > 0 → 0) - уменьшается `unreadDialogsCount`

---

## ⚡ Поток обработки

```
1. Контроллер создает Event → MongoDB
2. Event публикуется в RabbitMQ (асинхронно)
3. Update Worker подписывается на события
4. Update Worker вызывает соответствующую функцию create*Update()
5. Update создается для каждого получателя → MongoDB
6. Update публикуется в RabbitMQ с routing key: update.{category}.{userType}.{userId}.{updateType}
```

**Routing Keys:**
- `update.dialog.{userType}.{userId}.{updateType}` - для DialogUpdate, DialogMemberUpdate, MessageUpdate, TypingUpdate
- `update.user.{userType}.{userId}.{updateType}` - для UserUpdate, UserStatsUpdate

**Примеры:**
- `update.dialog.user.usr_123.dialogupdate` - DialogUpdate для пользователя usr_123
- `update.user.user.usr_123.userupdate` - UserUpdate для пользователя usr_123
- `update.user.bot.bot_456.userstatsupdate` - UserStatsUpdate для бота bot_456

---

## 📝 Дополнительные примечания

### UserStatsUpdate

`UserStatsUpdate` создается автоматически в `update-worker` при следующих условиях:

1. **При добавлении участника в диалог** (`dialog.member.add`):
   - Увеличивается `dialogCount` для добавленного пользователя
   - Создается `UserStatsUpdate` с `updatedFields: ['user.stats.dialogCount']`

2. **При удалении участника из диалога** (`dialog.member.remove`):
   - Уменьшается `dialogCount` для удаленного пользователя
   - Создается `UserStatsUpdate` с `updatedFields: ['user.stats.dialogCount']`

3. **При изменении unreadCount** (`dialog.member.update` с `updatedFields` содержащим `'member.state.unreadCount'`):
   - Изменяется `unreadDialogsCount` (если диалог переходит через 0: прочитан ↔ непрочитан)
   - Создается `UserStatsUpdate` с `updatedFields: ['user.stats.unreadDialogsCount']`

4. **При создании сообщения** (`message.create`):
   - Если диалог становится непрочитанным для пользователя (unreadCount был 0, стал 1)
   - Увеличивается `unreadDialogsCount`
   - Создается `UserStatsUpdate` с `updatedFields: ['user.stats.unreadDialogsCount']`

5. **При обновлении статуса сообщения** (`message.status.update`):
   - Если диалог становится прочитанным для пользователя (unreadCount > 0 → 0)
   - Уменьшается `unreadDialogsCount`
   - Создается `UserStatsUpdate` с `updatedFields: ['user.stats.unreadDialogsCount']`

**Важно:** `UserStatsUpdate` не создается в контроллерах, а только в `update-worker` для обеспечения консистентности статистики.
