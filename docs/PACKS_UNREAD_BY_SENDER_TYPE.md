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

### 4.0. Кто такой userId и откуда fromType (корректность обновления)

В строке счётчика всегда:

- **userId** — тот, **для кого** считается непрочитанное (получатель сообщения; при прочтении — тот, кто прочитал). Тип этого пользователя (user, contact и т.д.) в ключе счётчика **не участвует**: мы просто храним «у пользователя X столько непрочитанных от отправителей типа T».
- **fromType** — тип **отправителя** сообщения (`User.type(senderId)`), то есть «от кого» сообщение.

Пример: пользователь типа **user** прочитал сообщение от пользователя типа **contact**. Нужно уменьшить у первого «непрочитанные от контактов».

- В MessageStatus при переходе в read у нас есть: `userId` = кто прочитал (пользователь типа user), `messageId` = какое сообщение.
- По messageId получаем Message → `senderId` (контакт) → `fromType = User.type(senderId)` = `"contact"`.
- Уменьшаем счётчик `(tenantId, userId, dialogId, fromType="contact")` и `(tenantId, userId, packId, fromType="contact")` для всех паков диалога.

В результате у чтеца (user) уменьшается именно счётчик «непрочитанные от контакта» — тип чтеца не нужен для ключа, важен только тип отправителя (fromType). Обновление при прочтении поэтому корректно: отправитель задаёт fromType, чтец задаёт userId.

### 4.1. Создание сообщения

1. Определить **тип отправителя**: `fromType = User.type(senderId)` (если нет — дефолт, например `'user'`).
2. Получить получателей диалога (все участники кроме отправителя).
3. Для каждого **получателя** (recipientUserId):
   - **Диалог:** увеличить на 1 счётчик `(tenantId, recipientUserId, dialogId, fromType)` в **UserDialogUnreadBySenderType** (upsert: `$inc: { countUnread: 1 }`).
   - **Пак:** для каждого packId, в который входит этот dialogId (через PackLink), увеличить на 1 счётчик `(tenantId, recipientUserId, packId, fromType)` в **UserPackUnreadBySenderType** (upsert: `$inc`).

Итого: у каждого получателя увеличивается счётчик «непрочитанные от отправителя типа fromType».

Если используете **UserPackDialogUnreadBySenderType**, то для каждого (recipientUserId, packId, dialogId) делать `$inc` по `(tenantId, recipientUserId, packId, dialogId, fromType)`.

### 4.2. Сообщение помечено как прочитанное (MessageStatus → read)

1. По messageId получить Message → senderId, dialogId.
2. **fromType = User.type(senderId)** — тип отправителя сообщения (тот, кто написал).
3. **userId** из MessageStatus — кто прочитал (чтец). Его тип для ключа не используем.
4. Для этого пользователя (чтеца):
   - **Диалог:** уменьшить на 1 счётчик `(tenantId, userId, dialogId, fromType)` в **UserDialogUnreadBySenderType** (`$inc: { countUnread: -1 }`, с защитой от ухода в минус, например `$max: [0, countUnread - 1]` или пересчёт).
   - **Пак:** для каждого packId, содержащего этот dialogId, уменьшить на 1 счётчик `(tenantId, userId, packId, fromType)` в **UserPackUnreadBySenderType**.

В итоге у чтеца уменьшается счётчик «непрочитанные от отправителя типа fromType» — например, если прочитал сообщение от контакта, уменьшается строка с fromType=contact.

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

## 6. Updates: формат UserPackStatsUpdate

При изменении счётчиков пака для пользователя (message.create, message.status.update и т.д.) клиенту доставляется **UserPackStatsUpdate** (событие `user.pack.stats.updated`, routing key `update.pack.{userType}.{userId}.userpackstatsupdate`). Нужно определить формат секции **userPackStats** в `data` с учётом разбивки по fromType.

### 6.1. Текущий формат (без fromType)

Сейчас в update уходит:

- `userPackStats`: `packId`, `userId`, `unreadCount` (одно число), `lastUpdatedAt`
- `context`: `eventType`, `entityId` (userId), `packId`, `userId`, `includedSections`, `updatedFields` (например `['userPackStats.unreadCount']`)

### 6.2. Предлагаемый формат (с разбивкой по fromType)

**Секция `data.userPackStats`:**

| Поле | Тип | Описание |
|------|-----|----------|
| tenantId | string \| null | Тенант (опционально) |
| packId | string | ID пака |
| userId | string | Пользователь, для которого обновились счётчики |
| unreadCount | number | Сумма непрочитанных по всем fromType (для обратной совместимости и общего бейджа) |
| unreadBySenderType | array | Разбивка по типу отправителя: `[{ fromType: string, countUnread: number }, ...]` |
| lastUpdatedAt | number \| null | Время последнего изменения |

**Пример payload update:**

```json
{
  "data": {
    "userPackStats": {
      "tenantId": "tnt_1",
      "packId": "pck_abc",
      "userId": "usr_1",
      "unreadCount": 7,
      "unreadBySenderType": [
        { "fromType": "contact", "countUnread": 5 },
        { "fromType": "user", "countUnread": 2 }
      ],
      "lastUpdatedAt": 1771234567890.123456
    },
    "context": {
      "eventType": "user.pack.stats.updated",
      "entityId": "usr_1",
      "packId": "pck_abc",
      "userId": "usr_1",
      "includedSections": ["userPackStats"],
      "updatedFields": ["userPackStats.unreadCount", "userPackStats.unreadBySenderType"]
    }
  }
}
```

Клиент может: подставить новый снимок по паку (заменить `stats.user` для этого packId) или только обновить счётчики; общий бейдж брать из `unreadCount`, детализацию — из `unreadBySenderType`.

### 6.3. Когда создаётся UserPackStatsUpdate

- После изменения **UserPackUnreadBySenderType** по данному (userId, packId): при создании сообщения в диалоге пака (инкремент по получателям) и при переходе сообщения в статус read (декремент у чтеца). Воркер (или синхронный путь) пересчитывает/обновляет строки по паку и для каждого затронутого userId создаёт один update с **полным снимком** по этому паку (все строки из UserPackUnreadBySenderType для (userId, packId) → массив unreadBySenderType, unreadCount = сумма).
- Один update на пару (userId, packId) за «волну» изменений: при массовом прочтении в одном диалоге пака по-прежнему один UserPackStatsUpdate с итоговым состоянием после всех изменений.

---

## 7. Концепция счётчиков по типам — сводка

| Элемент | Значение |
|---------|----------|
| Ключ счётчика | (tenantId,) userId, scope (dialogId или packId), **fromType** |
| userId | Тот, **для кого** считаем (получатель; при прочтении — чтец). Тип чтеца в ключе не участвует. |
| fromType | Тип **отправителя** сообщения (User.type(senderId)). «От кого» непрочитанное. |
| +1 | Создание сообщения: для каждого получателя инкремент (recipientUserId, dialogId/packId, fromType=senderType). |
| −1 | Прочтение: для чтеца (userId из MessageStatus) декремент (userId, dialogId/packId, fromType=senderType сообщения). |
| API | В ответе по паку: `stats.user.unreadCount`, `stats.user.unreadBySenderType`. |
| Update | UserPackStatsUpdate с полным снимком: `unreadCount` + `unreadBySenderType` по паку. |

---

## 8. Вопросы по критическим моментам — ответы

Решения зафиксированы:

| № | Вопрос | Ответ |
|---|--------|--------|
| 1 | Обратная совместимость update | **Да.** Поле `unreadCount` (сумма по fromType) остаётся обязательным, `unreadBySenderType` — опционально, старые клиенты работают без изменений. |
| 2 | Состав unreadBySenderType | **Отдавать с нулями.** Всегда полный набор типов с countUnread (в т.ч. 0), чтобы клиент мог подставлять снимок без слияния. |
| 3 | Порядок в unreadBySenderType | **Без разницы.** Порядок не регламентируется. |
| 4 | Множественное прочтение | **Пересчёт и один update.** После волны изменений пересчитываем состояние по паку и отправляем один UserPackStatsUpdate с итогом. |
| 5 | Где создавать UserPackStatsUpdate | **В update-worker.** Создание update только в воркере после обработки message.create / message.status.update (и пересчёта паков). |
| 6 | UserPackStats / UserDialogStats | **UserPackStats не заполняем и убираем коллекцию.** UserDialogStats **оставляем** (по диалогу по-прежнему одно число unreadCount). Данные по паку только из UserPackUnreadBySenderType. |
| 7 | setUnreadCount (ручная установка) | **Делать пересчёт.** При обнулении (или изменении) unread по диалогу: обнулить/обновить строки UserDialogUnreadBySenderType по (userId, dialogId), затем пересчитать UserPackUnreadBySenderType по всем затронутым пакам и отправить update. |

---

## 9. Сосуществование со старыми счётчиками (итог решений)

- **UserPackStats** — **удаляем.** Коллекцию не заполняем, код чтения/записи убираем. Счётчики по паку только в **UserPackUnreadBySenderType** (разбивка по fromType).
- **UserDialogStats** — **оставляем.** По диалогу по-прежнему одно число unreadCount; логика updateUnreadCount (message create, read, setUnreadCount) продолжает обновлять UserDialogStats. Дополнительно вводим **UserDialogUnreadBySenderType** для разбивки по fromType на уровне диалога (и для агрегации в паки).

---

## 10. План реализации

### 10.1. Модели и коллекции

| Шаг | Действие |
|-----|----------|
| 1.1 | Добавить модель **UserDialogUnreadBySenderType**: tenantId, userId, dialogId, fromType, countUnread, lastUpdatedAt, createdAt. Уникальный индекс (tenantId, userId, dialogId, fromType). |
| 1.2 | Добавить модель **UserPackUnreadBySenderType**: tenantId, userId, packId, fromType, countUnread, lastUpdatedAt, createdAt. Уникальный индекс (tenantId, userId, packId, fromType). |
| 1.3 | Удалить модель и коллекцию **UserPackStats**. Убрать все обращения (tenant-api, update-worker, packStatsUtils, init, контроллеры паков). API списка/одного пака перевести на чтение из UserPackUnreadBySenderType. |

### 10.2. Логика инкремента (создание сообщения)

| Шаг | Действие |
|-----|----------|
| 2.1 | В **messageController** (tenant-api) при создании сообщения: как сейчас получить senderId и получателей; вычислить **fromType = User.type(senderId)**. |
| 2.2 | Для каждого получателя: вызывать существующий **updateUnreadCount** (UserDialogStats) — без изменений. Дополнительно: upsert **UserDialogUnreadBySenderType** (tenantId, recipientUserId, dialogId, fromType) с `$inc: { countUnread: 1 }`. Обновление **UserPackUnreadBySenderType** не делать в API — только в воркере (п. 4.1). |

### 10.3. Логика декремента (прочтение и setUnreadCount)

| Шаг | Действие |
|-----|----------|
| 3.1 | В **MessageStatus** (post-save при переходе в read): как сейчас вызвать updateUnreadCount (UserDialogStats). Дополнительно: по messageId получить Message.senderId → fromType; для userId из MessageStatus сделать `$inc: { countUnread: -1 }` по (userId, dialogId, fromType) в **UserDialogUnreadBySenderType** (с защитой от отрицательных значений). Обновление UserPackUnreadBySenderType — только в воркере (п. 4.1). |
| 3.2 | В **dialogMemberController.setUnreadCount**: **пока поддерживать только обнуление** (unreadCount = 0). При обнулении: обнулить все строки по (userId, dialogId) в **UserDialogUnreadBySenderType** (countUnread = 0 для всех fromType). Затем пересчитать **UserPackUnreadBySenderType** по всем пакам, в которые входит этот диалог (сумма по диалогам из UserDialogUnreadBySenderType), и для каждого затронутого userId создать UserPackStatsUpdate. При запросе setUnreadCount с значением > 0 возвращать 400 или не менять таблицы по fromType (на усмотрение реализации). |

### 10.4. Update-worker

| Шаг | Действие |
|-----|----------|
| 4.1 | **Обновление паков — только в воркере.** При обработке **message.create** и **message.status.update**: по dialogId из события получить все packId (PackLink). Для каждого packId пересчитать **UserPackUnreadBySenderType** из **UserDialogUnreadBySenderType**: по всем диалогам пака просуммировать countUnread по (userId, fromType); записать/обновить строки (userId, packId, fromType). Для каждого затронутого userId собрать снимок: unreadCount = сумма по fromType, unreadBySenderType = массив по фиксированному списку `['user','contact','bot']` с countUnread (0 если строки нет). Вызвать **createUserPackStatsUpdate** с unreadBySenderType и unreadCount. |
| 4.2 | Расширить **buildUserPackStatsSection** и **createUserPackStatsUpdate**: принимать/отдавать **unreadBySenderType** (массив { fromType, countUnread }), в т.ч. с нулями. Формат см. раздел 6. |

### 10.5. API паков

| Шаг | Действие |
|-----|----------|
| 5.1 | **GET /api/users/:userId/packs** и **GET /api/users/:userId/packs/:packId**: читать **UserPackUnreadBySenderType** по (tenantId, userId, packId). Собирать **stats.user**: unreadCount = сумма countUnread по fromType, unreadBySenderType = массив по фиксированному списку `['user', 'contact', 'bot']` с countUnread (0 если строки нет). |
| 5.2 | Полный набор fromType для отдачи с нулями: **фиксированный список** `['user', 'contact', 'bot']` (константа в коде/конфиге). При сборке stats.user всегда отдавать по одному элементу на каждый тип с countUnread (0 если строки нет). |

### 10.6. Миграция и очистка

| Шаг | Действие |
|-----|----------|
| 6.1 | **Удалить UserPackStats сразу** в одном релизе с переходом на новые таблицы. Скрипт или эндпоинт миграции: пересчитать UserDialogUnreadBySenderType и UserPackUnreadBySenderType из MessageStatus/Message (непрочитанные по пользователю и fromType), затем дроп коллекции UserPackStats (или удалить модель и все обращения, миграция данных — до деплоя). |
| 6.2 | Удалить код: packStatsUtils (recalculateUserPackStats, upsertUserPackUnread по UserPackStats), init/sync по UserPackStats, все чтения/записи UserPackStats в контроллерах и воркере. |

### 10.7. Тесты

| Шаг | Действие |
|-----|----------|
| 7.1 | Тесты на инкремент/декремент UserDialogUnreadBySenderType (message create, message read в tenant-api/models) и пересчёт UserPackUnreadBySenderType в воркере. |
| 7.2 | **Сценарий: сообщения от разных типов, затем прочтение и сверка счётчиков.** В одном диалоге пака: создать пользователей типов user и contact; от имени contact отправить N сообщений, от имени user — M сообщений. Проверить у получателя (другой user): UserDialogUnreadBySenderType и (после обработки воркером) UserPackUnreadBySenderType — contact: N, user: M. Пометить часть сообщений как прочитанные (например все от contact). Проверить: счётчик по fromType=contact уменьшился до 0, по user остался M; общий unread и stats.user в API соответствуют. |
| 7.3 | Тесты API паков: наличие и формат stats.user.unreadBySenderType (массив по ['user','contact','bot'] с нулями где нет строк). |
| 7.4 | Тесты формата UserPackStatsUpdate (userPackStats.unreadCount, userPackStats.unreadBySenderType). |
| 7.5 | Тест setUnreadCount(0): обнуление по диалогу, пересчёт паков и отправка update. |

---

## 11. Вопросы по критичным моментам (после плана) — ответы

Решения зафиксированы:

| № | Вопрос | Ответ |
|---|--------|--------|
| 1 | Источник полного набора fromType для отдачи с нулями | **Фиксированный список** `['user', 'contact', 'bot']` (константа в коде/конфиге). В API и в update всегда отдаём три элемента с countUnread (0 если строки нет). |
| 2 | Где обновлять UserPackUnreadBySenderType | **В воркере.** В tenant-api при message create/read обновляем только UserDialogUnreadBySenderType (и по-прежнему UserDialogStats). Воркер по событию пересчитывает UserPackUnreadBySenderType из сумм UserDialogUnreadBySenderType по диалогам пака и создаёт UserPackStatsUpdate. |
| 3 | setUnreadCount при произвольном значении | **Пока только обнуление.** Поддерживать только unreadCount = 0: обнулить строки UserDialogUnreadBySenderType по (userId, dialogId), пересчитать паки, отправить update. Иные значения — не реализовывать или возвращать 400. |
| 4 | Момент удаления UserPackStats | **Удаляем сразу.** В одном релизе с переходом на UserPackUnreadBySenderType: убрать коллекцию и весь код, миграция данных (заполнение новых таблиц) — до или в рамках этого же релиза. |

---

## 12. Достаточность информации для реализации

Ниже — что уже задано и чего может не хватать.

**Достаточно задано:**

- Модели: поля, индексы, уникальность для UserDialogUnreadBySenderType и UserPackUnreadBySenderType.
- Источник fromType: User.type(senderId); фиксированный список для выдачи — `['user', 'contact', 'bot']`.
- Инкремент: в tenant-api при message create — обновлять UserDialogStats (как сейчас) и UserDialogUnreadBySenderType по (recipientUserId, dialogId, fromType); паки только в воркере.
- Декремент: в MessageStatus (post-save при read) — обновлять UserDialogStats и UserDialogUnreadBySenderType; паки пересчитываются в воркере.
- Воркер: по message.create / message.status.update пересчитывать UserPackUnreadBySenderType из UserDialogUnreadBySenderType по диалогам пака; создавать UserPackStatsUpdate с unreadBySenderType (все три типа, с нулями).
- setUnreadCount: только обнуление; обнулить UserDialogUnreadBySenderType по (userId, dialogId), пересчитать паки, отправить update.
- API паков: чтение из UserPackUnreadBySenderType, stats.user с unreadCount и unreadBySenderType по списку типов.
- Удаление UserPackStats: сразу, в одном релизе; миграция данных и удаление кода.
- Тесты: в т.ч. сценарий «сообщения от user и contact → прочтение части → сверка счётчиков по fromType».

**Уточнить при реализации:**

1. **Константа списка типов** — вынести `['user','contact','bot']` в один модуль (например `packUnreadSenderTypes.ts`) или в конфиг тенанта/приложения, чтобы API и воркер использовали один источник.
2. **Защита от отрицательных countUnread** — при декременте в UserDialogUnreadBySenderType использовать `$max: [0, countUnread - 1]` в pipeline update или отдельную проверку перед `$inc: -1`.
3. **Пересчёт паков в setUnreadCount** — вызывать ли из tenant-api ту же логику, что в воркере (расчёт UserPackUnreadBySenderType из UserDialogUnreadBySenderType по диалогам пака), или публиковать событие и пересчёт делать в воркере; в документе предполагается пересчёт в API (п. 3.2), но при «всё в воркере» можно слать искусственное событие для единообразия.
4. **Миграция** — порядок: сначала заполнить UserDialogUnreadBySenderType и UserPackUnreadBySenderType по текущим MessageStatus/Message, затем выключить запись в UserPackStats и переключить чтение паков на новые таблицы, затем дропнуть UserPackStats. Зафиксировать в скрипте/эндпоинте миграции.
5. **Дефолт User.type** — при отсутствии пользователя или типа использовать `'user'` (как в userTypeUtils), чтобы fromType всегда попадал в фиксированный список.

Итого: для старта реализации информации достаточно; перечисленные пункты — уточнения в коде и порядке миграции, а не отсутствующие решения.

---

## 13. Краткое резюме

| Что | Описание |
|-----|----------|
| **Таблицы** | UserDialogUnreadBySenderType (диалог × fromType); UserPackUnreadBySenderType (пак × fromType). UserPackStats **удалена сразу**; UserDialogStats оставляем. |
| **Типы** | Фиксированный список для API и update: `['user', 'contact', 'bot']` (всегда отдаём с нулями). |
| **+1** | В tenant-api: UserDialogStats + UserDialogUnreadBySenderType. Паки пересчитываются **только в воркере** из UserDialogUnreadBySenderType. |
| **−1** | В MessageStatus post-save: UserDialogStats + UserDialogUnreadBySenderType. Паки — в воркере. |
| **setUnreadCount** | **Только обнуление:** обнулить UserDialogUnreadBySenderType по (userId, dialogId), пересчитать паки, отправить UserPackStatsUpdate. |
| **Update** | UserPackStatsUpdate в воркере; unreadCount + unreadBySenderType (три типа, с нулями). |
| **API** | stats.user.unreadCount и stats.user.unreadBySenderType по списку типов. |

План реализации — раздел 10; ответы на вопросы — раздел 11; достаточность для реализации — раздел 12.
