# События и счетчики

Документ описывает, какие события приводят к изменению каких счетчиков в системе Chat3.

## Таблица событий и счетчиков

| Событие | Источник | Счетчики, которые обновляются | Функция обновления | Примечание |
|---------|----------|-------------------------------|-------------------|------------|
| `dialog.create` | `dialogController.create` | — | — | Событие создается, но счетчики пользователей не обновляются |
| `dialog.member.add` | `dialogController.create`<br>`dialogMemberController.addDialogMember` | `UserStats.dialogCount` (+1) | `updateUserStatsDialogCount` | Обновляется только для добавленного пользователя. Создается `user.stats.update` с `sourceEventId` от `dialog.member.add` |
| `dialog.member.remove` | `dialogMemberController.removeDialogMember` | `UserStats.dialogCount` (-1) | `updateUserStatsDialogCount` | Обновляется только для удаленного пользователя |
| `dialog.member.update` | `dialogMemberController.setUnreadCount` | `UserDialogStats.unreadCount` (delta)<br>`UserStats.unreadDialogsCount` (пересчет)<br>`UserStats.totalUnreadCount` (пересчет) | `updateUnreadCount`<br>`updateUserStatsFromUnreadCount` | При изменении `unreadCount` пересчитываются агрегатные счетчики в `UserStats` |
| `message.create` | `messageController.create` | **Для отправителя:**<br>`UserStats.totalMessagesCount` (+1)<br><br>**Для получателей (кроме отправителя):**<br>`UserDialogStats.unreadCount` (+1)<br>`UserStats.unreadDialogsCount` (пересчет)<br>`UserStats.totalUnreadCount` (пересчет)<br><br>**Для всех участников:**<br>`UserDialogActivity.lastMessageAt` (обновление) | `updateUserStatsTotalMessagesCount`<br>`updateUnreadCount`<br>`updateUserStatsFromUnreadCount`<br>`updateLastMessageAt` | Для каждого получателя создается `user.stats.update` с `sourceEventId` от `message.create`. Для отправителя также создается `user.stats.update` |
| `message.status.update` | `MessageStatus.post('save')` | `MessageStatusStats.count` (+1) для нового статуса<br><br>**Если статус изменился на 'read':**<br>`UserDialogStats.unreadCount` (-1)<br>`UserStats.unreadDialogsCount` (пересчет)<br>`UserStats.totalUnreadCount` (пересчет) | `updateStatusCount`<br>`updateUnreadCount`<br>`updateUserStatsFromUnreadCount` | Обновление происходит через middleware модели `MessageStatus` |
| `message.reaction.update` | `MessageReaction.post('save')` | `MessageReactionStats.count` (+1) | `updateReactionCount` | Обновление происходит через middleware модели `MessageReaction` при создании реакции |
| `message.reaction.update` | `MessageReaction.post('remove')` | `MessageReactionStats.count` (-1) | `updateReactionCount` | Обновление происходит через middleware модели `MessageReaction` при удалении реакции |

## Детальное описание счетчиков

### UserStats (Статистика пользователя)

| Счетчик | Описание | Источник данных | Обновление |
|---------|----------|-----------------|------------|
| `dialogCount` | Количество диалогов пользователя | `DialogMember.countDocuments` | Инкрементально через `updateUserStatsDialogCount` |
| `unreadDialogsCount` | Количество диалогов с непрочитанными сообщениями | Пересчет из `UserDialogStats` где `unreadCount > 0` | Пересчитывается при изменении `unreadCount` |
| `totalUnreadCount` | Общее количество непрочитанных сообщений | Сумма всех `unreadCount` из `UserDialogStats` | Пересчитывается при изменении `unreadCount` |
| `totalMessagesCount` | Общее количество отправленных сообщений | `Message.countDocuments` по `senderId` | Инкрементально через `updateUserStatsTotalMessagesCount` |

### UserDialogStats (Статистика пользователя по диалогу)

| Счетчик | Описание | Источник данных | Обновление |
|---------|----------|-----------------|------------|
| `unreadCount` | Количество непрочитанных сообщений в диалоге | Инкрементально при создании сообщений, декрементально при прочтении | Через `updateUnreadCount` |

### MessageReactionStats (Статистика реакций на сообщение)

| Счетчик | Описание | Источник данных | Обновление |
|---------|----------|-----------------|------------|
| `count` | Количество реакций определенного типа на сообщение | Инкрементально при создании/удалении реакции | Через `updateReactionCount` в middleware `MessageReaction` |

### MessageStatusStats (Статистика статусов сообщения)

| Счетчик | Описание | Источник данных | Обновление |
|---------|----------|-----------------|------------|
| `count` | Количество статусов определенного типа для сообщения | Инкрементально при создании нового статуса | Через `updateStatusCount` в middleware `MessageStatus` |

## Создание user.stats.update событий

События `user.stats.update` создаются через `finalizeCounterUpdateContext` после обновления счетчиков. Это позволяет:

1. **Батчить обновления** - несколько изменений счетчиков для одного пользователя объединяются в одно событие
2. **Связывать с исходным событием** - `user.stats.update` содержит `sourceEventId` от события, которое вызвало изменение

### Когда создается user.stats.update:

| Исходное событие | Для кого создается | sourceEventId |
|------------------|-------------------|---------------|
| `dialog.member.add` | Добавленный пользователь | `eventId` от `dialog.member.add` |
| `dialog.member.remove` | Удаленный пользователь | `eventId` от `dialog.member.remove` |
| `dialog.member.update` | Пользователь, у которого изменился `unreadCount` | `eventId` от `dialog.member.update` |
| `message.create` | Отправитель (изменение `totalMessagesCount`) | `eventId` от `message.create` |
| `message.create` | Все получатели (изменение `unreadCount`) | `eventId` от `message.create` |
| `message.status.update` | Пользователь, у которого изменился статус на 'read' | `eventId` от `message.status.update` |

## Пересчет счетчиков

Функция `recalculateUserStats(tenantId, userId)` пересчитывает все счетчики пользователя из исходных данных:

- `dialogCount` - из `DialogMember`
- `unreadDialogsCount` - из `UserDialogStats` (количество записей с `unreadCount > 0`)
- `totalUnreadCount` - из `UserDialogStats` (сумма всех `unreadCount`)
- `totalMessagesCount` - из `Message` (количество сообщений по `senderId`)

**Использование:**
- В `seed.js` после создания всех данных
- В скриптах миграции для исправления рассинхронизации
- Для восстановления после ошибок

## Важные замечания

1. **Атомарность операций**: Все обновления счетчиков используют атомарные операции MongoDB (`$inc`, `findOneAndUpdate`) для предотвращения race conditions

2. **Пересчет агрегатных счетчиков**: `unreadDialogsCount` и `totalUnreadCount` пересчитываются из `UserDialogStats` при каждом изменении `unreadCount`, а не обновляются инкрементально. Это гарантирует консистентность данных.

3. **Контекст обновлений**: Используется `CounterUpdateContext` для батчинга нескольких изменений счетчиков в одно событие `user.stats.update`

4. **Middleware обновления**: Реакции и статусы обновляют счетчики через Mongoose middleware (`post('save')`, `post('remove')`), что обеспечивает автоматическое обновление при любых операциях с моделями

