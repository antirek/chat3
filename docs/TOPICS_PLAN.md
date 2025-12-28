# План реализации топиков (Topics) в диалогах

## Описание функциональности

Топики (Topics) - это механизм разделения диалога на тематические подразделы. В одном диалоге может быть несколько топиков, каждый со своими сообщениями.

### Основные концепции:
- **Диалог** может содержать множество **топиков**
- **Сообщение** может быть привязано к топику (опционально, `topicId` может быть `null`)
- При открытии диалога пользователь выбирает топик и видит только сообщения этого топика
- Сообщения без топика (`topicId = null`) отображаются отдельно или в общем списке

---

## Вопросы для уточнения

### 1. Модель данных и идентификация
- [x] **Формат ID топика**: `topic_xxxxxxxxxxxxx` (20 символов) ✅
- [x] **Уникальность**: Топики уникальны в рамках диалога (составной ключ `dialogId + topicId`) ✅
- [x] **Название топика**: Нет поля `name`, только `topicId` ✅
- [x] **Мета-теги**: Топики поддерживают мета-теги (entityType: 'topic') ✅
- [x] **Архивация/удаление**: Не входит в функциональность chat3 ✅

### 2. Создание и управление топиками
- [x] **Кто может создавать топики**: Все участники диалога (проверка через `DialogMember`) ✅
- [x] **Автоматическое создание**: Топики создаются только явно через API ✅
- [x] **Обновление**: Можно обновлять мета-теги топика через `PATCH /api/dialogs/{dialogId}/topics/{topicId}` ✅
- [x] **Удаление**: Запрещено - топики нельзя удалять (защита от потери данных) ✅
- [x] **Архивация**: Не входит в функциональность chat3 ✅

### 3. Сообщения и топики
- [x] **Обязательность топика**: `topicId` опционально, сообщения могут быть без топика (`topicId = null`) ✅
- [x] **Миграция существующих сообщений**: Все существующие сообщения остаются без топика (`topicId = null`) ✅
- [x] **Перемещение сообщений**: Нельзя перемещать сообщения между топиками ✅
- [x] **Поиск**: Поиск через фильтр в `GET /api/dialogs/{dialogId}/messages` по `topicId` ✅

### 4. API и эндпойнты
- [x] **Список топиков**: `GET /api/dialogs/{dialogId}/topics` - список всех топиков диалога ✅
- [x] **Создание топика**: `POST /api/dialogs/{dialogId}/topics` - создание нового топика ✅
- [x] **Получение сообщений**: `GET /api/dialogs/{dialogId}/messages` с фильтром по `topicId` (опционально) ✅
  - Без фильтра - все сообщения диалога (с топиком и без)
  - С фильтром `topicId` - сообщения конкретного топика
  - С фильтром `topicId=null` - сообщения без топика
  - **В каждом сообщении поле `topic`**: `{ topicId: string | null, meta: {...} }` или `null` если топика нет
- [x] **Создание сообщения в топике**: `POST /api/dialogs/{dialogId}/messages` с параметром `topicId` (опционально) ✅
  - **В ответе поле `topic`**: `{ topicId: string | null, meta: {...} }` или `null` если топика нет
- [x] **Обратная совместимость**: Старые эндпойнты `GET /api/dialogs/{dialogId}/messages` возвращают все сообщения диалога (с топиком и без) ✅
- [x] **Список диалогов пользователя**: `GET /api/users/{userId}/dialogs` - добавить фильтры по топикам ✅
  - Фильтр `topicId,eq,{topicId}` - диалоги, содержащие топик с указанным `topicId`
  - Фильтр `topic.meta.{param},eq,{value}` - диалоги, содержащие топики с указанным мета-тегом
- [x] **Сообщения диалога пользователя**: `GET /api/users/{userId}/dialogs/{dialogId}/messages` - добавить фильтр по `topicId` ✅
  - Фильтр `topicId,eq,{topicId}` - сообщения конкретного топика
  - Фильтр `topicId,eq,null` - сообщения без топика
  - Без фильтра - все сообщения диалога (с топиком и без)
  - **В каждом сообщении поле `topic`**: `{ topicId: string | null, meta: {...} }` или `null` если топика нет

### 5. События и обновления
- [x] **События для топиков**: `dialog.topic.create`, `dialog.topic.update` ✅
- [x] **Обновления**: Создавать `Update` для участников диалога при создании/изменении топиков ✅
- [x] **Типы обновлений**: `dialog.topic.add`, `dialog.topic.update` ✅
- [x] **Удаление топиков**: Запрещено - топики нельзя удалять ✅

### 6. Статистика и счетчики
- [x] **UnreadCount по топикам**: Отдельный счетчик непрочитанных для каждого топика ✅
  - Создается отдельная модель `UserTopicStats` для хранения счетчиков по топикам
  - Составной уникальный ключ: `{ tenantId, userId, dialogId, topicId }`
  - Хранит `unreadCount` для каждого топика отдельно
- [x] **Общий unreadCount**: Общий счетчик непрочитанных для диалога (сумма по всем топикам) ✅
  - `UserDialogStats` хранит общий `unreadCount` для диалога
  - При изменении `unreadCount` топика автоматически обновляется общий счетчик диалога
  - Общий счетчик = сумма всех `unreadCount` из `UserTopicStats` для этого диалога
- [x] **DialogStats**: Статистика диалога (количество топиков, участников, сообщений) ✅
  - Создается модель `DialogStats` для хранения счетчиков диалога
  - Поля: `topicCount`, `memberCount`, `messageCount`
  - Обновляется при событиях: `dialog.topic.create`, `dialog.member.add/remove`, `message.create`
  - **ВАЖНО**: `topicCount` только увеличивается, так как удаление топиков запрещено
- [x] **UserStats**: Топики не влияют на общую статистику пользователя (dialogCount, totalMessagesCount) ✅

### 7. Миграция данных
- [x] **Существующие диалоги**: Не требуют миграции ✅
- [x] **Существующие сообщения**: Остаются без топика (`topicId = null`) ✅
- [x] **Скрипт миграции**: Не требуется ✅

---

## Предварительный план реализации

### Этап 1: Модель данных
1. Создать модель `Topic` (`src/models/data/Topic.js`):
   - `topicId` (String, формат `topic_xxxxxxxxxxxxx`, unique, lowercase)
   - `dialogId` (String, ссылка на Dialog, lowercase, required)
   - `tenantId` (String, required)
   - `createdAt` (Number, timestamp, default: generateTimestamp)
   - Индексы:
     - `{ tenantId: 1, dialogId: 1 }` - для получения всех топиков диалога
     - `{ tenantId: 1, dialogId: 1, topicId: 1 }` - уникальность в рамках диалога (compound unique)
     - `{ topicId: 1 }` - для быстрого поиска по topicId
   - Pre-save hook: автоматическая установка `createdAt`

2. Обновить модель `Message`:
   - Добавить поле `topicId` (String, ссылка на Topic, опционально, может быть `null`)
   - Обновить индексы:
     - `{ tenantId: 1, dialogId: 1, topicId: 1, createdAt: -1 }` - для получения сообщений топика (включая `topicId = null`)
     - `{ tenantId: 1, dialogId: 1, createdAt: -1 }` - оставить для обратной совместимости

3. Обновить модель `Meta`:
   - Добавить `'topic'` в enum `entityType` для поддержки мета-тегов топиков
   - Добавить индекс для оптимизации фильтрации по мета-тегам топиков:
     - `{ tenantId: 1, entityType: 1, key: 1, value: 1 }` - для быстрого поиска мета-тегов по значению
     - Используется при фильтрации диалогов по мета-тегам топиков (`topic.meta.{param},eq,{value}`)

4. Создать модель `UserTopicStats` (`src/models/stats/UserTopicStats.js`):
   - `tenantId` (String, required)
   - `userId` (String, required)
   - `dialogId` (String, required, lowercase, match: `^dlg_[a-z0-9]{20}$`)
   - `topicId` (String, required, lowercase, match: `^topic_[a-z0-9]{20}$`)
   - `unreadCount` (Number, default: 0, min: 0, required)
   - `lastUpdatedAt` (Number, timestamp, default: generateTimestamp)
   - `createdAt` (Number, timestamp, default: generateTimestamp)
   - Индексы:
     - `{ tenantId: 1, userId: 1, dialogId: 1, topicId: 1 }` (unique) - составной уникальный ключ
     - `{ tenantId: 1, userId: 1, dialogId: 1, unreadCount: 1 }` - для быстрого поиска
     - `{ tenantId: 1, dialogId: 1, topicId: 1 }` - для получения всех пользователей топика
   - Pre-save hook: автоматическая установка `createdAt` и `lastUpdatedAt`
   - **Логика:**
     - Хранит `unreadCount` для конкретного топика
     - При изменении `unreadCount` топика обновляется общий счетчик диалога в `UserDialogStats`
     - Общий `unreadCount` для диалога = сумма всех `unreadCount` из `UserTopicStats` для этого диалога
   - Добавить экспорт в `src/models/index.js`

5. Создать модель `DialogStats` (`src/models/stats/DialogStats.js`):
   - `tenantId` (String, required)
   - `dialogId` (String, required, lowercase, match: `^dlg_[a-z0-9]{20}$`, unique)
   - `topicCount` (Number, default: 0, min: 0, required) - количество топиков в диалоге
   - `memberCount` (Number, default: 0, min: 0, required) - количество участников диалога
   - `messageCount` (Number, default: 0, min: 0, required) - количество сообщений в диалоге
   - `lastUpdatedAt` (Number, timestamp, default: generateTimestamp)
   - `createdAt` (Number, timestamp, default: generateTimestamp)
   - Индексы:
     - `{ tenantId: 1, dialogId: 1 }` (unique) - составной уникальный ключ
     - `{ tenantId: 1, topicCount: 1 }` - для быстрого поиска по количеству топиков
     - `{ tenantId: 1, memberCount: 1 }` - для быстрого поиска по количеству участников
     - `{ tenantId: 1, messageCount: 1 }` - для быстрого поиска по количеству сообщений
   - Pre-save hook: автоматическая установка `createdAt` и `lastUpdatedAt`
   - **Логика обновления:**
     - `topicCount` обновляется при событии `dialog.topic.create` (+1)
     - `memberCount` обновляется при событиях `dialog.member.add` (+1) и `dialog.member.remove` (-1)
     - `messageCount` обновляется при событии `message.create` (+1)
     - **ВАЖНО**: Топики нельзя удалять, поэтому `topicCount` только увеличивается
   - Добавить экспорт в `src/models/index.js`

### Этап 2: Утилиты и базовые функции
1. Создать `src/utils/topicUtils.js`:
   - `generateTopicId()` - генерация ID топика (формат `topic_xxxxxxxxxxxxx`)
   - `getDialogTopics(tenantId, dialogId, options)` - получение списка топиков диалога
     - Сортировка по `createdAt` (по умолчанию ASC)
     - Поддержка пагинации
   - `createTopic(tenantId, dialogId, options)` - создание нового топика
     - Создание мета-тегов, если переданы в `options.meta`
     - Возвращает созданный топик
   - `getTopicById(tenantId, dialogId, topicId)` - получение топика по ID
     - Проверка существования топика в диалоге
   - `updateTopic(tenantId, dialogId, topicId, updates)` - обновление топика
     - Обновление мета-тегов, если переданы
   - `getTopicWithMeta(tenantId, dialogId, topicId)` - получение топика с мета-тегами (для одного топика)
     - Возвращает объект `{ topicId, meta: {...} }`
     - Если топик не найден, возвращает `null`
     - **Обработка ошибок**: Обернуть в try/catch, при ошибке возвращать `null` и логировать
     - Используется для добавления информации о топике в ответы с одним сообщением, события и updates
   - `getTopicsWithMetaBatch(tenantId, dialogId, topicIds)` - получение нескольких топиков с мета-тегами (оптимизация N+1)
     - Параметры: `tenantId`, `dialogId`, `topicIds` (массив уникальных `topicId`, может быть пустым)
     - **Оптимизация N+1 проблемы:**
       - Собрать все уникальные `topicId` из массива (исключить `null`)
       - Загрузить все топики одним запросом: `Topic.find({ tenantId, dialogId, topicId: { $in: topicIds } })`
       - Загрузить все мета-теги одним запросом: `Meta.find({ tenantId, entityType: 'topic', entityId: { $in: topicIds } })`
       - Собрать map `topicId -> { topicId, meta: {...} }` и вернуть его
     - Возвращает `Map<topicId, { topicId, meta: {...} }>` для быстрого доступа
     - Если топик не найден в БД, он не будет в map (можно проверить через `map.has(topicId)`)
     - **Обработка ошибок**: Обернуть в try/catch, при ошибке возвращать пустой Map и логировать
     - Используется для обогащения списков сообщений данными о топиках

2. Обновить `src/utils/counterUtils.js`:
   - **ВАЖНО: Все операции обновления счетчиков должны быть идемпотентными** - использовать `$inc` для атомарного обновления, что позволяет безопасно обрабатывать события повторно без дублирования изменений
   - Обновить `updateUnreadCount()` - добавить параметр `topicId` (опционально)
     - Если `topicId` указан - обновляет `unreadCount` в `UserTopicStats` для конкретного топика
       - Использовать `$inc` для атомарного идемпотентного обновления
     - Если `topicId = null` - обновляет общий `unreadCount` в `UserDialogStats` для диалога
       - Использовать `$inc` для атомарного идемпотентного обновления
     - При изменении `unreadCount` топика автоматически обновляет общий счетчик диалога в `UserDialogStats`
   - Добавить функцию `updateTopicUnreadCount(tenantId, userId, dialogId, topicId, delta, ...)` - обновление `unreadCount` для топика
     - Обновляет `UserTopicStats` для топика через `$inc` (идемпотентная операция)
     - Обновляет общий счетчик в `UserDialogStats` через `$inc` (идемпотентная операция)
     - Использовать `findOneAndUpdate` с `$inc` и `upsert: true` для атомарности
     - **ВАЖНО: При использовании в транзакции передавать session для атомарности обновления обоих счетчиков**
   - Добавить функцию `getTopicUnreadCount(tenantId, userId, dialogId, topicId)` - получение `unreadCount` для топика из `UserTopicStats`
   - Добавить функцию `getDialogUnreadCount(tenantId, userId, dialogId)` - получение общего `unreadCount` для диалога
     - Вариант 1: Суммирует `unreadCount` всех топиков из `UserTopicStats` для этого диалога
     - Вариант 2: Использует запись из `UserDialogStats` (синхронизируется при изменении топиков)
   - Добавить функцию `updateDialogStats(tenantId, dialogId, updates)` - обновление счетчиков диалога
     - Параметры: `{ topicCount?: delta, memberCount?: delta, messageCount?: delta }`
     - Использует `$inc` для атомарного идемпотентного обновления счетчиков
     - Создает запись если не существует (upsert: true)
     - **Идемпотентность**: Повторное выполнение с теми же параметрами не изменит результат
   - Добавить функции для обновления конкретных счетчиков (все используют `$inc` для идемпотентности):
     - `updateDialogTopicCount(tenantId, dialogId, delta)` - обновление `topicCount` через `$inc`
     - `updateDialogMemberCount(tenantId, dialogId, delta)` - обновление `memberCount` через `$inc`
     - `updateDialogMessageCount(tenantId, dialogId, delta)` - обновление `messageCount` через `$inc`
     - Все функции используют `findOneAndUpdate` с `$inc` и `upsert: true` для атомарности и идемпотентности
   - Добавить функцию `recalculateDialogUnreadCount(tenantId, userId, dialogId)` - пересчет общего `unreadCount` для диалога
     - Суммирует все `unreadCount` из `UserTopicStats` для данного диалога
     - Обновляет `UserDialogStats` с пересчитанным значением
     - Используется для восстановления консистентности при рассинхронизации счетчиков
   - Добавить функцию `recalculateDialogStats(tenantId, dialogId)` - пересчет всех счетчиков диалога
     - `topicCount` = `Topic.countDocuments({ tenantId, dialogId })`
     - `memberCount` = `DialogMember.countDocuments({ tenantId, dialogId })`
     - `messageCount` = `Message.countDocuments({ tenantId, dialogId })`
     - Обновляет `DialogStats` с пересчитанными значениями
     - Используется для восстановления консистентности при ошибках обновления счетчиков

### Этап 3: API эндпойнты
1. Создать `src/apps/tenant-api/routes/topicRoutes.js`:
   - `GET /api/dialogs/{dialogId}/topics` - список топиков диалога
     - Параметры: `page`, `limit`, `filter`, `sort`
   - `POST /api/dialogs/{dialogId}/topics` - создание топика
     - Body: `{ meta?: object }`
     - Автоматическое создание мета-тегов, если переданы
     - После создания топика обновляется `DialogStats.topicCount` (+1)
   - `GET /api/dialogs/{dialogId}/topics/{topicId}` - получение топика
     - Включает мета-теги топика
   - `PATCH /api/dialogs/{dialogId}/topics/{topicId}` - обновление топика
     - Body: `{ meta?: object }`
     - Обновление мета-тегов
   - **ВАЖНО**: Эндпойнт `DELETE /api/dialogs/{dialogId}/topics/{topicId}` не создается - удаление топиков запрещено

2. Создать `src/apps/tenant-api/controllers/topicController.js`:
   - `getDialogTopics` - список топиков
     - Проверка прав доступа через `DialogMember`
   - `createTopic` - создание топика
     - Проверка прав доступа через `DialogMember`
     - Проверка существования диалога
     - После создания вызывает `updateDialogTopicCount(tenantId, dialogId, +1)`
   - `getTopic` - получение топика
     - Если топик не найден - вернуть ошибку 404:
       ```json
       {
         "error": "ERROR_NO_TOPIC",
         "message": "Topic not found"
       }
       ```
   - `updateTopic` - обновление топика
     - Если топик не найден - вернуть ошибку 404 с `error: "ERROR_NO_TOPIC"`
   - **ВАЖНО**: Метод `deleteTopic` не создается - удаление топиков запрещено

3. Обновить `src/apps/tenant-api/controllers/dialogController.js`:
   - В `getAll` и `getById` - добавить поле `stats` в ответ
     - `stats: { topicCount, memberCount, messageCount }` из `DialogStats`
     - **Обработка отсутствия DialogStats для существующих диалогов**: Если запись `DialogStats` не найдена, создать ее лениво с пересчитанными значениями:
       - `topicCount` = `Topic.countDocuments({ tenantId, dialogId })`
       - `memberCount` = `DialogMember.countDocuments({ tenantId, dialogId })`
       - `messageCount` = `Message.countDocuments({ tenantId, dialogId })`
       - Использовать `updateDialogStats()` или `recalculateDialogStats()` для создания записи
   - При создании диалога (`create`) - **ВАЖНО: создать запись `DialogStats` сразу после создания диалога атомарно**
     - Использовать транзакцию MongoDB для атомарного создания диалога и `DialogStats`
     - Если создание `DialogStats` упадет, диалог не должен быть создан (откат транзакции)
     - Начальные значения `DialogStats`:
       - `topicCount: 0`
       - `memberCount: members.length` (количество участников, переданных при создании)
       - `messageCount: 0`
     - Использовать функцию `updateDialogStats()` или `DialogStats.create()` внутри транзакции
     - Это гарантирует, что каждый диалог всегда имеет запись `DialogStats`

2. Обновить `messageRoutes.js` и `messageController.js`:
   - Обновить `GET /api/dialogs/{dialogId}/messages` - добавить поддержку фильтра по `topicId`
     - Параметры: `page`, `limit`, `filter`, `sort`
     - Фильтр: `filter=topicId,eq,{topicId}` - сообщения конкретного топика
     - Фильтр: `filter=topicId,eq,null` - сообщения без топика (`topicId = null`)
     - Без фильтра - все сообщения диалога (с топиком и без)
     - **В каждом сообщении добавить поле `topic`**: `{ topicId: string | null, meta: {...} }` или `null`
       - **Оптимизация N+1:** Использовать `getTopicsWithMetaBatch()` для получения всех топиков одним запросом
       - Собрать все уникальные `topicId` из списка сообщений (исключить `null`)
       - Вызвать `getTopicsWithMetaBatch(tenantId, dialogId, topicIds)` один раз
       - Для каждого сообщения:
         - Если `message.topicId` указан - получить топик из map и добавить в ответ
         - Если `message.topicId = null` - поле `topic: null`
       - Это заменяет множественные вызовы `getTopicWithMeta()` для каждого сообщения
   - Обновить `POST /api/dialogs/{dialogId}/messages` - добавить параметр `topicId` в body (опционально)
     - Если `topicId` не указан, сообщение создается без топика (`topicId = null`)
     - **Валидация `topicId`**: Если `topicId` указан, проверить существование топика через `getTopicById()`
       - Если топик не найден или не принадлежит диалогу - вернуть ошибку 404:
         ```json
         {
           "error": "ERROR_NO_TOPIC",
           "message": "Topic not found"
         }
         ```
     - При создании сообщения обновлять `unreadCount` (использовать транзакцию для атомарности):
       - **ВАЖНО: Использовать транзакцию MongoDB для атомарного обновления счетчиков**
       - Для топика (если `topicId` указан) через `updateTopicUnreadCount()` → обновляет `UserTopicStats`
       - Для общего диалога через `updateUnreadCount()` → обновляет `UserDialogStats` (сумма по всем топикам)
       - Если обновление счетчиков упадет, сообщение не должно быть создано (откат транзакции)
     - **Обработка ошибок при получении topic**: Обернуть `getTopicWithMeta()` в try/catch
       - Если получение топика упадет с ошибкой, вернуть `topic: null` вместо падения запроса
       - Логировать ошибки для отладки
     - **В ответе добавить поле `topic`**: `{ topicId: string | null, meta: {...} }` или `null`
       - Для одного сообщения использовать `getTopicWithMeta()` (одиночный запрос)
       - Если `topicId` указан - получить топик через `getTopicWithMeta()` и добавить в ответ
       - Если `topicId = null` - поле `topic: null`

3. Обновить `userDialogRoutes.js` и `userDialogController.js`:
   - Обновить `GET /api/users/{userId}/dialogs` - добавить поддержку фильтров по топикам
     - Фильтр `topicId,eq,{topicId}` - диалоги, содержащие топик с указанным `topicId`
       - Логика: найти все диалоги пользователя, у которых есть топик с указанным `topicId`
       - Запрос: `Topic.find({ tenantId, dialogId: { $in: userDialogIds }, topicId })`
     - Фильтр `topic.meta.{param},eq,{value}` - диалоги, содержащие топики с указанным мета-тегом
       - Логика: найти все топики с указанным мета-тегом, затем найти диалоги пользователя, содержащие эти топики
       - Запрос: `Meta.find({ tenantId, entityType: 'topic', key: '{param}', value })` → получить `entityId` (topicId)
       - Затем: `Topic.find({ tenantId, topicId: { $in: foundTopicIds }, dialogId: { $in: userDialogIds } })`
   - Обновить `GET /api/users/{userId}/dialogs/{dialogId}/messages` - добавить поддержку фильтра по `topicId`
     - Фильтр: `filter=topicId,eq,{topicId}` - сообщения конкретного топика
     - Фильтр: `filter=topicId,eq,null` - сообщения без топика (`topicId = null`)
     - Без фильтра - все сообщения диалога (с топиком и без)
     - Логика аналогична `GET /api/dialogs/{dialogId}/messages`
     - **В каждом сообщении добавить поле `topic`**: `{ topicId: string | null, meta: {...} }` или `null`
       - **Оптимизация N+1:** Использовать `getTopicsWithMetaBatch()` для получения всех топиков одним запросом
       - Собрать все уникальные `topicId` из списка сообщений (исключить `null`)
       - Вызвать `getTopicsWithMetaBatch(tenantId, dialogId, topicIds)` один раз
       - **Обработка ошибок**: Обернуть `getTopicsWithMetaBatch()` в try/catch
         - Если получение топиков упадет с ошибкой, вернуть `topic: null` для всех сообщений вместо падения запроса
         - Логировать ошибки для отладки
       - Для каждого сообщения:
         - Если `message.topicId` указан - получить топик из map и добавить в ответ
         - Если `message.topicId = null` - поле `topic: null`
       - Это заменяет множественные вызовы `getTopicWithMeta()` для каждого сообщения
   - Обновить `GET /api/users/{userId}/dialogs/{dialogId}/messages/{messageId}` - получение одного сообщения
     - **В ответе добавить поле `topic`**: `{ topicId: string | null, meta: {...} }` или `null`
       - Для одного сообщения использовать `getTopicWithMeta()` (одиночный запрос)
       - **Обработка ошибок**: Обернуть `getTopicWithMeta()` в try/catch
         - Если получение топика упадет с ошибкой, вернуть `topic: null` вместо падения запроса
         - Логировать ошибки для отладки
       - Если `topicId` указан - получить топик через `getTopicWithMeta()` и добавить в ответ
       - Если `topicId = null` - поле `topic: null`
   - Обновить `updateMessageStatus` (или соответствующий метод) - обновление статуса сообщения на `read`
     - **ВАЖНО: При изменении статуса сообщения на `read` обновлять счетчики `unreadCount`**
     - Использовать транзакцию MongoDB для атомарного обновления счетчиков
     - Получить `topicId` из сообщения
     - Если `topicId` указан:
       - Уменьшить `unreadCount` в `UserTopicStats` для топика через `updateTopicUnreadCount(tenantId, userId, dialogId, topicId, -1, ...)`
       - Уменьшить общий `unreadCount` в `UserDialogStats` через `updateUnreadCount(tenantId, userId, dialogId, -1, ...)`
     - Если `topicId = null`:
       - Уменьшить общий `unreadCount` в `UserDialogStats` через `updateUnreadCount(tenantId, userId, dialogId, -1, ...)`
     - Если обновление счетчиков упадет, статус сообщения не должен быть обновлен (откат транзакции)

### Этап 4: События и обновления
1. Обновить `src/apps/tenant-api/utils/eventUtils.js`:
   - Обновить функцию `buildMessageSection()` - добавить параметры `topicId` и `topic`
     - Параметры: `topicId?: string | null`, `topic?: { topicId: string, meta: {...} } | null`
     - Добавить в возвращаемый объект:
       - `topicId: string | null` - ID топика сообщения
       - `topic: { topicId: string, meta: {...} } | null` - объект топика с мета-тегами
     - Если `topicId = null`, то `topicId: null` и `topic: null`
     - Если `topicId` указан, но `topic` не передан, получить через `getTopicWithMeta()`

2. Добавить события (в `src/apps/tenant-api/utils/eventUtils.js`):
   - `dialog.topic.create` - создание топика
     - `entityType: 'topic'`
     - `entityId: topicId`
     - `data: { topic: { topicId, dialogId }, dialog: {...} }`
     - Routing Key: `topic.create.{tenantId}`
   - `dialog.topic.update` - обновление топика (мета-теги)
     - `entityType: 'topic'`
     - `entityId: topicId`
     - `data: { topic: {...}, delta: {...} }`
     - Routing Key: `topic.update.{tenantId}`
   - **ВАЖНО**: Событие `dialog.topic.remove` не создается - удаление топиков запрещено
   - Обновить `message.create` - добавить `topicId` в данные события
     - `data: { message: {...}, topic: { topicId } | null, ... }`
     - Если `topicId = null`, то `topic: null`

2. Обновить `update-worker` (`src/apps/update-worker/index.js`):
   - Обработка событий `dialog.topic.create`, `dialog.topic.update`
   - Создание `Update` для участников диалога при создании/изменении топиков
   - Типы обновлений:
     - `dialog.topic.add` - новый топик в диалоге (создается из события `dialog.topic.create`)
     - `dialog.topic.update` - обновление топика (создается из события `dialog.topic.update`)
   - **ВАЖНО**: Обновление `dialog.topic.remove` не создается - удаление топиков запрещено
   - Обновление `DialogStats` при событиях (все операции идемпотентные через `$inc`):
     - `dialog.topic.create` → `updateDialogTopicCount(tenantId, dialogId, +1)`
       - Использует `$inc` - безопасно при повторной обработке события
     - `dialog.member.add` → `updateDialogMemberCount(tenantId, dialogId, +1)`
       - Использует `$inc` - безопасно при повторной обработке события
     - `dialog.member.remove` → `updateDialogMemberCount(tenantId, dialogId, -1)`
       - Использует `$inc` - безопасно при повторной обработке события
     - `message.create` → `updateDialogMessageCount(tenantId, dialogId, +1)`
       - Использует `$inc` - безопасно при повторной обработке события
   - **ВАЖНО**: Все операции обновления счетчиков идемпотентные - повторная обработка события не приведет к дублированию изменений
   - **ВАЖНО**: При создании `MessageUpdate` из событий `message.create`, `message.update`, `message.status.update`, `message.reaction.update`:
     - Для одного сообщения использовать `getTopicWithMeta()` (одиночный запрос)
     - **Обработка ошибок**: Обернуть `getTopicWithMeta()` в try/catch
       - Если получение топика упадет с ошибкой, установить `message.topic: null` вместо падения обработки события
       - Логировать ошибки для отладки
     - Если в событии `message.topicId` указан, получить топик через `getTopicWithMeta()` и добавить в `message.topic`
     - Если `message.topicId = null`, установить `message.topic: null`
     - Это гарантирует, что в Updates всегда есть полная информация о топике с мета-тегами
     - **Примечание**: Если в будущем понадобится батчинг для Updates (обработка нескольких сообщений одновременно), использовать `getTopicsWithMetaBatch()`

### Этап 5: Миграция данных
1. Миграция сообщений не требуется:
   - Существующие сообщения остаются без топика (`topicId = null`)
   - Новые топики создаются только явно через API

2. Создать скрипт миграции для `DialogStats` (`src/scripts/migrate-dialog-stats.js`):
   - Найти все диалоги без записи в `DialogStats`
   - Для каждого диалога создать запись `DialogStats` с пересчитанными значениями:
     - `topicCount` = `Topic.countDocuments({ tenantId, dialogId })`
     - `memberCount` = `DialogMember.countDocuments({ tenantId, dialogId })`
     - `messageCount` = `Message.countDocuments({ tenantId, dialogId })`
   - Использовать `updateDialogStats()` или `recalculateDialogStats()` для создания записей
   - Обработать все tenantId батчами для производительности
   - Логировать прогресс миграции
   - Скрипт должен быть идемпотентным (можно запускать несколько раз без дублирования)

### Этап 6: Тесты
1. Unit тесты для `topicUtils.js` (`src/utils/__tests__/topicUtils.test.js`):
   - Генерация `topicId`
   - Создание топика
   - Получение списка топиков диалога
   - Обновление топика (мета-теги)
   - Получение топика с мета-тегами через `getTopicWithMeta()` (одиночный запрос)
   - **Оптимизация N+1:** Тесты для `getTopicsWithMetaBatch()`:
     - Получение нескольких топиков одним запросом
     - Проверка, что выполняется только 2 запроса к БД (Topic.find + Meta.find) независимо от количества топиков
     - Проверка корректности map результата (ключи = topicId, значения = { topicId, meta })
     - Проверка обработки пустого массива `topicIds`
     - Проверка обработки несуществующих `topicId` (не должны быть в map)
     - Проверка объединения мета-тегов для каждого топика
   - Обработка ошибок

2. Интеграционные тесты для API эндпойнтов (`src/apps/tenant-api/controllers/__tests__/topicController.test.js`):
   - CRUD операции для топиков
   - Проверка мета-тегов
   - Проверка прав доступа (только участники диалога)
   - Обработка ошибок:
     - Получение несуществующего топика - должна вернуться ошибка 404 с `error: "ERROR_NO_TOPIC"`
     - Обновление несуществующего топика - должна вернуться ошибка 404 с `error: "ERROR_NO_TOPIC"`
     - Создание топика в несуществующем диалоге - должна вернуться ошибка 404
     - Создание топика пользователем, не являющимся участником диалога - должна вернуться ошибка 403

3. Тесты для сообщений с топиками (`src/apps/tenant-api/controllers/__tests__/messageController.test.js`):
   - Создание сообщения без `topicId` (`topicId = null`)
   - Создание сообщения с явным `topicId`
   - Создание сообщения с несуществующим `topicId` - должна вернуться ошибка 404 с `error: "ERROR_NO_TOPIC"`
   - Создание сообщения с `topicId` из другого диалога - должна вернуться ошибка 404 с `error: "ERROR_NO_TOPIC"`
   - Получение всех сообщений диалога (без фильтра)
   - Получение сообщений топика (с фильтром `topicId`)
   - Получение сообщений без топика (с фильтром `topicId=null`)
   - Проверка наличия поля `topic` в ответах:
     - Сообщения с топиком должны содержать `topic: { topicId, meta: {...} }`
     - Сообщения без топика должны содержать `topic: null`
     - Мета-теги топика должны корректно отображаться в поле `topic.meta`
   - **Оптимизация N+1:** Проверка использования батчинга при получении списка сообщений:
     - При получении списка сообщений с разными топиками должен выполняться только 2 запроса к БД (Topic.find + Meta.find)
     - Проверка, что `getTopicsWithMetaBatch()` вызывается один раз, а не для каждого сообщения
     - Проверка корректности обогащения всех сообщений данными о топиках
   - Обратная совместимость старых эндпойнтов

4. Тесты для user dialog endpoints (`src/apps/tenant-api/controllers/__tests__/userDialogController.test.js`):
   - Фильтрация диалогов по `topicId` (`GET /api/users/{userId}/dialogs?filter=topicId,eq,{topicId}`)
   - Фильтрация диалогов по мета-тегам топиков (`GET /api/users/{userId}/dialogs?filter=topic.meta.{param},eq,{value}`)
   - Получение сообщений диалога с фильтром по `topicId` (`GET /api/users/{userId}/dialogs/{dialogId}/messages?filter=topicId,eq,{topicId}`)
   - Получение сообщений диалога без топика (`GET /api/users/{userId}/dialogs/{dialogId}/messages?filter=topicId,eq,null`)
   - Проверка наличия поля `topic` в ответах с сообщениями:
     - Сообщения с топиком должны содержать `topic: { topicId, meta: {...} }`
     - Сообщения без топика должны содержать `topic: null`
   - **Оптимизация N+1:** Проверка использования батчинга при получении списка сообщений:
     - При получении списка сообщений с разными топиками должен выполняться только 2 запроса к БД (Topic.find + Meta.find)
     - Проверка, что `getTopicsWithMetaBatch()` вызывается один раз, а не для каждого сообщения
     - Проверка корректности обогащения всех сообщений данными о топиках
   - Обратная совместимость (без фильтров)

5. Тесты для счетчиков unreadCount (`src/utils/__tests__/counterUtils.test.js`):
   - Обновление `unreadCount` для топика в `UserTopicStats`
   - Обновление общего `unreadCount` для диалога в `UserDialogStats`
   - Автоматическое обновление общего счетчика диалога при изменении счетчика топика
   - Идемпотентность обновлений:
     - Повторное выполнение `updateTopicUnreadCount()` с теми же параметрами не изменяет результат
     - Проверка, что повторная обработка события не приводит к дублированию изменений счетчиков
   - Получение `unreadCount` для топика из `UserTopicStats`
   - Получение общего `unreadCount` для диалога (сумма из `UserTopicStats` или из `UserDialogStats`)
   - Синхронизация счетчиков при создании/прочтении сообщений в топиках
   - Обновление счетчиков при изменении статуса сообщения на `read`:
     - Проверка уменьшения `unreadCount` в `UserTopicStats` для топика
     - Проверка уменьшения общего `unreadCount` в `UserDialogStats`
     - Проверка атомарности обновления счетчиков через транзакцию
   - Проверка уникальности записей в `UserTopicStats`
   - Пересчет общего `unreadCount` через `recalculateDialogUnreadCount()`
     - Проверка корректности пересчета при рассинхронизации счетчиков
     - Проверка восстановления консистентности

6. Тесты для DialogStats (`src/utils/__tests__/counterUtils.test.js` или отдельный файл):
   - Обновление `topicCount` при создании топика (+1)
   - Обновление `memberCount` при добавлении/удалении участника
   - Обновление `messageCount` при создании сообщения
   - Атомарность обновлений (проверка `$inc`)
   - Идемпотентность обновлений:
     - Повторное выполнение операции с теми же параметрами не изменяет результат
     - Проверка, что повторная обработка события не приводит к дублированию изменений
   - Создание записи при первом обновлении (upsert)
   - Получение статистики диалога из `DialogStats`
   - Пересчет всех счетчиков через `recalculateDialogStats()`
     - Проверка корректности пересчета при рассинхронизации счетчиков
     - Проверка восстановления консистентности после ошибок
   - **ВАЖНО**: Тесты на удаление топиков не нужны - удаление запрещено

7. Тесты для событий и updates с топиками (`src/apps/tenant-api/utils/__tests__/eventUtils.test.js` и `src/utils/__tests__/updateUtils.test.js`):
   - Проверка наличия `topicId` и `topic` в секции `message` события `message.create`
   - Проверка наличия `topicId` и `topic` в секции `message` события `message.update`
   - Проверка наличия `topicId` и `topic` в секции `message` события `message.status.update`
   - Проверка наличия `topicId` и `topic` в секции `message` события `message.reaction.update`
   - Проверка наличия `topicId` и `topic` в секции `message` Update типа `MessageUpdate`
   - Проверка корректности мета-тегов в `message.topic.meta`
   - Проверка `message.topic: null` для сообщений без топика

---

## Решение: Топики без названий, сообщения без топиков

### Подход: Опциональные топики
**Сообщения могут быть без топика (`topicId = null`), топики создаются только явно**

**Особенности:**
- ✅ Топики не имеют названий, только `topicId` и мета-теги
- ✅ Сообщения могут быть без топика (`topicId = null`)
- ✅ Топики создаются только явно через API
- ✅ Нет автоматического создания топика по умолчанию
- ✅ **Удаление топиков запрещено** - топики нельзя удалять (защита от потери данных)
- ✅ Нет архивации топиков (не входит в функциональность chat3)

**Реализация:**
- При создании сообщения без `topicId` - сообщение создается с `topicId = null`
- Топики создаются только явно через `POST /api/dialogs/{dialogId}/topics`
- Для получения сообщений используется `GET /api/dialogs/{dialogId}/messages` с фильтром по `topicId`
  - Без фильтра - все сообщения диалога
  - С фильтром `topicId` - сообщения конкретного топика
  - С фильтром `topicId=null` - сообщения без топика

---

## Решенные вопросы

1. **Формат ID топика**: `topic_xxxxxxxxxxxxx` (20 символов) ✅
2. **Уникальность**: Топики уникальны в рамках диалога (составной ключ `dialogId + topicId`) ✅
3. **Название топика**: Нет поля `name`, только `topicId` ✅
4. **Топик по умолчанию**: Нет автоматического создания, сообщения могут быть без топика ✅
5. **Удаление топиков**: Запрещено - топики нельзя удалять (защита от потери данных) ✅
6. **Архивация**: Не входит в функциональность chat3 ✅
7. **Обратная совместимость**: Старые эндпойнты возвращают все сообщения диалога (с топиком и без) ✅
8. **Мета-теги**: Топики поддерживают мета-теги (entityType: 'topic') ✅

---

## Следующие шаги

1. Начать реализацию с модели данных (`Topic`, `UserTopicStats`, `DialogStats`)
2. Создать утилиты (`topicUtils.js`, обновить `counterUtils.js`)
3. Реализовать API эндпойнты для топиков
4. Обновить контроллеры сообщений и диалогов
5. Обновить `update-worker` для обработки событий топиков
6. Создать скрипт миграции для `DialogStats`
7. Написать тесты
8. Запустить миграцию для существующих диалогов
