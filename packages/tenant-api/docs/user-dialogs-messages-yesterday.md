# Список диалогов пользователя с активностью «вчера» (tenant-api)

## Ответ кратко

Нужный эндпоинт: **`GET /api/users/:userId/dialogs`**.

Он объявлен в `packages/tenant-api/src/routes/userDialogRoutes.ts` и обрабатывается `userDialogController.getUserDialogs`.

Аутентификация и контекст тенанта:

- **`X-Api-Key`** — обязательный заголовок (`apiAuth` в `packages/tenant-api/src/middleware/apiAuth.ts`).
- **`X-Tenant-Id`** — опционально; если не передан, используется `tnt_default`.

Права: `requirePermission('read')`.

---

## Как отфильтровать по «вчера были сообщения»

### Что именно хранится в `lastMessageAt`

В коллекции `userdialogactivities` (`UserDialogActivity`) поле **`lastMessageAt`** — это время **последнего сообщения в диалоге** для данного пользователя (обновляется при создании сообщения для всех участников, см. `messageController.createMessage` и `updateLastMessageAt` в `dialogMemberUtils.ts`).

То есть фильтр по `lastMessageAt` отвечает на вопрос: *«в каких диалогах **последнее** сообщение пришлось на выбранный интервал времени»*, а не на вопрос *«в каких диалогах **хотя бы одно** сообщение было в этот день»*. Если вчера было сообщение, а сегодня — новое, `lastMessageAt` будет указывать на сегодня, и такой диалог **не** попадёт в выборку «только вчера» по этому полю.

Если требуется именно «любое сообщение за вчера», одного `GET .../dialogs` с `lastMessageAt` недостаточно — нужна отдельная логика по коллекции сообщений (например, запросы к `GET /api/users/:userId/dialogs/:dialogId/messages` с фильтром по `createdAt` по каждому диалогу или своя аналитика вне текущего спискового API).

### Фильтр `message.createdAt` (реализовано)

Поддерживается строковый `filter` вида `(message.createdAt,gte,T1)&(message.createdAt,lte,T2)` и односторонние границы. Отбираются диалоги пользователя, в которых есть **хотя бы одно** сообщение с `Message.createdAt` в заданном условии. Операнды — unix-time; значения **&lt; 1e12** трактуются как **секунды** и переводятся в миллисекунды для сравнения с полем в БД. При **двух** конечных границах длина интервала **не больше 24 часов**. Условия по `message.*`, кроме `createdAt`, и сочетание `message` с **ИЛИ** (`|`) в одном `filter` дают **400**. Реализация: `userDialogMessageFilterUtils.ts`, `getUserDialogs` в `userDialogController.ts`.

---

### `lastMessageAt` в активности пользователя

В `getUserDialogs` фильтры по `lastMessageAt` и `lastSeenAt` снимаются с **`UserDialogActivity`** (не с коллекции `Message`). Отдельные query-параметры `lastSeenAt` / нюансы `lastMessageAt` и схема — см. `userDialogsQuerySchema` и блок `activityFilter` в `getUserDialogs`.

---

## Итог

| Вопрос | Ответ |
|--------|--------|
| Какой HTTP-запрос? | `GET /api/users/{userId}/dialogs` |
| Диалоги, где **было** сообщение в интервале по времени создания? | `filter` со строкой, например `(message.createdAt,gte,T1)&(message.createdAt,lte,T2)` (см. § «Фильтр message.createdAt» выше) |
| Как отобрать по **последнему** сообщению (активность)? | Поля `lastMessageAt` / `lastSeenAt` из `UserDialogActivity` в ответе и связанные фильтры в `getUserDialogs` |

Файлы: `userDialogMessageFilterUtils.ts`, `userDialogController.getUserDialogs`, `userDialogRoutes.ts`, `querySchemas.ts` (`userDialogsQuerySchema`).
