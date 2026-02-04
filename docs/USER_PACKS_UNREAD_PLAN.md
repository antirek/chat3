# План: API паков пользователя с unreadCount (UserPackStats)

## Контекст

**Кейс:** пак содержит диалоги и пользователей. Нужно узнать, сколько у пользователя непрочитанных сообщений в паке.

**Предложение:** endpoint `GET /api/users/{userId}/packs` возвращает паки, где пользователь участвует в диалогах, с данными UserPackStats в секции `stats`.

## Текущее состояние

### Существующий endpoint

**`GET /api/users/:userId/packs`** уже реализован в `packages/tenant-api/src/controllers/userController.ts`:

- **Логика:** паки, в диалогах которых пользователь состоит (через `DialogMember` + `PackLink`)
- **Ответ для каждого пака:**
  - `packId`, `tenantId`, `createdAt`
  - `meta` — мета-теги пака
  - `unreadCount` — на верхнем уровне (из `UserPackStats`)
- **Фильтры:** `filter` по meta полям пака
- **Пагинация:** `page`, `limit`
- **Сортировка:** `sort`, `sortDirection` (по умолчанию `createdAt` desc)

### Модели

| Модель        | Поля                                                                 | Назначение                          |
|---------------|----------------------------------------------------------------------|-------------------------------------|
| **UserPackStats** | tenantId, packId, userId, unreadCount, lastUpdatedAt, createdAt      | Непрочитанные сообщения в паке для пользователя |
| **PackStats**     | tenantId, packId, messageCount, uniqueMemberCount, sumMemberCount, uniqueTopicCount, sumTopicCount, lastUpdatedAt | Агрегаты по паку                    |

## Решения

### 1. Структура ответа — да, секция `stats`

Вынести данные UserPackStats в секцию `stats` (без дублирования `unreadCount` на верхнем уровне, обратная совместимость не требуется).

Формат ответа `GET /api/users/:userId/packs`:

```json
{
  "data": [
    {
      "packId": "pck_abc123...",
      "tenantId": "tnt_default",
      "createdAt": 1234567890.123,
      "meta": { "name": "Support Pack" },
      "stats": {
        "unreadCount": 5,
        "lastUpdatedAt": 1234567891.456,
        "createdAt": 1234567890.123
      }
    }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 1, "pages": 1 }
}
```

### 2. PackStats в ответе — нет

Не добавлять PackStats (messageCount, uniqueMemberCount и т.д.) в ответ.

### 3. GET /api/users/:userId/dialogs/:dialogId/packs — пока не надо

Не добавлять unreadCount в этот endpoint.

### 4. Фильтрация и сортировка по unreadCount — да

- **Фильтр:** `filter=(unreadCount,gt,0)` — паки только с непрочитанными (и другие операторы: eq, gte, lt, lte).
- **Сортировка:** `sort=unreadCount&sortDirection=desc` — паки с большим числом непрочитанных первыми (требует учёта UserPackStats при сортировке/выборке).

### 5. Обратная совместимость — не требуется

Убрать `unreadCount` с верхнего уровня, оставить только в `stats`.

---

## Чеклист реализации

- [x] Добавить секцию `stats` (UserPackStats: unreadCount, lastUpdatedAt, createdAt) в ответ `GET /api/users/:userId/packs`
- [x] Убрать `unreadCount` с верхнего уровня элемента ответа
- [x] Реализовать фильтр по unreadCount: `filter=(unreadCount,gt,0)` (и др. операторы)
- [x] Реализовать сортировку по unreadCount: `sort=unreadCount`, `sortDirection=asc|desc`
- [x] Обновить docs/API.md
