# Реализация архитектуры счетчиков Chat3

## Статус реализации

✅ **Все основные этапы завершены**

## Что реализовано

### ✅ Этап 1: Модели счетчиков

Созданы все модели счетчиков в `src/models/stats/`:

1. **UserStats** (`src/models/stats/UserStats.js`)
   - Коллекция: `userstats`
   - Поля: `dialogCount`, `unreadDialogsCount`, `totalUnreadCount`, `totalMessagesCount`
   - Индексы: уникальный на `{ tenantId, userId }`

2. **UserDialogStats** (`src/models/stats/UserDialogStats.js`)
   - Коллекция: `userdialogstats`
   - Поля: `unreadCount` (перенесено из `DialogMember`)
   - Индексы: уникальный на `{ tenantId, userId, dialogId }`

3. **MessageReactionStats** (`src/models/stats/MessageReactionStats.js`)
   - Коллекция: `messagereactionstats`
   - Поля: `messageId`, `reaction`, `count`
   - Индексы: уникальный на `{ tenantId, messageId, reaction }`

4. **MessageStatusStats** (`src/models/stats/MessageStatusStats.js`)
   - Коллекция: `messagestatusstats`
   - Поля: `messageId`, `status`, `count`
   - Индексы: уникальный на `{ tenantId, messageId, status }`

5. **CounterHistory** (`src/models/operational/CounterHistory.js`)
   - Коллекция: `counterhistory`
   - История всех изменений счетчиков
   - TTL индекс на 90 дней

### ✅ Этап 2: Утилиты для работы со счетчиками

Создан `src/apps/tenant-api/utils/counterUtils.js` с функциями:

**Первичные счетчики:**
- `updateUnreadCount()` - атомарное обновление с `$inc`
- `updateReactionCount()` - атомарное обновление с `$inc`
- `updateStatusCount()` - атомарное обновление с `$inc`

**Вычисляемые счетчики:**
- `updateUserStatsFromUnreadCount()` - обновление `unreadDialogsCount` и `totalUnreadCount`
- `updateUserStatsDialogCount()` - атомарное обновление `dialogCount`
- `updateUserStatsTotalMessagesCount()` - атомарное обновление `totalMessagesCount`
- `recalculateUserStats()` - пересчет всех счетчиков пользователя

**Контекст операций:**
- `CounterUpdateContext` - класс для сбора измененных полей
- `getCounterUpdateContext()` - получение/создание контекста с TTL
- `finalizeCounterUpdateContext()` - завершение контекста и создание `user.stats.update`

**Утилиты:**
- `getMessageReactionCounts()` - получение всех реакций сообщения
- `getMessageStatusCounts()` - получение всех статусов сообщения
- `getCounterHistory()` - получение истории изменений
- `saveCounterHistory()` - сохранение записи в историю

### ✅ Этап 3: Middleware в моделях

**MessageStatus.js:**
- Post-save hook обновляет `MessageStatusStats` и `UserDialogStats.unreadCount`
- Использует новые функции из `counterUtils.js`

**MessageReaction.js:**
- Post-save hook обновляет `MessageReactionStats`
- Post-remove hook обновляет `MessageReactionStats` при удалении

### ✅ Этап 4: Обновление контроллеров

**messageController.js:**
- Использует `updateUnreadCount()` вместо `incrementUnreadCount()`
- Использует `updateUserStatsTotalMessagesCount()` для отправителя
- Использует try-finally для гарантированной финализации контекстов
- Использует возвращаемое значение `eventUtils.createEvent()` для получения `eventId`

**dialogMemberController.js:**
- Использует `updateUserStatsDialogCount()` при добавлении/удалении участников
- Использует try-finally для гарантированной финализации контекстов
- Использует возвращаемое значение `eventUtils.createEvent()` для получения `eventId`

**userDialogController.js:**
- Использует `UserDialogStats` вместо `DialogMember.unreadCount` для получения `unreadCount`
- Фильтрация по `unreadCount` работает через `UserDialogStats`
- Загружает `unreadCount` из `UserDialogStats` для всех диалогов пользователя

### ✅ Этап 5: Обновление update-worker

**update-worker/index.js:**
- Использует `UserDialogStats` вместо `DialogMember` для проверки `unreadCount`
- Создает `user.stats.update` для отправителя при `message.create` (обновление `totalMessagesCount`)

**updateUtils.js:**
- Использует `UserStats` напрямую вместо агрегации `DialogMember`
- Включает поле `totalMessagesCount` в статистику

### ✅ Этап 6: Скрипты миграции и валидации

**migrate-counters.js:**
- Мигрирует `unreadCount` из `dialogmembers` в `userdialogstats`
- Пересчитывает все счетчики с нуля
- Создает записи в `userstats` для всех пользователей
- Создает записи в `messagereactionstats` и `messagestatusstats`
- Валидация миграции

**validate-counters.js:**
- Проверяет консистентность всех счетчиков
- Сравнивает вычисляемые счетчики с агрегацией первичных
- Выводит отчет о несоответствиях

**package.json:**
- Добавлены скрипты: `npm run migrate-counters` и `npm run validate-counters`

### ✅ Этап 10: Тесты

Создан `src/apps/tenant-api/utils/__tests__/counterUtils.test.js`:
- Тесты для всех функций обновления счетчиков
- Тесты для контекста операций
- Тесты для получения счетчиков
- Тесты для валидации консистентности

## Критичные улучшения (реализованы)

1. ✅ **TTL механизм для контекстов** - автоматическое удаление контекстов старше 5 минут
2. ✅ **Try-finally блоки** - гарантированная финализация контекстов во всех контроллерах
3. ✅ **Атомарные операции** - все функции используют `findOneAndUpdate` с `$inc`
4. ✅ **Оптимизация получения eventId** - используется возвращаемое значение `createEvent()`
5. ✅ **Защита от отрицательных значений** - `Math.max(0, ...)` для `totalUnreadCount`

## Что осталось сделать (опционально)

1. **Удалить поле `unreadCount` из `DialogMember`**
   - После успешной миграции и тестирования
   - Требует обновления всех мест, где используется `DialogMember.unreadCount`

2. **Обновить документацию API**
   - Добавить описание новых endpoints для счетчиков
   - Обновить примеры ответов

3. **Дополнительные тесты**
   - Интеграционные тесты для полного цикла обновления счетчиков
   - Тесты производительности

## Использование

### Миграция данных

```bash
npm run migrate-counters
```

### Валидация счетчиков

```bash
npm run validate-counters
```

### Запуск тестов

```bash
npm test -- src/apps/tenant-api/utils/__tests__/counterUtils.test.js
```

## Важные замечания

1. **Поле `unreadCount` в `DialogMember`** пока не удалено - это сделано для обратной совместимости во время миграции
2. **Все обновления счетчиков атомарны** - используются операции `$inc` для предотвращения race conditions
3. **Контекст операций** автоматически очищается через TTL (5 минут)
4. **История изменений** автоматически удаляется через 90 дней (TTL индекс)

## Следующие шаги

1. Запустить миграцию данных: `npm run migrate-counters`
2. Проверить валидацию: `npm run validate-counters`
3. Протестировать в dev окружении
4. После успешного тестирования удалить поле `unreadCount` из `DialogMember`

