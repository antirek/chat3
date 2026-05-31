# План PR3: `sourceEventType` + `updateType` (вариант 2)

**Статус:** реализовано (PR3 / 0.0.77)  
Связано: [UPDATES_UI_TARGETS.md](./UPDATES_UI_TARGETS.md) §2.4, §12, P13, PR1 `context` v3

---

## 1. Проблема

В документе **Update** одно поле `eventType` смешивает две роли:

| Что хранится | Пример | Кто пишет |
|--------------|--------|-----------|
| Доменное событие (Event) | `message.create`, `dialog.member.add` | update-worker |
| Тип Update (push) | `user.stats.update`, `dialog.member.changed` | counter-worker |

**Происхождение** задаёт **`eventId`** → запись в `Event`.  
**Что за Update** — отдельное поле с пространством имён **`update.*`**, не пересекающимся с Event.

---

## 2. Целевая модель

### 2.1. Top-level поля Update

```json
{
  "eventId": "evt_abc…",
  "sourceEventType": "message.create",
  "updateType": "update.user",
  "userId": "bob",
  "entityId": "bob",
  "data": {
    "user": { "stats": { "totalUnreadCount": 3, … } },
    "context": {
      "version": 4,
      "uiTarget": "users.list",
      "includedSections": ["user"],
      "updatedFields": ["user.stats.totalUnreadCount"]
    }
  }
}
```

| Поле | Пространство имён | Смысл |
|------|-------------------|--------|
| **`eventId`** | `evt_*` | ссылка на **Event** |
| **`sourceEventType`** | **`EventType`** | denorm: `Event.eventType` для `eventId` |
| **`updateType`** | **`update.*`** | корень payload / семейство Update; **не** EventType |

**Инварианты:**

- `updateType.startsWith('update.')`
- `updateType ∉ EventType`
- суффикс `.update` в Event (`message.update`) **не** используется в `updateType` — только префикс `update.`

### 2.2. Три значения `updateType`

| `updateType` | Было (PascalCase / Update.eventType) | Кто шлёт | Типичный `uiTarget` |
|--------------|--------------------------------------|----------|---------------------|
| **`update.message`** | MessageUpdate; `message.create`, `message.status.update`, … | update-worker | `messages.list` |
| **`update.dialog`** | DialogUpdate, DialogMemberUpdate, TypingUpdate; `dialog.create`, `dialog.typing`, `dialog.member.*`, … | update-worker + counter | `dialogs.list` или `messages.list` (typing) |
| **`update.user`** | UserUpdate, UserStatsUpdate; `user.add`, `user.stats.update`, … | update-worker + counter | `users.list` |

**`updateType` ≠ `uiTarget`:** typing — `update.dialog`, но `uiTarget: messages.list`. Клиент маршрутизирует по **`context.uiTarget`** и **`updatedFields`**, не только по `updateType`.

### 2.3. Будущее: симметрия `event.*` / `update.*`

Сейчас Event остаётся `message.create`, … PR3 вводит только **`update.*`** на стороне Update. Позже (отдельный breaking) Event можно перевести на `event.message.create` — схема симметрична.

---

## 3. Маппинг domain Event → Update

### 3.1. update-worker

| `sourceEventType` (примеры) | `updateType` |
|-----------------------------|--------------|
| `message.create`, `message.changed`, `message.status.changed`, `message.reaction.changed` | `update.message` |
| `dialog.create`, `dialog.changed`, `dialog.delete`, `dialog.topic.create`, `dialog.topic.changed` | `update.dialog` |
| `dialog.member.add`, `dialog.member.remove`, `dialog.member.changed` | `update.dialog` |
| `dialog.typing` | `update.dialog` |
| `user.add`, `user.changed`, `user.remove` | `update.user` |

Полная таблица по массивам `shouldCreateUpdate` — **§10.1**.

### 3.2. counter-worker

| `sourceEventType` (из slice) | `updateType` | Секция в payload |
|--------------------------------|--------------|------------------|
| `message.create`, … | `update.user` | `user.stats` (full snapshot) |
| то же | `update.dialog` | `member.state.unreadCount`, … |

Отдельного `user.stats.update` / `update.user.stats` **нет** — stats это **`update.user`** + `updatedFields: ['user.stats.*', …]`.

### 3.3. Один Event → несколько Updates

Пример `message.create` для bob:

| `sourceEventType` | `updateType` | `uiTarget` | Получатель |
|-------------------|--------------|------------|------------|
| `message.create` | `update.message` | `messages.list` | members диалога |
| `message.create` | `update.dialog` | `dialogs.list` | slice.userDialogs |
| `message.create` | `update.user` | `users.list` | slice.userIds |

Dedup R4: unique `(tenantId, eventId, userId, updateType, entityId)` — §10.3.

---

## 4. RabbitMQ routing — подробно

### 4.1. Два разных «типа» (источник путаницы)

В документации слово **updateType** использовалось в двух смыслах:

| | Поле в документе Update | Последний сегмент routing key |
|--|-------------------------|-------------------------------|
| **Смысл** | канонический тип Update | метка для AMQP binding |
| **Сейчас** | нет отдельного поля; путается с `eventType` | `messageupdate`, `userstatsupdate`, … |
| **После PR3** | **`update.message`**, `update.dialog`, `update.user` | **`message`**, `dialog`, `user` (см. §4.4) |

Дальше в этом плане:

- **`updateType`** — только поле в JSON/Mongo;
- **routing segment** (или **routing slug**) — только последний сегмент ключа RabbitMQ.

### 4.2. Формат routing key (не меняется структура)

```
update.{category}.{userType}.{userId}.{routingSegment}
```

| Сегмент | Откуда | Примеры |
|---------|--------|---------|
| `update` | константа (имя exchange family) | `update` |
| **`category`** | правило по `updateType` (см. §4.3) | `dialog`, `user` |
| **`userType`** | `User.type` получателя | `user`, `bot` |
| **`userId`** | `Update.userId` | `carl`, `agent_1` |
| **`routingSegment`** | производная от `updateType` (§4.4) | `message`, `dialog`, `user` |

**Примеры полных ключей после PR3:**

```
update.dialog.user.carl.message     ← update.message для carl
update.dialog.user.carl.dialog      ← update.dialog (member unread, typing, meta)
update.user.user.carl.user          ← update.user (profile или stats)
```

Монитор подписывается на **те же** шаблоны, подставляя `userId` наблюдаемого агента.

### 4.3. `category` — не то же самое, что `updateType`

**`category`** — грубая группа для AMQP (исторически «dialog-очередь» vs «user-очередь»):

| `updateType` | `category` | Почему |
|--------------|------------|--------|
| `update.message` | **`dialog`** | лента сообщений привязана к dialog-exchange (как сейчас MessageUpdate) |
| `update.dialog` | **`dialog`** | sidebar / typing |
| `update.user` | **`user`** | users.list |

То есть **`update.message`** попадает в ключ с **`category=dialog`**, не `category=message`. Это уже так в коде (`publishUpdate` в `updateUtils.ts`).

### 4.4. Как получить `routingSegment` из `updateType`

**Правило PR3:** взять часть после префикса `update.`:

```
update.message  →  routingSegment = message
update.dialog   →  routingSegment = dialog
update.user     →  routingSegment = user
```

Функция в коде: `resolveUpdateRoutingSegment(updateType: UpdateType): string`.

Routing key собирается так:

```typescript
const category = updateType === 'update.user' ? 'user' : 'dialog';
const routingSegment = updateType.slice('update.'.length); // message | dialog | user
const routingKey = `update.${category}.${userType}.${userId}.${routingSegment}`;
```

### 4.5. Было → станет (конкретные ключи)

Сейчас **6** разных последних сегментов (PascalCase → lowercase):

| Было (Update.eventType / kind) | Routing key (пример для carl) |
|--------------------------------|-------------------------------|
| MessageUpdate / `message.create` | `update.dialog.user.carl.**messageupdate**` |
| TypingUpdate / `dialog.typing` | `update.dialog.user.carl.**typingupdate**` |
| DialogUpdate | `update.dialog.user.carl.**dialogupdate**` |
| DialogMemberUpdate / counter | `update.dialog.user.carl.**dialogmemberupdate**` |
| UserUpdate | `update.user.user.carl.**userupdate**` |
| UserStatsUpdate / counter | `update.user.user.carl.**userstatsupdate**` |

После PR3 — **3** сегмента:

| `updateType` | Routing key (пример) | Что слилось |
|--------------|----------------------|-------------|
| `update.message` | `update.dialog.user.carl.**message**` | только MessageUpdate |
| `update.dialog` | `update.dialog.user.carl.**dialog**` | DialogUpdate + DialogMemberUpdate + TypingUpdate |
| `update.user` | `update.user.user.carl.**user**` | UserUpdate + UserStatsUpdate |

### 4.6. Что это значит для подписок (breaking)

| Binding до PR3 | Матчит после PR3? |
|----------------|-------------------|
| `update.dialog.user.carl.*` | **да** — все dialog-category Updates по-прежнему |
| `update.user.user.carl.*` | **да** |
| `update.*.user.carl.*` | **да** |
| `update.dialog.user.carl.messageupdate` | **нет** → нужен `…message` |
| `update.dialog.user.carl.typingupdate` | **нет** → нужен `…dialog` + фильтр `uiTarget` |
| `update.dialog.user.carl.dialogmemberupdate` | **нет** → `…dialog` |
| `update.user.user.carl.userstatsupdate` | **нет** → `…user` |

**Вывод:** wildcard-биндинги `*.carl.*` переживают миграцию; **точные** биндинги на старые slug (`messageupdate`, `userstatsupdate`) — **breaking**, обновить при bump **0.0.77**.

Fine-grained фильтр «только stats, не profile» через AMQP **исчезает** — stats и profile оба `…user`. Фильтрация: **`context.updatedFields`** / **`uiTarget`** в payload (канон с PR1).

Fine-grained «только typing» через AMQP **исчезает** — typing и member unread оба `…dialog`. Фильтрация: **`uiTarget === 'messages.list'`** для typing.

### 4.7. Альтернатива (не выбираем)

Можно было оставить старые slug (`messageupdate`, …) и только сменить поле в документе — меньше breaking для RabbitMQ, но **два namespace** (document `update.message` vs key `messageupdate`) хуже для integrator. PR3: **slug = хвост `updateType`**.

### 4.8. Будущее (вне PR3)

[UPDATES_UI_TARGETS.md](./UPDATES_UI_TARGETS.md) §9.3: routing v2 с `uiTarget` в ключе:

```
update.{uiTarget}.{userType}.{userId}.{routingSegment}
```

Пример: `update.messages.list.user.carl.message`. Отдельный breaking, не в PR3.

---

## 5. `data.context` v4

| Поле | v3 | v4 |
|------|----|----|
| `sourceEventType` | в context | **убрать** — top-level Update |
| `sourceEventId` | в context | **убрать** — top-level `eventId` |
| `eventType` в context | domain / `user.changed` (хак) | **убрать** |
| `uiTarget`, `updatedFields`, `includedSections` | да | да |
| `dialogId`, `messageId`, `entityId`, … | да | да |
| `version` | 3 | **4** |

**Важно:** v4 относится **только** к `Update.data.context`.  
`Event.data.context` (tenant-api, outbox) **остаётся v3** с полем `eventType` — контекст доменного события, не Update. См. §5.1.

Lineage (`eventId`, `sourceEventType`) и семейство payload (`updateType`) — top-level Update.

---

## 5.1. `eventUtils.ts` — context v4 и `uiTarget`

### 5.1.1. Два контекста, не путать

| Функция | Для чего | Меняется в PR3? |
|---------|----------|-----------------|
| **`buildEventContext`** | `Event.data` при outbox / tenant-api | **нет** (v3, `eventType` остаётся) |
| **`finalizeUpdateContext`** | `Update.data.context` | **да** (v4, новая сигнатура) |
| **`resolveUiTargetForEvent`** | `uiTarget` в Event context | переименование текущего `resolveUiTarget` |
| **`resolveUiTargetForUpdate`** | `uiTarget` в Update context | **новая** |

### 5.1.2. Константы

```typescript
/** Event.data.context — без изменений в PR3 */
const EVENT_CONTEXT_VERSION = 3;

/** Update.data.context */
const UPDATE_CONTEXT_VERSION = 4;

export type UpdateType = 'update.message' | 'update.dialog' | 'update.user';
```

В `finalizeUpdateContext` — **`UPDATE_CONTEXT_VERSION` (4)**, не общий `EVENT_PAYLOAD_VERSION`.

### 5.1.3. `resolveUiTargetForUpdate(updateType, sourceEventType)`

**Правило:** `uiTarget` = **куда применить в UI**, не «как называется updateType».

```typescript
export function resolveUiTargetForUpdate(
  updateType: UpdateType,
  sourceEventType: EventType | string
): UiTarget {
  switch (updateType) {
    case 'update.message':
      return 'messages.list';
    case 'update.user':
      return 'users.list';
    case 'update.dialog':
      return sourceEventType === 'dialog.typing'
        ? 'messages.list'
        : 'dialogs.list';
  }
}
```

| `updateType` | `sourceEventType` (примеры) | `uiTarget` |
|--------------|----------------------------|------------|
| `update.message` | `message.create`, `message.status.changed`, … | `messages.list` |
| `update.dialog` | `dialog.create`, `dialog.member.changed`, … | `dialogs.list` |
| `update.dialog` | **`dialog.typing`** | **`messages.list`** |
| `update.user` | `user.add`, `message.create` (counter stats), … | `users.list` |

**Не** восстанавливать таблицу с ключами `user.stats.update` / `message.create` для Update — после PR3 pseudo update types не используются.

**Override:** явный `context.uiTarget` на входе **имеет приоритет** над resolver (сейчас `create*Update` не используют).

### 5.1.4. `resolveUiTargetForEvent(eventType)` — для Event

Текущий `resolveUiTarget` → **`resolveUiTargetForEvent`**. Карта по **`EventType`**, **без** `user.stats.update`:

```typescript
const UI_TARGET_BY_EVENT_TYPE: Partial<Record<EventType, UiTarget>> = {
  'message.create': 'messages.list',
  'message.changed': 'messages.list',
  'message.status.changed': 'messages.list',
  'message.reaction.changed': 'messages.list',
  'dialog.typing': 'messages.list',
  'dialog.create': 'dialogs.list',
  'dialog.changed': 'dialogs.list',
  // … dialog.member.*, dialog.topic.*, user.add/changed/remove
};
```

Только для **`buildEventContext`**. Опционально alias `resolveUiTarget` → `resolveUiTargetForEvent`.

### 5.1.5. `finalizeUpdateContext` — новая сигнатура

**Было (v3):**

```typescript
finalizeUpdateContext(context, updateEventType, sourceEventId, sourceEventType?)
```

**Станет (v4):**

```typescript
export function finalizeUpdateContext(
  context: Record<string, unknown>,
  updateType: UpdateType,
  sourceEventType: EventType | string
): Record<string, unknown> {
  const {
    eventType: _e,
    sourceEventType: _s,
    sourceEventId: _id,
    uiTarget: explicitUiTarget,
    ...rest
  } = context;

  const uiTarget =
    (explicitUiTarget as UiTarget | undefined)
    ?? resolveUiTargetForUpdate(updateType, sourceEventType);

  return {
    ...rest,
    version: UPDATE_CONTEXT_VERSION,
    uiTarget
  };
}
```

1. **Strip** legacy: `eventType`, `sourceEventType`, `sourceEventId`.
2. **Не добавляет** lineage — только `version`, `uiTarget`, координаты (`dialogId`, `includedSections`, …).
3. **`eventId` только top-level** на Update.

### 5.1.6. `withUpdateContext` в `updateUtils.ts`

```typescript
function withUpdateContext(
  context: Record<string, unknown>,
  updateType: UpdateType,
  sourceEventType: string
): Record<string, unknown> {
  return eventUtils.finalizeUpdateContext(context, updateType, sourceEventType);
}
```

| Creator | `updateType` | `sourceEventType` |
|---------|--------------|-------------------|
| `createMessageUpdate` | `update.message` | domain `eventType` |
| `createDialogUpdate` | `update.dialog` | domain `eventType` |
| `createDialogMemberUpdate` (worker) | `update.dialog` | domain `eventType` |
| `createDialogMemberUpdate` (counter) | `update.dialog` | **`slice.sourceEventType`** |
| `createTypingUpdate` | `update.dialog` | `dialog.typing` |
| `createUserUpdate` | `update.user` | domain `eventType` |
| `createUserStatsUpdate` | `update.user` | **`slice.sourceEventType`** |

### 5.1.7. `createUserStatsUpdate` — убрать хак P10

**Было:** `buildEventContext({ eventType: 'user.changed' })` + `finalizeUpdateContext(..., 'user.stats.update', …)`.

**Станет:** plain object + `withUpdateContext(base, 'update.user', sourceEventType)` — без `buildEventContext`, без fake `user.changed`.

### 5.1.8. Counter `createDialogMemberUpdate`

Убрать из synthetic context `eventType: 'dialog.member.changed'`. Оставить `dialogId`, `includedSections`, `updatedFields`.  
На документе Update: `updateType: 'update.dialog'`, `sourceEventType: slice.sourceEventType` (например `message.create`).

### 5.1.9. `buildEventContext` — без изменений PR3

- `version: EVENT_CONTEXT_VERSION` (3)
- поле **`eventType`** (domain)
- `uiTarget` через `resolveUiTargetForEvent`

Event context **не** поднимаем до v4 в этом PR.

### 5.1.10. Пример итогового Update

```json
{
  "eventId": "evt_abc",
  "sourceEventType": "message.create",
  "updateType": "update.user",
  "userId": "bob",
  "data": {
    "user": { "stats": { "totalUnreadCount": 3 } },
    "context": {
      "version": 4,
      "uiTarget": "users.list",
      "entityId": "bob",
      "includedSections": ["user"],
      "updatedFields": ["user.stats.totalUnreadCount"]
    }
  }
}
```

### 5.1.11. Тесты `eventUtils.test.js`

| Тест | Assert |
|------|--------|
| `resolveUiTargetForUpdate('update.dialog', 'dialog.typing')` | `messages.list` |
| `resolveUiTargetForUpdate('update.dialog', 'message.create')` | `dialogs.list` |
| `resolveUiTargetForUpdate('update.user', 'message.create')` | `users.list` |
| `finalizeUpdateContext` | `version === 4`, нет legacy полей |
| `buildEventContext` | `version === 3`, есть `eventType` |

---

## 6. Изменения в коде

### 6.1. Модель `Update`

```typescript
export type UpdateType = 'update.message' | 'update.dialog' | 'update.user';

interface IUpdate {
  eventId: string;
  sourceEventType: EventType;
  updateType: UpdateType;
  // eventType — удалить (breaking)
}
```

Индексы: `{ tenantId, userId, updateType, createdAt }`; dedup unique §10.3 `(tenantId, eventId, userId, updateType, entityId)`.

### 6.2. `updateUtils.ts`

- `create*Update` — **`sourceEventType`**, **`updateType`** на документе (§3, §5.1.6).
- **`withUpdateContext`** → §5.1.6; **`createUserStatsUpdate`** → §5.1.7; counter member → §5.1.8.
- `getUpdateTypeFromEventType` → **`resolveUpdateRoutingSegment(updateType)`**.
- `publishUpdate`: routing §4.3–4.4.

### 6.2.1. `eventUtils.ts`

§5.1 — `finalizeUpdateContext`, `resolveUiTargetForUpdate`, `resolveUiTargetForEvent`, константы v3/v4.

### 6.3. Workers

- **update-worker:** `sourceEventType = event.eventType`, `updateType` по §3.1
- **counter-worker:** `sourceEventType = slice.sourceEventType`, `update.user` / `update.dialog`

### 6.4. Integrator

```javascript
// куда применить — по uiTarget (канон)
switch (u.data.context.uiTarget) {
  case 'messages.list': …
  case 'dialogs.list': …
  case 'users.list': …
}

// опционально — семейство payload
if (u.updateType === 'update.user' && u.data.context.updatedFields.some(f => f.startsWith('user.stats.'))) {
  store.users[id].stats = u.data.user.stats;
}
```

---

## 7. Миграция (breaking 0.0.77)

- Поле **`eventType`** в Update удаляется → **`sourceEventType`** + **`updateType`**
- RabbitMQ последний сегмент: `messageupdate` → `message`, и т.д.
- Dual-write **не** планируется
- Docs: `INTEGRATION.md`, `UPDATES.md`, `UPDATES_UI_TARGETS.md` §2.4

---

## 8. Тесты

- §5.1.11 — unit `eventUtils`
- `resolveUpdateRoutingSegment('update.user')` → `'user'`
- `update.message` → key `update.dialog.{userType}.{id}.message`
- `updateType` never in `EVENT_TYPE_ENUM`
- counter/update integration: три поля на документе
- assert старые slug не публикуются

---

## 9. Этапы (R6)

| ID | Задача |
|----|--------|
| **R6a** | `UpdateType` + модель + `resolveUpdateRoutingSegment` |
| **R6b** | все `create*Update`, workers, `publishUpdate` |
| **R6c** | context v4 + `eventUtils` §5.1 |
| **R6d** | docs + INTEGRATION breaking |
| **R6e** | unique dedup index §10.3 — **в PR3** |

---

## 10. Appendix — оставшиеся решения для реализации

### 10.1. Полный маппинг Event → Update (update-worker)

Источник: `DIALOG_*` / `MESSAGE_*` / … в `updateUtils.ts` → `shouldCreateUpdate`.

| `sourceEventType` | Updates от update-worker | `updateType` | Примечание |
|-------------------|--------------------------|--------------|------------|
| `message.create` | MessageUpdate × members | `update.message` | |
| `message.changed` | MessageUpdate | `update.message` | |
| `message.status.changed` | MessageUpdate | `update.message` | |
| `message.reaction.changed` | MessageUpdate | `update.message` | |
| `dialog.create` | DialogUpdate × members | `update.dialog` | |
| `dialog.changed` | DialogUpdate | `update.dialog` | |
| `dialog.delete` | DialogUpdate | `update.dialog` | |
| `dialog.member.add` | DialogUpdate | `update.dialog` | **не** DialogMemberUpdate |
| `dialog.member.remove` | DialogUpdate | `update.dialog` | |
| `dialog.member.changed` | DialogMemberUpdate × 1 user | `update.dialog` | |
| `dialog.topic.create` | DialogUpdate | `update.dialog` | |
| `dialog.topic.changed` | DialogUpdate | `update.dialog` | |
| `dialog.typing` | TypingUpdate × members − typer | `update.dialog` | `uiTarget`: messages.list |
| `user.add` | UserUpdate | `update.user` | |
| `user.changed` | UserUpdate | `update.user` | |
| `user.remove` | UserUpdate | `update.user` | |

**Не создают Updates:** `pack.*`, `dialog.messages.bulk_read`, counter-only pseudo-types.

**Counter-worker** (всегда `sourceEventType` из slice):

| Trigger Event (примеры) | `updateType` | Creator |
|-------------------------|--------------|---------|
| любой counter event | `update.user` | `createUserStatsUpdate` |
| то же | `update.dialog` | `createDialogMemberUpdate` per `userDialogs` |

### 10.2. Checklist файлов PR3

| Пакет | Файл | Изменение |
|-------|------|-----------|
| models | `packages-shared/models/src/operational/Update.ts` | `sourceEventType`, `updateType`; убрать `eventType`; индексы §10.4 |
| models | `packages-shared/models/src/index.ts` | export `UpdateType` |
| utils | `packages-shared/utils/src/eventUtils.ts` | §5.1 |
| utils | `packages-shared/utils/src/updateUtils.ts` | все `create*Update`, `publishUpdate`, routing |
| utils | `packages-shared/utils/src/rabbitmqUtils.ts` | лог: `updateType` вместо `eventType` |
| utils | `packages-shared/utils/src/counterProcessor/publishCounterUpdates.ts` | §5.1.8 |
| utils | `packages-shared/utils/src/__tests__/eventUtils.test.js` | §5.1.11 |
| utils | `packages-shared/utils/src/__tests__/publishCounterUpdates.test.js` | assert top-level полей |
| utils | `packages-shared/utils/src/__tests__/processUpdateEvent.test.js` | `updateType` / `sourceEventType` |
| utils | `packages-shared/utils/src/__tests__/counterGoldenFixtures.test.js` | query по `updateType` |
| tenant-api | `controllers/__tests__/counterStack.integration.test.js` | |
| tenant-api | `controllers/__tests__/updateStack.integration.test.js` | |
| tenant-api | `utils/__tests__/updateUtils.test.js` | большой файл assert'ов |
| controlo | `controlo-backend/.../eventsController.ts` | отдавать `updateType`, `sourceEventType` |
| controlo | `controlo-ui/.../EventsModal.vue`, `DialogEventsModal.vue` | колонки UI |
| controlo | `controlo-ui/.../useEntityModals.ts` | dedup key |
| docs | `UPDATES.md`, `INTEGRATION.md`, `UPDATES_UI_TARGETS.md` §2.4 | breaking 0.0.77 |

### 10.3. Dedup index (R6e) — **в PR3**

**Unique index:**

```javascript
{ tenantId: 1, eventId: 1, userId: 1, updateType: 1, entityId: 1 }
```

**Почему `entityId` в ключе:** на одно `message.create` counter может слать несколько `update.dialog` одному `userId` для **разных** `dialogId` (редко, но возможно в bulk). Без `entityId` второй Update упадёт на unique.

**Поведение при duplicate:** `Update.create` → catch duplicate key → log + skip (идемпотентность retry outbox), не fail worker.

**Не в scope PR3:** merge двух payload при collision — last-write-wins достаточно.

### 10.4. Mongo: старые документы

- **Backfill не делаем** — breaking release **0.0.77**, dual-write нет.
- Старые записи с `eventType` остаются в коллекции до TTL/ручной очистки; GET/control UI читают только новую схему.
- Индексы: **добавить** `{ tenantId, userId, updateType, createdAt }`, **удалить** `{ tenantId, userId, eventType, createdAt }`.
- Mongoose: `eventType` required → удалить; `sourceEventType` + `updateType` required.

### 10.5. Edge-case: два `update.dialog` на один Event

| Сценарий | Решение |
|----------|---------|
| counter: несколько диалогов в `userDialogs` для одного user | несколько Updates, разный `entityId` — OK с index §10.3 |
| update-worker `dialog.member.changed` + counter на **разных** eventId | разные Updates — OK |
| Теоретически два writer на **один** `(eventId, userId, updateType, entityId)` | unique index → второй skip; payload должен быть идемпотентным (full snapshot) |

### 10.6. Порядок реализации (R6)

```text
R6a  Update model + UpdateType enum + resolveUpdateRoutingSegment
R6b  eventUtils §5.1 (finalizeUpdateContext, resolveUiTargetForUpdate)
R6c  create*Update + publishUpdate + publishCounterUpdates
R6d  unique index + duplicate handling
R6e  тесты (§8, §5.1.11, integration)
R6f  docs + controlo + bump 0.0.77
```

---

## 11. Готовность плана

| Блок | Статус |
|------|--------|
| Модель + 3× `updateType` | ✅ |
| Routing §4 | ✅ |
| `eventUtils` §5.1 | ✅ |
| Полный Event map §10.1 | ✅ |
| File checklist §10.2 | ✅ |
| Dedup §10.3 | ✅ |
| Mongo §10.4 | ✅ |
| Порядок работ §10.6 | ✅ |

**План готов к реализации PR3.** Следующий шаг — код по §10.6 (R6a).

---

## 12. Связанные документы

- [UPDATES_UI_TARGETS.md](./UPDATES_UI_TARGETS.md)
- [UPDATES.md](./UPDATES.md)
- [INTEGRATION.md](./INTEGRATION.md)
- [USER_PACK_STATS_UPDATE_PUSH_REMOVAL_PLAN.md](./USER_PACK_STATS_UPDATE_PUSH_REMOVAL_PLAN.md)
