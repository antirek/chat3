# План: фильтр `message.createdAt` в `GET /api/dialogs` (все диалоги тенанта)

## 1. Цель

Расширить **`GET /api/dialogs`** (`dialogController.getAll`) тем же продуктовым смыслом, что и для списка диалогов пользователя: отобрать **диалоги тенанта**, в которых за заданное условие по времени есть **хотя бы одно сообщение** (`Message.createdAt`), с **AND** к существующим фильтрам **meta** и **member**.

Эндпоинт: `packages/tenant-api/src/routes/dialogRoutes.ts` → `dialogController.getAll` (`packages/tenant-api/src/controllers/dialogController.ts`).

---

## 2. Отличия от `GET /api/users/:userId/dialogs`

| Аспект | Пользовательские диалоги | Все диалоги тенанта |
|--------|---------------------------|---------------------|
| Область | Только диалоги, где пользователь — участник | Все диалоги с `tenantId` |
| После `Message.distinct` | Пересечь с `DialogMember` для `userId` | **Не** фильтровать по участнику; достаточно `tenantId` в запросе к `Message` |
| Слияние с `dialogIds` | Как сейчас (meta/topic/member → пересечение) | Та же схема: если уже есть `dialogIds` из meta/member — **пересечение**; если `null` — присвоить множество из `distinct` |

Семантика **`message.createdAt`**, правила **24 ч**, **секунды &lt; 1e12**, запрет **`message.*` кроме `createdAt`**, запрет **`$or` на верхнем уровне вместе с `message`** — **по аналогии** с уже реализованным `userDialogMessageFilterUtils.ts` и блоком в `userDialogController.getUserDialogs`.

---

## 3. Точки внедрения в `dialogController.getAll`

Сейчас поток (упрощённо):

1. `parseFilters` → `extractMetaFilters`
2. При **`branches`** (`$or`): `queryFromOrFilter = { tenantId, ...buildFilterQuery('dialog', parsedFilters) }`
3. Иначе: циклы по **meta** и **processMemberFilters** → `dialogIds`
4. `query = { tenantId }` + `Object.assign(query, otherRegularFilters)` — сюда **не** должен попадать объект **`message`**
5. При непустом `dialogIds`: `query.dialogId = { $in: dialogIds }`

### 3.1. Шаги реализации

1. **Сразу после `parseFilters`** (до `extractMetaFilters`):
   - `assertFilterNotOrWithMessage(rawParsed)` → при ошибке **400** (тот же текст, что и для user-dialogs, или общий константный модуль).
   - `collectMessageCreatedAtCondition(rawParsed)` → при ошибке **400**; при непустом условии:
     - `Message.distinct('dialogId', { tenantId, createdAt })`
     - если результат **пустой** — ранний ответ `data: []`, `pagination.total: 0` (как при пустом `dialogIds` после meta).
     - иначе влить в **`dialogIds`**: `null` → присвоить; иначе **пересечение**.
2. **`parsedFilters = stripMessageFilterFromParsed(rawParsed)`** и дальше **`extractMetaFilters(parsedFilters)`** — как в user-dialogs, чтобы **`message`** не участвовал в `buildFilterQuery` и не попал в **`otherRegularFilters`**.
3. Ветка **`branches`**: использовать **`parsedFilters` после strip** в `buildFilterQuery` (сейчас в код передаётся полный `parsedFilters` из переменной — после правки это будет stripped).
4. Убедиться, что в финальный **`query`** не попадает ключ **`message`** (при необходимости явно исключить в деструктуризации `regularFilters`, как в `userDialogController` для `dialogMembersQuery`).

### 3.2. Дедупликация кода (рекомендация)

Вынести в **`userDialogMessageFilterUtils.ts`** (или новый тонкий модуль) общую функцию вида:

`async function resolveMessageCreatedAtDialogIds(tenantId, rawParsed): Promise<{ ok: false, status: 400, message: string } | { ok: true, dialogIds: string[] | null }>`

где **`dialogIds`** — уже пересечённый список `dialogId` из сообщений (для user-варианта внутри функции дополнительно пересечь с участником пользователя). Тогда **`getUserDialogs`** и **`getAll`** вызывают одну реализацию и не расходятся по правилам.

Если вынос отложить — допустимо **скопировать блок** из `userDialogController` с заменой «без пересечения с `DialogMember`», но риск расхождения при правках выше.

---

## 4. Тесты

Файл: `packages/tenant-api/src/controllers/__tests__/dialogController.test.js` (или рядом, если структура другая).

Сценарии (по аналогии с user-dialogs):

| # | Сценарий | Ожидание |
|---|-----------|----------|
| 1 | Два диалога в тенанте; сообщение в интервале только в одном | В ответе только этот `dialogId` |
| 2 | `(message.createdAt,...)&(meta.type,eq,...)` | Пересечение meta и сообщений |
| 3 | `\|` + `message.createdAt` | **400** |
| 4 | `\|` только meta | **200** (регрессия), как сейчас |
| 5 | `message.foo` | **400** |
| 6 | Интервал **> 24 ч** при двух границах | **400** |
| 7 | Ветка **`branches`**: фильтр с `$or` без `message` | Поведение без регрессий |

Учёт **`Message` pre-save**: в тестах после `create` выставлять **`createdAt` через `updateOne`**, как в `userDialogController.test.js`.

---

## 5. Документация и UI

- **Swagger** `dialogRoutes.ts`: дополнить описание `filter` примером `message.createdAt` и ограничениями (синхронно с user-dialogs).
- **Краткая заметка** в `plan-message-createdAt-filter-user-dialogs.md` или отдельный абзац в `user-dialogs-messages-yesterday.md` — что тот же фильтр доступен и для **`GET /api/dialogs`** (после реализации).
- **UI** (если есть экран со списком «все диалоги» и полем `filter`): пример в том же стиле, что `dialogFilterExamples` / подсказка; если такого экрана нет — только API-док.

---

## 6. Риски

- **Двойная поддержка** без общего хелпера — расхождение правил (24 ч, OR, секунды).
- **`buildFilterQuery` + `$or`**: после strip в ветках не должно остаться «висячих» ссылок на `message`; ранняя проверка OR+message на **`rawParsed`** закрывает кейс «message в одной из веток `$or`».
- **Нагрузка** `distinct` по большому тенанту — те же ограничения, что и для user-dialogs.

---

## 7. Решения (зафиксировано)

1. **Контракт** — полностью как у **user-dialogs**: те же **400** (OR+`message`, неподдерживаемые поля `message.*`, интервал &gt; 24 ч при двух границах), операнды времени **&lt; 1e12** как секунды, только **`message.createdAt`**.

2. **Общий хелпер vs дублирование** — на усмотрение реализации; логика валидации и `strip` уже в **`userDialogMessageFilterUtils.ts`**, контроллер вызывает те же функции. Отдельный async-хелпер для `distinct` не обязателен.

3. **UI** — экран **controlo-ui** «Диалоги и сообщения» (`dialogs-messages`, `useDialogs` → `GET /api/dialogs`): добавлены примеры фильтра с **`message.createdAt`** в `dialogFilterExamples`.

4. **Права** — достаточно текущего **`requirePermission('read')`** на API; отдельная политика для этого фильтра не вводилась.
