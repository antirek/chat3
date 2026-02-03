# План реализации концепции Pack

## Обзор

Реализация Pack (виртуальный диалог из нескольких диалогов) разбита на 5 этапов с постепенным добавлением функциональности. Каждый этап независимо тестируется и может быть задеплоен.

---

## Этап 1: Базовые модели и CRUD

### Цель
Создать основные модели данных и минимальный API для управления паками.

### 1.1. Модели данных

**Новые модели** (`packages-shared/models/src/data/`):

- **Pack.ts** — основная сущность пака
  - `packId: string` (формат `pck_[a-z0-9]{20}`)
  - `tenantId: string`
  - `createdAt: Date`
  - Индексы: `(tenantId, packId)` unique, `(tenantId, createdAt)`

- **PackLink.ts** — связь диалога с паком
  - `packId: string`
  - `dialogId: string`
  - `tenantId: string`
  - `addedAt: Date`
  - Индексы: `(packId, dialogId)` unique, `(dialogId, packId)`, `(packId, addedAt)`
  - Каскадное удаление при удалении диалога

**Обновить** `packages-shared/models/src/index.ts`:
- Экспортировать Pack, PackLink и их интерфейсы

### 1.2. API endpoints (tenant-api)

**Новый контроллер** `packages/tenant-api/src/controllers/packController.ts`:

- `POST /api/packs` — создать пак
  - Body: пустой объект или не передавать
  - Генерация packId, проверка tenantId
  - Возврат: `{ packId, tenantId, createdAt }`

- `GET /api/packs/:packId` — получить пак
  - Проверка доступа (tenant)
  - Возврат: данные пака + список dialogIds из PackLink

- `DELETE /api/packs/:packId` — удалить пак
  - Каскадное удаление PackLink, PackStats, UserPackStats (на будущее)

- `POST /api/packs/:packId/dialogs` — добавить диалог в пак
  - Body: `{ dialogId: string }`
  - Проверка: tenantId диалога = tenantId пака
  - Идемпотентность: если уже есть — успех без изменения addedAt
  - Создание записи PackLink

- `DELETE /api/packs/:packId/dialogs/:dialogId` — убрать диалог из пака
  - Удаление записи PackLink
  - Пак остаётся даже если стал пустым

- `GET /api/packs/:packId/dialogs` — список диалогов пака
  - Пагинация, сортировка по addedAt desc
  - Возврат: массив dialogIds с addedAt

**Новые routes** `packages/tenant-api/src/routes/packRoutes.ts`:
- Подключить все endpoints с валидацией

**Валидаторы** `packages/tenant-api/src/validators/`:
- `urlValidators/packId.ts` — проверка формата `pck_[a-z0-9]{20}`
- `schemas/bodySchemas.ts` — схемы для создания пака, добавления диалога

### 1.3. Мета-теги для паков

**Обновить** `packages/tenant-api/src/controllers/metaController.ts`:
- Добавить `entityType: 'pack'` в список допустимых типов
- Поддержка `PUT /api/packs/:packId/meta/:metaKey`
- Поддержка `DELETE /api/packs/:packId/meta/:metaKey`
- Поддержка `GET /api/packs/:packId/meta`

### 1.4. Тесты

**Интеграционные тесты** `packages/tenant-api/src/controllers/__tests__/packController.test.js`:
- Создание пака
- Добавление/удаление диалогов
- Проверка tenantId при добавлении диалога
- Идемпотентность добавления
- Удаление пака с каскадом
- Мета-теги на паках

### 1.5. Документация

**Обновить** `docs/API.md`:
- Раздел "Packs" с описанием всех endpoints
- Примеры запросов/ответов

---

## Этап 2: Список паков пользователя

### Цель
Реализовать получение списка паков для пользователя с фильтрацией и пагинацией.

### 2.1. API endpoints

**Обновить** `packages/tenant-api/src/controllers/userController.ts`:

- `GET /api/users/:userId/packs` — список паков пользователя
  - Логика: найти все dialogIds, где пользователь участник (через DialogMember)
  - Найти все packIds, содержащие эти dialogIds (через PackLink)
  - Вернуть паки с мета-тегами
  - Поддержка фильтров по meta (например, `filter=(meta.category,eq,support)`)
  - Пагинация: `page`, `limit`
  - Сортировка: по `createdAt` desc (по умолчанию)

- `GET /api/users/:userId/dialogs/:dialogId/packs` — список паков для диалога
  - Проверка: пользователь участник диалога
  - Возврат: список паков, содержащих этот диалог

**Новые routes** `packages/tenant-api/src/routes/userPackRoutes.ts`:
- Подключить endpoints

### 2.2. Фильтрация по meta

**Обновить** `packages/tenant-api/src/utils/queryParser.ts`:
- Поддержка фильтров по `meta.*` для паков (аналогично диалогам)

### 2.3. Тесты

**Интеграционные тесты** `packages/tenant-api/src/controllers/__tests__/userController.test.js`:
- Список паков пользователя (пустой, с паками)
- Фильтрация по meta
- Пагинация
- Список паков для диалога

### 2.4. UI (controlo-ui)

**Новый компонент** `packages/controlo-ui/src/components/Packs/PackList.vue`:
- Отображение списка паков пользователя
- Фильтры по meta
- Переход к деталям пака

**Новая страница** `packages/controlo-ui/src/views/PacksView.vue`:
- Список паков с пагинацией
- Создание нового пака
- Удаление пака

**Роутинг** `packages/controlo-ui/src/router/index.ts`:
- Добавить маршрут `/packs`

---

## Этап 3: Счётчики (UserPackStats и PackStats)

### Цель
Добавить счётчики непрочитанного по паку для пользователя и агрегаты по паку.

### 3.1. Модели счётчиков

**Новые модели** (`packages-shared/models/src/stats/`):

- **UserPackStats.ts** — счётчики пака для пользователя
  - `userId: string`
  - `packId: string`
  - `tenantId: string`
  - `unreadCount: number`
  - `lastUpdated: Date`
  - Индексы: `(userId, packId)` unique, `(packId, userId)`, `(userId, unreadCount)`

- **PackStats.ts** — агрегаты по паку
  - `packId: string`
  - `tenantId: string`
  - `messageCount: number`
  - `uniqueMemberCount: number` (уникальные userId по всем диалогам)
  - `sumMemberCount: number` (сумма memberCount по диалогам)
  - `uniqueTopicCount: number` (уникальные topicId по всем диалогам)
  - `sumTopicCount: number` (сумма topicCount по диалогам)
  - `lastUpdated: Date`
  - Индексы: `(packId)` unique, `(tenantId, packId)`

**Обновить** `packages-shared/models/src/index.ts`:
- Экспортировать UserPackStats, PackStats

### 3.2. Утилиты для счётчиков

**Новая утилита** `packages-shared/utils/src/packStatsUtils.ts`:
- `calculateUserPackUnread(userId, packId)` — подсчёт непрочитанного по паку
  - Найти все dialogIds пака (через PackLink)
  - Суммировать unreadCount из UserDialogStats для этих диалогов
- `calculatePackStats(packId)` — подсчёт агрегатов по паку
  - messageCount, uniqueMemberCount, sumMemberCount, uniqueTopicCount, sumTopicCount

**Обновить** `packages-shared/utils/src/index.ts`:
- Экспортировать packStatsUtils

### 3.3. Обновление счётчиков

**Решение**: **асинхронное обновление** через update-worker (меньше нагрузки на API).

**Обновить** `packages/update-worker/src/index.ts`:
- При обработке события `message.create` / `message.read`:
  - Найти все packIds, содержащие dialogId (через PackLink)
  - Для каждого packId пересчитать UserPackStats для всех участников диалогов пака
  - Обновить PackStats для packId
  - После записи в БД публиковать `user.pack.stats.updated` (userId, packId, unreadCount) и `pack.stats.updated` (packId, при необходимости поля PackStats), чтобы UI/пуш обновляли бейджи без опроса

### 3.4. API: возврат счётчиков

**Обновить** `packages/tenant-api/src/controllers/userController.ts`:
- `GET /api/users/:userId/packs` — добавить в ответ `unreadCount` из UserPackStats

**Обновить** `packages/tenant-api/src/controllers/packController.ts`:
- `GET /api/packs/:packId` — добавить в ответ PackStats (messageCount, uniqueMemberCount и т.д.)

### 3.5. Тесты

**Тесты утилит** `packages-shared/utils/src/__tests__/packStatsUtils.test.js`:
- Подсчёт unreadCount по паку
- Подсчёт PackStats

**Интеграционные тесты** `packages/tenant-api/src/controllers/__tests__/userController.test.js`:
- Проверка unreadCount в списке паков

### 3.6. UI

**Обновить** `packages/controlo-ui/src/components/Packs/PackList.vue`:
- Отображение badge с unreadCount для каждого пака
- Отображение PackStats (messageCount, memberCount и т.д.)

---

## Этап 4: События управления паками

### Цель
Публиковать события при изменении состава паков для инвалидации кэшей.

### 4.1. Типы событий

**Обновить** `packages-shared/models/src/operational/Event.ts`:
- Добавить новые типы событий:
  - `pack.create` — создан пак
  - `pack.delete` — удалён пак
  - `pack.dialog.add` — диалог добавлен в пак
  - `pack.dialog.remove` — диалог удалён из пака
  - `pack.stats.updated` — обновлены PackStats по паку (воркер после пересчёта)
  - `user.pack.stats.updated` — обновлены UserPackStats по паку для пользователя (воркер после пересчёта unreadCount)

**Обновить** `packages-shared/utils/src/eventUtils.ts`:
- Функции для создания событий паков

### 4.2. Публикация событий

**Обновить** `packages/tenant-api/src/controllers/packController.ts`:
- После создания пака — публиковать `pack.create`
- После удаления пака — публиковать `pack.delete`
- После добавления диалога — публиковать `pack.dialog.add`
- После удаления диалога — публиковать `pack.dialog.remove`

### 4.3. Обработка событий и уведомления при изменении счётчиков

**Обновить** `packages/update-worker/src/index.ts`:
- Подписаться на события `pack.*`
- При `pack.dialog.add` / `pack.dialog.remove`:
  - Пересчитать PackStats для packId
  - Пересчитать UserPackStats для всех участников диалогов пака
  - После записи в БД публиковать `pack.stats.updated` (packId, при необходимости поля PackStats) и `user.pack.stats.updated` (userId, packId, unreadCount) для затронутых пользователей

**В этапе 3** (счётчики): при обновлении UserPackStats / PackStats воркером (по message.create, message.read и т.д.) после записи в БД публиковать `user.pack.stats.updated` и `pack.stats.updated`, чтобы UI/пуш могли обновить бейджи без опроса.

### 4.4. Тесты

**Интеграционные тесты**:
- Проверка публикации событий при операциях с паками
- Проверка обработки событий в update-worker

### 4.5. Документация

**Обновить** `docs/EVENTS.md`:
- Описание событий `pack.*` (в т.ч. `pack.stats.updated`, `user.pack.stats.updated`) с примерами payload

---

## Этап 5: Единый поток сообщений пака

### Цель
Реализовать единый поток сообщений пака. Событий уровня пака (pack.activity) не публикуем — подписчики используют существующие события и кэш dialogId → packIds (см. PACK_CONCEPT.md).

### 5.1. Единый поток сообщений пака

**Новый endpoint** `packages/tenant-api/src/controllers/packController.ts`:

- `GET /api/packs/:packId/messages` — все сообщения диалогов пака
  - Найти все dialogIds пака (через PackLink)
  - Запросить сообщения из всех этих диалогов (Message.find)
  - Сортировка по `createdAt` desc
  - Пагинация: cursor-based (по `createdAt` + `messageId`)
  - В каждом сообщении вернуть `dialogId` и `topicId`

**Индексы**:
- Убедиться, что в Message есть индекс `(dialogId, createdAt, messageId)`

### 5.2. Тесты

**Интеграционные тесты** `packages/tenant-api/src/controllers/__tests__/packController.test.js`:
- Получение сообщений пака (пустой, с сообщениями)
- Пагинация по сообщениям
- Проверка наличия dialogId в каждом сообщении

### 5.3. UI

**Новый компонент** `packages/controlo-ui/src/components/Packs/PackMessages.vue`:
- Отображение единого потока сообщений пака
- Группировка по диалогам (опционально)
- Пагинация

**Обновить** `packages/controlo-ui/src/views/PackDetailView.vue`:
- Вкладка "Сообщения" с компонентом PackMessages

### 5.4. Документация

**Обновить** `docs/API.md`:
- Описание `GET /api/packs/:packId/messages`
- Примеры cursor-based пагинации

---

## Дополнительные задачи

### Миграция данных

**Скрипт миграции** (если нужно создать паки для существующих данных):
- `packages/controlo-backend/scripts/migratePacks.js`
- Создание паков на основе meta-тегов диалогов или других критериев

### Мониторинг и метрики

- Добавить метрики в Prometheus:
  - Количество паков на тенанта
  - Количество диалогов в паке (avg, max)
  - Время обработки событий `pack.*`

### Оптимизация

- Кэширование маппинга `dialogId → packIds` в Redis (для подписчиков, которым нужны паки по диалогу)
- Индексы для быстрого поиска паков пользователя

---

## Порядок реализации

1. **Этап 1** (базовые модели и CRUD) — 2-3 дня
2. **Этап 2** (список паков пользователя) — 1-2 дня
3. **Этап 3** (счётчики) — 2-3 дня
4. **Этап 4** (события управления) — 1-2 дня
5. **Этап 5** (единый поток сообщений пака) — 2-3 дня

**Итого**: 8-13 дней разработки + тестирование.

---

## Критерии готовности

### Этап 1
- ✅ Модели Pack и PackLink созданы и экспортированы
- ✅ API для CRUD паков работает
- ✅ Мета-теги на паках работают
- ✅ Тесты покрывают основные сценарии
- ✅ Документация обновлена

### Этап 2
- ✅ Пользователь может получить список своих паков
- ✅ Фильтрация по meta работает
- ✅ UI отображает список паков

### Этап 3
- ✅ UserPackStats и PackStats рассчитываются корректно
- ✅ unreadCount отображается в UI
- ✅ Счётчики обновляются при событиях

### Этап 4
- ✅ События `pack.*` публикуются при изменениях
- ✅ update-worker обрабатывает события

### Этап 5
- ✅ Единый поток сообщений пака работает
- ✅ UI отображает сообщения пака

---

## Риски и митигация

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| Производительность единого потока сообщений при большом числе диалогов в паке | Средняя | Среднее | Cursor-based пагинация; индексы; лимит на размер пака (макс. 50-100 диалогов) |
| Рассинхронизация счётчиков при асинхронном обновлении | Средняя | Низкое | Идемпотентная обработка событий; retry при ошибках; периодическая пересинхронизация |
| Сложность фильтрации паков по meta при большом числе паков | Низкая | Низкое | Индексы на Meta; кэширование результатов фильтров |

---

## Зависимости

- MongoDB 5.0+
- RabbitMQ 3.11+
- Node.js 18+
- TypeScript 5+

---

## Следующие шаги после реализации

1. **Производительность**: нагрузочное тестирование с большим числом паков и диалогов
2. **UI/UX**: улучшение интерфейса работы с паками (drag-and-drop, bulk операции)
3. **Аналитика**: дашборд с метриками по пакам
4. **Экспорт/импорт**: возможность экспортировать состав паков
5. **Права доступа**: детальные права на уровне паков (кто может создавать, редактировать)
