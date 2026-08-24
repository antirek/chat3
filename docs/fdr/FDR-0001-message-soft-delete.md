# FDR-0001: Soft-delete сообщений (флаг deleted, PATCH, event message.deleted)

- Status: draft
- Date: 2026-08-24
- Scope: mms3 / chat3
- Affects:
  - Message model (`deleted`, `deletedAt`, `deletedBy`)
  - tenant-api: PATCH soft-delete / undelete (permission write)
  - GET / enrichment / `quotedMessage` — выдача флага во всех ответах
  - EventType / outbox: `message.deleted`
  - update-worker: `MESSAGE_UPDATE_EVENTS`
  - counter-worker: decrement / increment + идемпотентность
  - (опц.) `tenant-api-client`: `patchMessageDeleted`
- Related ADR: —
- Related issue: #15507

## Context

В модели `Message` нет флага удаления; API умеет create / get / update content / update topic. Диалоги удаляются hard-delete; для сообщений нужен **soft-delete**: документ остаётся в Mongo, помечается удалённым.

Потребители (mone, amone, amax, mabo, tubo / Controlo) сами решают, как показывать удалённые сообщения — MMS3 (chat3) только отдаёт данные и события.

Вход: verify #15507 (Ready; FDR product; ADR не нужен). Решения зафиксированы в description issue 2026-08-24.

ADR не требуется: изменения внутри одного репо chat3 по существующим границам (tenant-api, Message, Event/outbox, update-worker, counter-worker).

## Decision

### 1. Модель Message

1. Добавить поля:
   - **`deleted`** — `Boolean`, default `false`;
   - **`deletedAt`** — `Number | null`, default `null` (тот же numeric timestamp, что `createdAt` / `generateTimestamp()`);
   - **`deletedBy`** — `String | null`, default `null` (id на усмотрение клиента API).
2. Миграция / backfill **не обязателен**: отсутствие поля = `false` / `null`.
3. Индексы по `deleted` — по факту нагрузки; **не блокер MVP**.

### 2. API soft-delete / undelete

4. Операция через **`PATCH`**; permission **write** (любой ключ с write).
5. Undelete **поддерживается** (`deleted: false`).
6. Предпочтительный path: `PATCH /api/messages/:messageId` с body `{ "deleted": true|false, "deletedBy"?: string }`.
7. **Альтернатива** (если конфликтует с другими PATCH/PUT): `PATCH /api/messages/:messageId/deleted` — допустима; **один** вариант выбрать в PR и описать в Swagger (**Open question → PR**).
8. Поведение:
   - `deleted: true` → `deleted=true`, `deletedAt=generateTimestamp()`, `deletedBy` из body (если передан; иначе `null`);
   - `deleted: false` → `deleted=false`, **`deletedAt=null`, `deletedBy=null`** (историю сбрасывать);
   - повторный `deleted: true` на уже удалённом → **200**, без ошибки, **без повторного decrement** счётчиков;
   - валидация: Joi; `deletedBy` — опциональная строка при delete.
9. После soft-delete **разрешены** PUT content, PATCH topic и реакции.

### 3. Чтение (GET / enrichment / цитаты)

10. Во **всех** выдачах сообщений (dialog / user-dialog / packs / getById / getAll / enrichment) отдавать `deleted`, `deletedAt`, `deletedBy`.
11. Soft-deleted **не исключать** из ленты по умолчанию; фильтрация — зона peers/UI.
12. В `quotedMessage`, если оригинал удалён — `deleted: true` (+ `deletedAt` / `deletedBy` при наличии); то же при создании сообщения с `quotedMessageId`.

### 4. Событие и updates

13. Новый тип события **`message.deleted`** (не reuse `message.changed`).
14. Публиковать при soft-delete **и** при undelete: **один** тип `message.deleted`, в data — текущее поле `deleted` (`true`/`false`). Отдельный `message.undeleted` **не** вводить.
15. Update-worker: включить `message.deleted` в `MESSAGE_UPDATE_EVENTS` → realtime update категории message (как create/changed).
16. Controlo / event UI labels — краткое описание типа (без UI кнопки «удалить» в чате).

### 5. Счётчики (counter-worker)

17. Включить `message.deleted` в `COUNTER_EVENT_TYPES`.
18. При `deleted: true` — эффект **decrement** зеркально `message.create` (unread у тех, кому ещё было unread; `totalMessagesCount` отправителя −1; pack stats зеркально).
19. При undelete (`deleted: false`) — **increment** обратно (симметрия) либо полный recalculate slice — выбрать устойчивый вариант без drift на define/PR.
20. Идемпотентность: повторный delete **не** decrement дважды (ProcessedCounterEvent / проверка состояния).
21. Golden fixtures / тесты `counterProcessor` — по необходимости.

### 6. SDK (опционально)

22. Если есть `packages-clients/tenant-api-client` — метод `patchMessageDeleted(messageId, { deleted, deletedBy })` + README.

### Acceptance (проверка #15507)

- Модель + PATCH: delete выставляет поля; undelete сбрасывает; повторный delete идемпотентен.
- GET / list / getById возвращают `deleted*` без исключения из ленты.
- `quotedMessage` содержит `deleted: true`, если оригинал удалён.
- После delete можно PUT content и PATCH topic.
- Событие `message.deleted` в Event/Outbox; update-worker создаёт message-update.
- Счётчики: после delete unread/total/pack уменьшаются; повторный delete без двойного decrement; undelete восстанавливает.
- Swagger / OpenAPI обновлены; unit/integration тесты tenant-api (+ counter golden при необходимости).
- На стенде (tubo-mms3 / mone-mms3): событие и счётчики работают.

### Open questions (не блокируют draft; закрыть в PR / define)

1. Финальный routing: `PATCH /api/messages/:messageId` vs `…/deleted`.
2. Точная стратегия undelete для counters: симметричный increment vs recalculate slice (без drift).

## Consequences

- Peers могут подписаться на `message.deleted` и читать флаг в API без hard-delete.
- Реализация затрагивает Message model, tenant-api routes/controller, EventType/outbox, updateUtils, counterProcessor; опционально tenant-api-client.
- Агенты: не тащить Controlo UI и изменения mone/amone/amax/chotto в #15507.
- Query «только неудалённые» по умолчанию **не** вводить в этом FDR.

## Non-goals

- Controlo UI (кнопка «удалить» в чате).
- Изменения peers: mone / amone / amax / chotto / mabo / tubo UI (отдельные задачи).
- Hard-delete / TTL / GDPR wipe content.
- Фильтр ленты «только неудалённые» по умолчанию.
- FDR-S / ADR / смена границ между репо или деплоя.
