# План: метод «отметить прочитанным по всем пользователям в паке» (tenant-api)

## 1. Контекст

### 1.1. Что уже есть

- **POST /api/users/:userId/packs/:packId/markAllRead** (userPackController.markPackAllRead) — отмечает все сообщения пака прочитанными **для одного пользователя**. Для каждого диалога пака, где пользователь участник: `applyMarkDialogAllRead` + `markDialogMessagesAsReadUntil`. Таймаут 2 минуты на всю операцию.
- **GET /api/packs/:packId/users** (packController.getUsers) — возвращает уникальных участников всех диалогов пака (DialogMember.distinct по dialogId ∈ packDialogIds).

### 1.2. Цель

Реализовать в **tenant-api** метод **«отметить прочитанным по всем пользователям в паке»**: один вызов по packId приводит к тому, что для **каждого пользователя**, являющегося участником хотя бы одного диалога пака, выполняется по сути та же логика, что и в markPackAllRead (обнуление счётчиков + MessageStatus = read по всем диалогам пака, где этот пользователь участник).

---

## 2. Эндпоинт и размещение

| Параметр | Значение |
|----------|----------|
| **Метод** | POST |
| **URL** | `/api/packs/:packId/markAllReadForAllUsers` |
| **Группа роутов** | Packs (packRoutes), не UserPacks |
| **Контроллер** | packController (логика на уровне пака) |
| **Тело запроса** | Пустое |
| **Query** | Опционально `memberType=user` (или `contact`, `bot`) — обрабатывать только участников с данным User.type; при `user` контакты не трогаем. |

Обоснование: операция выполняется «над паком» (затрагивает всех пользователей пака), поэтому эндпоинт живёт в packRoutes и packController.

---

## 3. Проверки и доступ

1. **Пак существует**: `Pack.findOne({ packId, tenantId })`. Иначе 404.
2. **Права**: те же, что у других мутирующих операций пака — `requirePermission('write')` (или при необходимости отдельная роль для массовых операций; по умолчанию достаточно write).
3. Дополнительная проверка «пользователь имеет доступ к паку» не нужна: вызывающий (API key) действует от имени тенанта и явно запрашивает операцию «по всем пользователям пака».

---

## 4. Алгоритм

1. **tenantId** из `req.tenantId`, **packId** из `req.params`, **actorId/actorType** из `resolveEventActor(req)` (как в packController.delete и других методах).
2. Проверить существование пака (Pack). 404 при отсутствии.
3. Получить список диалогов пака: `getPackDialogIds(tenantId, packId)`. Если пусто — ответ 200 с `processedUsersCount: 0`, `processedDialogsCount: 0`, `totalProcessedMessageCount: 0`.
4. Получить список уникальных пользователей пака: `DialogMember.distinct('userId', { tenantId, dialogId: { $in: packDialogIds } })` (та же логика, что в packController.getUsers).
5. Для каждого **userId** из списка по очереди:
   - Найти диалоги пака, где пользователь участник: `memberDialogIds = packDialogIds.filter(d => userDialogIds.includes(d))`, где `userDialogIds` — диалоги пользователя (можно получить один раз для userId через DialogMember.find({ userId, tenantId }).select('dialogId') и пересечь с packDialogIds).
   - Для каждого dialogId из memberDialogIds:
     - `applyMarkDialogAllRead(tenantId, userId, dialogId, actorId, actorType, { lastSeenAt: readUntil })`
     - `markDialogMessagesAsReadUntil(tenantId, dialogId, userId, readUntil, { timeoutMs: remainingForUser })`
   - Учитывать **общий таймаут** операции: при достижении лимита прекратить цикл по пользователям, вернуть 200 с частичными счётчиками (или 503 — см. ниже).
6. **Таймаут**: общий на всю операцию, например **5–10 минут** (пак может содержать много пользователей; 2 мин на пользователя × N пользователей нереалистично в одном HTTP-запросе). Рекомендация: **5 минут** (300_000 ms). При превышении:
   - **Вариант A**: ответ **503** с сообщением «Timeout; part of users processed» и телом с `processedUsersCount`, `processedDialogsCount`, `totalProcessedMessageCount` (как в markPackAllRead при таймауте).
   - **Вариант B**: ответ **200** с частичными результатами и флагом `timedOut: true`, чтобы клиент мог повторить при необходимости.
   - Рекомендация: **503** для согласованности с markPackAllRead.
7. **readUntil**: один общий `generateTimestamp()` в начале обработки (как в markPackAllRead).
8. Внутри цикла по пользователям для каждого пользователя выделять «оставшийся» таймаут (например `remainingMs = totalTimeoutMs - (Date.now() - startTime)`), и передавать в `markDialogMessagesAsReadUntil` не более этого значения; при `remainingMs <= 0` выходить из циклов и возвращать 503.

---

## 5. Ответ

Успех (200):

```json
{
  "data": {
    "packId": "...",
    "processedUsersCount": 12,
    "processedDialogsCount": 28,
    "totalProcessedMessageCount": 156
  },
  "message": "Pack marked as read for all users"
}
```

При таймауте (503): те же поля в теле ответа + `error`, `message` с указанием на таймаут.

---

## 6. Затрагиваемые компоненты

| Компонент | Изменения |
|-----------|-----------|
| **packController** | Новый метод `markAllReadForAllUsers`: проверка Pack, getPackDialogIds, получение userIds через DialogMember.distinct, цикл по userId → для каждого цикл по диалогам (applyMarkDialogAllRead + markDialogMessagesAsReadUntil), учёт общего таймаута, при таймауте — 503. |
| **packRoutes** | Новый маршрут POST `/:packId/markAllReadForAllUsers`, validatePackId, requirePermission('write'), вызов packController.markAllReadForAllUsers. |
| **packStatsUtils** | Переиспользование `getPackDialogIds` (без изменений). |
| **dialogMemberUtils** | Переиспользование `applyMarkDialogAllRead` (без изменений). |
| **dialogReadTaskUtils** | Переиспользование `markDialogMessagesAsReadUntil` (без изменений). |
| **Валидация** | Только validatePackId из URL; тело пустое — без схемы. |
| **Swagger** | Описание POST markAllReadForAllUsers в группе Packs. |
| **Тесты** | Интеграционный тест: пак с несколькими диалогами и несколькими пользователями; вызов markAllReadForAllUsers; проверка обнуления UserPackUnreadBySenderType / UserDialogStats и MessageStatus = read для всех затронутых пользователей; 404 при отсутствии пака; при необходимости — 503 при таймауте (можно с моком/ускоренным таймаутом). |

---

## 7. Детали реализации (контроллер)

- Импорты в packController: добавить `getPackDialogIds` из `@chat3/utils/packStatsUtils.js`, `applyMarkDialogAllRead` из `../utils/dialogMemberUtils.js`, `markDialogMessagesAsReadUntil` из `@chat3/utils/dialogReadTaskUtils.js`, `generateTimestamp` из `@chat3/utils/timestampUtils.js`. Actor из существующей функции `resolveEventActor(req)`.
- Получение userIds: как в getUsers — `DialogMember.distinct('userId', { tenantId, dialogId: { $in: packDialogIds } })`.
- Для каждого userId нужно знать «диалоги пака, где пользователь участник». Варианты:
  - **A**: Для каждого userId вызвать `DialogMember.find({ tenantId, userId, dialogId: { $in: packDialogIds } }).select('dialogId').lean()` → список memberDialogIds для этого пользователя. Просто и ясно.
  - **B**: Один раз загрузить все пары (userId, dialogId) по packDialogIds и сгруппировать по userId. Эффективнее по числу запросов, но сложнее. Для первой итерации достаточно варианта A.
- Константа таймаута: например `PACK_MARK_ALL_READ_FOR_ALL_USERS_TIMEOUT_MS = 300_000` (5 мин).
- Ошибки: 404 Pack not found; 503 при таймауте; 500 при прочих ошибках.

---

## 8. Открытые решения

| # | Вопрос | Рекомендация |
|---|--------|--------------|
| 1 | Общий таймаут (секунды) | 300 (5 минут). |
| 2 | При таймауте: 503 с частичными счётчиками или 200 + timedOut | 503 с телом data (processedUsersCount, …), как в markPackAllRead. |
| 3 | Нужна ли отдельная permission (например admin) | Оставить requirePermission('write') для Packs; при необходимости позже ввести отдельную роль. |
| 4 | Оптимизация: один запрос для всех (userId, dialogId) по паку | Опционально на втором этапе; для первой версии — цикл по пользователям с запросом DialogMember по (userId, dialogId ∈ packDialogIds). |

---

## 9. Итоговый чеклист реализации

- [ ] **packController.markAllReadForAllUsers**: проверка Pack, getPackDialogIds, distinct userIds, цикл по userId с учётом таймаута; для каждого пользователя — memberDialogIds, затем applyMarkDialogAllRead + markDialogMessagesAsReadUntil по каждому диалогу; ответ 200/503/404/500.
- [ ] **packRoutes**: POST `/:packId/markAllReadForAllUsers`, apiAuth, requirePermission('write'), validatePackId.
- [ ] **Swagger**: описание эндпоинта в Packs.
- [ ] **Интеграционный тест**: пак, несколько диалогов, несколько пользователей; вызов markAllReadForAllUsers; проверка счётчиков и MessageStatus; 404; при необходимости — таймаут 503.

После реализации этот план можно считать выполненным; при расхождении с кодом — актуализировать документ.
