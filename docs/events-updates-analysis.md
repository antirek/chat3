# Анализ типов Events и Updates

## Таблица типов Events

| Тип события | Описание | Используется | Где создается | Создает Update | Комментарий |
|------------|----------|--------------|---------------|----------------|-------------|
| `dialog.create` | Создан диалог | ✅ Да | `dialogController.create` | ✅ DialogUpdate | Активно используется |
| `dialog.update` | Обновлен диалог | ❌ Нет | - | ✅ DialogUpdate | **Не используется, можно удалить** |
| `dialog.delete` | Удален диалог | ✅ Да | `dialogController.delete` | ✅ DialogUpdate | Активно используется |
| `message.create` | Создано сообщение | ✅ Да | `messageController.create` | ✅ MessageUpdate | Активно используется |
| `message.update` | Обновлено сообщение | ✅ Да | `messageController.update` | ✅ MessageUpdate | Используется для редактирования сообщений |
| `message.delete` | Удалено сообщение | ❌ Нет | - | ✅ MessageUpdate | **Не используется, можно удалить** |
| `dialog.member.add` | Добавлен участник диалога | ✅ Да | `dialogMemberController.addMember` | ✅ DialogUpdate | Активно используется |
| `dialog.member.remove` | Удален участник диалога | ✅ Да | `dialogMemberController.removeMember` | ✅ DialogUpdate | Активно используется |
| `dialog.member.update` | Обновлен участник диалога | ✅ Да | `userDialogController.updateMessageStatus`, `messageStatusController.update`, `dialogMemberController.updateMember` | ✅ DialogMemberUpdate | Используется для обновления unreadCount, lastSeenAt |
| `message.status.update` | Обновлен статус сообщения | ✅ Да | `userDialogController.updateMessageStatus`, `messageStatusController.update` | ✅ MessageUpdate | Активно используется (объединено с message.status.create, так как статусы теперь история) |
| `message.reaction.update` | Обновлена реакция на сообщение | ✅ Да | `messageReactionController.setOrUnsetReaction` (action=set/unset) | ✅ MessageUpdate | Активно используется (объединено с message.reaction.add и message.reaction.remove) |
| `dialog.typing` | Пользователь печатает в диалоге | ✅ Да | `typingController.setTyping` | ✅ TypingUpdate | Активно используется |


## Таблица типов Updates

Updates создаются автоматически на основе событий через `updateUtils.js`. Типы Updates определяются функцией `getUpdateTypeFromEventType()`:

| Тип Update | События-источники | Получатели | Комментарий |
|-----------|-------------------|------------|-------------|
| `DialogUpdate` | `dialog.create`, `dialog.update`, `dialog.delete`, `dialog.member.add`, `dialog.member.remove` | Все участники диалога | Создается для всех активных участников |
| `DialogMemberUpdate` | `dialog.member.update` | Конкретный участник диалога | Создается только для одного пользователя |
| `MessageUpdate` | `message.create`, `message.update`, `message.delete`, `message.reaction.update`, `message.status.update` | Все участники диалога | Создается для всех активных участников |
| `TypingUpdate` | `dialog.typing` | Все участники диалога (кроме инициатора) | Создается для всех активных участников кроме того, кто печатает |

## Анализ и рекомендации по оптимизации

### 1. События, которые можно удалить

#### `dialog.update`
- **Статус**: Не используется нигде в коде
- **Рекомендация**: Удалить из enum в `Event.js`
- **Риск**: Низкий, так как не используется

#### `message.delete`
- **Статус**: Не используется нигде в коде
- **Рекомендация**: Удалить из enum в `Event.js`
- **Риск**: Низкий, так как не используется

#### ~~`message.reaction.add` и `message.reaction.remove`~~ ✅ Объединено
- **Статус**: ✅ Объединено в `message.reaction.update`
- **Решение**: После анализа выяснилось, что различие между add и remove не критично. В данных события всегда есть `reaction` и `oldReaction`, что позволяет определить тип операции:
  - `reaction !== null && oldReaction === null` → добавление
  - `reaction === null && oldReaction !== null` → удаление
- **Статус**: ✅ Выполнено

#### `tenant.create`, `tenant.update`, `tenant.delete`
- **Статус**: Не используются нигде в коде
- **Рекомендация**: Удалить из enum в `Event.js`
- **Обоснование**: События для tenant не создаются, управление tenant происходит через control-api
- **Риск**: Низкий, так как не используются

### 2. События, требующие внимания

#### ~~`message.status.update` vs `message.status.create`~~ ✅ Объединено
- **Текущая ситуация**: ✅ Объединено в `message.status.update`
- **Решение**: После рефакторинга MessageStatus в историю, различие между create и update стало менее значимым. Всегда используется `message.status.update`, информация о первом создании доступна через `oldStatus === null` в данных события
- **Статус**: ✅ Выполнено

### 3. Оптимизации структуры Updates

#### Избыточность данных в Updates
- **Проблема**: В каждом Update дублируются данные диалога и участника для каждого пользователя
- **Рекомендация**: Рассмотреть возможность ссылочной структуры или кэширования
- **Приоритет**: Низкий (оптимизация производительности)

#### TypingUpdate
- **Текущая ситуация**: Создается для всех участников кроме инициатора
- **Рекомендация**: Оставить как есть, логика корректна
- **Приоритет**: Нет изменений

### 4. Проблемы с данными в событиях

#### `message.reaction.add` - несоответствие counts и reactionSet
- **Проблема**: В событии используется `message.reactionCounts`, который может не соответствовать реальному `reactionSet`
- **Решение**: ✅ Исправлено - теперь используется `updateReactionCounts()` для пересчета всех счетчиков
- **Статус**: Исправлено

## Итоговые рекомендации

### Немедленные действия (низкий риск)

1. **✅ Удалено неиспользуемых типов событий из enum:**
   - ✅ `tenant.create` - удалено
   - ✅ `tenant.update` - удалено
   - ✅ `tenant.delete` - удалено

2. **Осталось удалить неиспользуемые типы событий:**
   - `dialog.update`
   - `message.delete`
   - `message.reaction.update`

3. **Обновить документацию** после удаления оставшихся типов

### Среднесрочные улучшения

1. ✅ **Пересмотреть логику `message.status.update` vs `message.status.create`**
   - ✅ Объединено в `message.status.update` с учетом того, что статусы теперь история

2. **Добавить валидацию** при создании событий, чтобы предотвратить использование удаленных типов

### Долгосрочные оптимизации

1. **Оптимизация структуры Updates** для уменьшения дублирования данных
2. **Мониторинг использования** событий для выявления неиспользуемых типов в будущем

## Статистика использования

- **Всего типов событий**: 12 (было 18)
- **Активно используется**: 9 (75%)
- **Не используется**: 3 (25%)
- **Удалено**: 4 типа (tenant.create, tenant.update, tenant.delete, message.status.create)
- **Объединено**: 
  - message.status.create → message.status.update
  - message.reaction.add + message.reaction.remove → message.reaction.update
- **Осталось удалить**: 3 типа (dialog.update, message.delete, message.reaction.update - уже не используется, можно удалить из enum)

## Детальный анализ неиспользуемых событий

### `dialog.update`
- **Где упоминается**: 
  - Enum в `Event.js` (строка 26)
  - Описание в `Event.js` (строка 98)
  - В `updateUtils.js` в массиве `DIALOG_UPDATE_EVENTS` (строка 13)
  - В тестах `eventUtils.test.js` (используется только для тестирования)
  - В `api-test-user-dialogs.html` и `api-test-events-updates.html` (отображение в UI)
- **Где создается**: Нигде
- **Действие**: Удалить из enum, массивов и UI

### `message.delete`
- **Где упоминается**: 
  - Enum в `Event.js` (строка 30)
  - Описание в `Event.js` (строка 102)
  - В `updateUtils.js` в массиве `MESSAGE_UPDATE_EVENTS` (строка 26)
  - В `updateUtils.js` в функции `createMessageUpdate` (строка 444)
  - В `api-test-user-dialogs.html` и `api-test-events-updates.html` (отображение в UI)
- **Где создается**: Нигде
- **Действие**: Удалить из enum, массивов и UI

### `message.reaction.update`
- **Где упоминается**: 
  - Enum в `Event.js` (строка 37)
  - Описание в `Event.js` (строка 109)
  - В `updateUtils.js` в массиве `MESSAGE_UPDATE_EVENTS` (строка 28)
  - В `api-test-user-dialogs.html` и `api-test-events-updates.html` (отображение в UI)
- **Где создается**: Нигде
- **Действие**: Удалить из enum, массивов и UI

### ~~`tenant.create`, `tenant.update`, `tenant.delete`~~ ✅ Удалено
- **Где упоминалось**: 
  - Enum в `Event.js` (строки 40-42) ✅ Удалено
  - Описание в `Event.js` (строки 112-114) ✅ Удалено
  - В `api-test-user-dialogs.html` (отображение в UI) ✅ Удалено
- **Где создавалось**: Нигде
- **Статус**: ✅ Удалено из всех мест
- **Примечание**: Управление tenant происходит через `control-api`, события не создаются

## Файлы, требующие изменений при удалении событий

1. **`src/models/operational/Event.js`**
   - ✅ Удалено из enum: `tenant.create`, `tenant.update`, `tenant.delete` (строки 40-42)
   - ✅ Удалено описания из `typeDescriptions` (строки 112-114)
   - Осталось удалить из enum: `dialog.update` (строка 26), `message.delete` (строка 30), `message.reaction.update` (строка 37)
   - Осталось удалить описания: строки 98, 102, 109

2. **`src/utils/updateUtils.js`**
   - Удалить `dialog.update` из `DIALOG_UPDATE_EVENTS` (строка 13)
   - Удалить `message.delete` из `MESSAGE_UPDATE_EVENTS` (строка 26)
   - Удалить `message.reaction.update` из `MESSAGE_UPDATE_EVENTS` (строка 28)
   - Обновить условие в `createMessageUpdate` (строка 444) - убрать `message.delete`

3. **`src/apps/api-test/public/api-test-user-dialogs.html`**
   - ✅ Удалено `tenant.create`, `tenant.update`, `tenant.delete` из объектов `eventTypeLabels` (строки 4430-4432, 5431-5433)
   - Осталось удалить: `dialog.update` (строки 4416, 5417), `message.delete` (строки 4420, 5424), `message.reaction.update` (строки 4427, 5428)

4. **`src/apps/api-test/public/api-test-events-updates.html`**
   - Проверить наличие упоминаний и удалить при необходимости

5. **`src/apps/tenant-api/utils/__tests__/eventUtils.test.js`**
   - Обновить тесты, использующие `dialog.update` (если есть)

## Примечания

- Все Updates создаются автоматически на основе Events через `updateUtils.js`
- Updates публикуются в RabbitMQ с routing key `user.{userType}.{userId}.{updateType}`
- Events публикуются в RabbitMQ с routing key `{eventType}.{tenantId}`
- При удалении типов событий необходимо убедиться, что они не используются в существующих данных БД (если есть старые события)

