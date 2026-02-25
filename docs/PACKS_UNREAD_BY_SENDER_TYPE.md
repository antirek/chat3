# Табличный подход: счётчики непрочитанных по типу отправителя (fromType)

## 1. Идея

Хранить непрочитанные **разбивкой по типу отправителя** (fromType = User.type того, кто написал сообщение). Одна строка — один счётчик: «сколько непрочитанных у пользователя X в диалоге/паке от отправителей типа T». Так можно и показывать «только от contact», и считать общий итог, и корректно увеличивать/уменьшать при создании сообщения и при прочтении.

---

## 2. Таблицы (коллекции)

### 2.1. Уровень диалога

**UserDialogUnreadBySenderType** (или имя на выбор)

| Поле        | Тип     | Описание |
|-------------|---------|----------|
| tenantId    | string  | Тенант |
| userId      | string  | Кому считаем непрочитанные (получатель) |
| dialogId    | string  | Диалог |
| fromType    | string  | Тип отправителя (User.type: user, contact, bot …) |
| countUnread | number  | Количество непрочитанных сообщений от этого типа в этом диалоге |
| lastUpdatedAt | number | Время последнего изменения (опционально) |
| createdAt   | number  | Время создания записи (опционально) |

**Уникальность:** один документ на комбинацию `(tenantId, userId, dialogId, fromType)`.

Пример:

| userId | dialogId | fromType | countUnread |
|--------|----------|----------|-------------|
| usr_1  | dlg_A    | contact  | 3           |
| usr_1  | dlg_A    | user     | 0           |
| usr_2  | dlg_A    | contact  | 1           |

Интерпретация: у `usr_1` в диалоге `dlg_A` — 3 непрочитанных от contact; у `usr_2` — 1 от contact. Итог по диалогу для пользователя = сумма `countUnread` по всем `fromType` (или только по нужным типам).

---

### 2.2. Уровень пака

**UserPackUnreadBySenderType**

| Поле        | Тип     | Описание |
|-------------|---------|----------|
| tenantId    | string  | Тенант |
| userId      | string  | Пользователь |
| packId      | string  | Пак |
| fromType    | string  | Тип отправителя |
| countUnread | number  | Непрочитанные от этого типа в паке (сумма по диалогам пака) |
| lastUpdatedAt | number | Опционально |
| createdAt   | number  | Опционально |

**Уникальность:** `(tenantId, userId, packId, fromType)`.

Пример:

| userId | packId | fromType | countUnread |
|--------|--------|----------|-------------|
| usr_1  | pck_1  | contact  | 5           |
| usr_1  | pck_1  | user     | 0           |

«Непрочитанные в паке только от contact» = взять строку с `fromType = 'contact'` (или сумма по выбранным fromType).

---

### 2.3. Опционально: пак + диалог (детализация внутри пака)

Если нужна разбивка «в паке, по диалогам и по типу отправителя»:

**UserPackDialogUnreadBySenderType**

| Поле        | Тип     | Описание |
|-------------|---------|----------|
| tenantId    | string  | Тенант |
| userId      | string  | Пользователь |
| packId      | string  | Пак |
| dialogId    | string  | Диалог из пака |
| fromType    | string  | Тип отправителя |
| countUnread | number  | Непрочитанные от этого типа в этом диалоге (в контексте пака) |
| lastUpdatedAt | number | Опционально |
| createdAt   | number  | Опционально |

**Уникальность:** `(tenantId, userId, packId, dialogId, fromType)`.

Тогда по паку: сумма `countUnread` по всем `dialogId` (и при необходимости по выбранным `fromType`). Можно не вводить эту таблицу, а считать агрегат пака из **UserDialogUnreadBySenderType** по диалогам пака (см. ниже).

---

## 3. Сводная таблица структур

| Коллекция                       | userId | packId | dialogId | fromType | countUnread | Назначение |
|---------------------------------|--------|--------|----------|----------|-------------|------------|
| UserDialogUnreadBySenderType    | ✓      | —      | ✓        | ✓        | ✓           | Непрочитанные по диалогу с разбивкой по типу отправителя |
| UserPackUnreadBySenderType      | ✓      | ✓      | —        | ✓        | ✓           | Непрочитанные по паку с разбивкой по типу отправителя |
| UserPackDialogUnreadBySenderType | ✓      | ✓      | ✓        | ✓        | ✓           | Опционально: пак + диалог + тип отправителя |

Связь с текущими сущностями:

- **User.type** — тип пользователя (отправителя или получателя); отправитель даёт `fromType` при создании сообщения и при прочтении.
- **Message.senderId** → User → `type` = `fromType` для строки счётчика.
- **PackLink** связывает packId и dialogId — по нему знаем, какие диалоги входят в пак.

---

## 4. Операции

### 4.1. Создание сообщения

1. Определить отправителя и его тип: `fromType = User.type(senderId)` (если нет — дефолт, например `'user'`).
2. Получить получателей диалога (все участники кроме отправителя).
3. Для каждого получателя:
   - **Диалог:** увеличить на 1 счётчик `(tenantId, recipientUserId, dialogId, fromType)` в **UserDialogUnreadBySenderType** (upsert: `$inc: { countUnread: 1 }`).
   - **Пак:** для каждого packId, в который входит этот dialogId (через PackLink), увеличить на 1 счётчик `(tenantId, recipientUserId, packId, fromType)` в **UserPackUnreadBySenderType** (upsert: `$inc`).

Если используете **UserPackDialogUnreadBySenderType**, то для каждого (recipientUserId, packId, dialogId) делать `$inc` по `(tenantId, recipientUserId, packId, dialogId, fromType)`.

### 4.2. Сообщение помечено как прочитанное (MessageStatus → read)

1. По messageId получить Message → senderId, dialogId.
2. `fromType = User.type(senderId)`.
3. Для пользователя, который прочитал (userId из MessageStatus):
   - **Диалог:** уменьшить на 1 счётчик `(tenantId, userId, dialogId, fromType)` в **UserDialogUnreadBySenderType** (`$inc: { countUnread: -1 }`, с защитой от ухода в минус, например `$max: [0, countUnread - 1]` или пересчёт).
   - **Пак:** для каждого packId, содержащего этот dialogId, уменьшить на 1 счётчик `(tenantId, userId, packId, fromType)` в **UserPackUnreadBySenderType**.

При удалении статуса read — симметрично увеличить на 1 те же строки.

### 4.3. Ручная установка «прочитано» (setUnreadCount)

Семантика: клиент выставляет «сколько непрочитанных считаю по этому диалогу». Варианты:

- **Вариант A:** клиент присылает одно число (как сейчас). Тогда нужно либо трактовать его как «общий unread» и размазать по fromType (сложно и неоднозначно), либо считать, что ручная установка сбрасывает только «общий» счётчик, а таблицы по fromType — только для автоматических событий (тогда при setUnreadCount(0) можно обнулить все строки по (userId, dialogId) в UserDialogUnreadBySenderType и пересчитать паки из диалогов).
- **Вариант B:** API расширить: передавать объект по типам, например `{ contact: 0, user: 0 }`, и выставлять countUnread по каждой строке (userId, dialogId, fromType). Тогда таблица остаётся единственным источником правды.

Для начала разумно: при setUnreadCount(0) обнулять все записи по (userId, dialogId) в UserDialogUnreadBySenderType и затем пересчитать UserPackUnreadBySenderType по диалогам пака (см. п. 4.5).

### 4.4. Добавление/удаление диалога в паке

- При добавлении диалога в пак: для всех участников диалога и для каждого fromType взять текущие countUnread из **UserDialogUnreadBySenderType** по этому диалогу и добавить/инициализировать соответствующие строки в **UserPackUnreadBySenderType** (или в UserPackDialogUnreadBySenderType), чтобы агрегат пака был консистентен.
- При удалении диалога из пака: уменьшить (или удалить вкладку) по паку для этого диалога.

### 4.5. Агрегат пака из диалогов (пересчёт)

Если не ведёте **UserPackUnreadBySenderType** в реальном времени при каждом message.create/read, можно считать её производной:

- Для каждого (userId, packId, fromType):  
  `countUnread = сумма UserDialogUnreadBySenderType.countUnread` по всем диалогам этого пака (PackLink) для этого userId и fromType.

Тогда при message.create достаточно обновлять только **UserDialogUnreadBySenderType**; воркер или отдельный джоб по событию пересчитывает **UserPackUnreadBySenderType**. Либо обновлять обе таблицы в одном месте (диалог + все паки, куда входит диалог), как в п. 4.1–4.2.

---

## 5. Как отдавать в API

- **По диалогу:**  
  Список строк `{ fromType, countUnread }` для (userId, dialogId). Клиент сам решает: показать только от contact, или сумму по нескольким типам, или общий итог (сумма по всем fromType).

- **По паку:**  
  Разбивку по fromType для (userId, packId) отдаём в секции **stats.user**: `stats.user.unreadCount` (сумма по всем fromType) и `stats.user.unreadBySenderType` — массив `{ fromType, countUnread }`. Та же структура подходит и для GET одного пака (GET /api/users/:userId/packs/:packId), и для списка паков (GET /api/users/:userId/packs).

---

### 5.1. Список паков пользователя: разбивка «от контактов» / «от остальных»

**Вопрос:** при отдаче списка паков пользователя можно ли в каждом паке для этого пользователя показать: «столько непрочитанных от контактов, столько — от других»? И чтобы при прочтении одного или нескольких сообщений в паке эти числа обновлялись?

**Да.** При табличном подходе это делается так.

1. **Выдача списка паков (GET /api/users/:userId/packs)**  
   Для каждого пака в выборке по текущему `userId` читаем из **UserPackUnreadBySenderType** все строки с этим `(tenantId, userId, packId)` и отдаём разбивку по `fromType`. В каждом элементе списка паков данные по пользователю кладём в **stats.user** (секция `user` внутри `stats`).

2. **Обновление при прочтении**  
   Как только пользователь помечает сообщение как прочитанное (обновление MessageStatus → read), в post-save мы делаем −1 по строке `(userId, dialogId, fromType)` в UserDialogUnreadBySenderType и −1 по строкам `(userId, packId, fromType)` во всех паках, в которые входит этот диалог (раздел 4.2). Следующий запрос списка паков или отдельного пака уже вернёт обновлённые значения.

Пример ответа **GET /api/users/:userId/packs** (фрагмент по одному паку):

```json
{
  "data": [
    {
      "packId": "pck_abc",
      "tenantId": "tnt_1",
      "meta": {},
      "stats": {
        "dialogCount": 2,
        "user": {
          "unreadCount": 7,
          "unreadBySenderType": [
            { "fromType": "contact", "countUnread": 5 },
            { "fromType": "user", "countUnread": 2 }
          ]
        }
      },
      "lastMessage": { ... },
      "lastActivityAt": "..."
    }
  ],
  "pagination": { ... }
}
```

На клиенте можно показать, например: «5 от контактов, 2 от пользователей» или один бейдж «7» (из `stats.user.unreadCount` или сумма по fromType).

3. **Откуда берутся данные**  
   При реализации: для списка паков после получения страницы паков (как сейчас) одним запросом выбрать из **UserPackUnreadBySenderType** все записи с `tenantId`, `userId` и `packId ∈ [id паков на странице]`, сгруппировать по packId и собрать для каждого пака объект **stats.user** с `unreadCount` (сумма по fromType) и `unreadBySenderType`. Итог: один дополнительный запрос на страницу списка паков, без N+1.

Итого: при таком подходе в списке паков по каждому паку для пользователя можно однозначно отдать «столько от контактов, столько от других», и при прочтении сообщений в паке эти индикаторы обновляются за счёт декремента в UserPackUnreadBySenderType (и в UserDialogUnreadBySenderType по диалогу).

---

## 6. Сосуществование со старыми счётчиками

Текущие **UserDialogStats** и **UserPackStats** (одно число unreadCount на пару/тройку без fromType) можно:

- оставить для обратной совместимости и заполнять «общим» значением (сумма по всем fromType из новых таблиц), или  
- считать устаревшими и постепенно переходить только на таблицы по fromType.

Пока новые таблицы не заполнены, старые API могут продолжать опираться на UserDialogStats/UserPackStats; после миграции и пересчёта переключить чтение на новые коллекции.

---

## 7. Краткое резюме

| Что | Описание |
|-----|----------|
| **Таблицы** | UserDialogUnreadBySenderType (userId, dialogId, fromType, countUnread); UserPackUnreadBySenderType (userId, packId, fromType, countUnread); опционально — по пак+диалог. |
| **+1** | При создании сообщения: известен fromType → инкремент по получателям в диалоге и во всех паках, содержащих диалог. |
| **−1** | При прочтении: по сообщению знаем senderId → fromType → декремент по той же схеме. |
| **Выдача** | По запросу отдаём разбивку по fromType; «счётчик только от определённых типов» = сумма выбранных fromType (например, только contact). |

Такой табличный подход даёт явное состояние «userId × packId × (dialogId) × fromType → countUnread» и единообразную логику увеличения/уменьшения при сообщениях и прочтении.
