# План реализации counter-worker

План **целевой реализации** для **чистой инсталляции** (новый подход с нуля, без поэтапного cutover на legacy-пути). Собирает архитектуру, industry practices и **конкретные задачи**.

**Связанные документы:** [ARCHITECTURE](./COUNTERS_WORKER_ARCHITECTURE.md) · [EVALUATION](./COUNTERS_WORKER_ARCHITECTURE_EVALUATION.md) · [ORDERING](./COUNTERS_WORKER_ORDERING_AND_TENANT_ISOLATION.md) · [INDUSTRY](./CHAT_COUNTERS_INDUSTRY_PRACTICES.md)

---

## 1. Контекст: чистая инсталляция

| Не делаем | Делаем |
|-----------|--------|
| Shadow mode, сравнение со старым API-writer | Сразу **единственный** writer — counter-worker |
| Feature flags `COUNTERS_IN_WORKER` по tenant | **Удаляем** counter-логику из API/hooks в том же релизе |
| Combined worker «на время» | С первого дня **`@chat3/counter-worker`** + **`@chat3/update-worker`** |
| Dual-publish `message.status.update` + `changed` | Сразу **`message.status.changed`** (breaking OK) |
| Пилотный tenant → все tenant | Один стек; на пустой БД — **init full-recalculate** после поднятия |
| Откат через включение старого кода | Откат = откат **релиза**, не переключатель |

**«По уму»** здесь = правильная архитектура (outbox, idempotency, recalculateSlice, отдельные воркеры, тесты, reconcile), а не осторожная миграция legacy-продакшена.

Секция as-is в ARCHITECTURE — **справочно**, почему меняем модель, не план миграции данных.

---

## 2. Зафиксированные архитектурные решения

Не обсуждаем — уже принято для чистой установки.

| # | Решение |
|---|---------|
| A1 | **Outbox** (или транзакция domain + Event) — событие не раньше commit |
| A2 | Отдельный **`@chat3/counter-worker`**, очередь `counter_worker_queue`, `prefetch=1`, 1 replica на старт |
| A3 | **`@chat3/update-worker`** — только domain Updates; **без** `counterUtils` / `packStatsUtils` для stats |
| A4 | tenant-api: **только** домен + Event; **нет** `updateUnreadCount`, hooks счётчиков, `finalizeCounterUpdateContext` |
| A5 | **`recalculateSlice` → `publishCounterUpdates`**; без `$inc` chain |
| A6 | Доменные Event **без** `update` в имени (`message.status.changed`, …) |
| A7 | UI-агрегат **dialog**; counter-Updates: `dialog.member.changed`, `user.stats.update` |
| A8 | MongoDB read **primary** в counter-worker |
| A9 | После поднятия стенда: **`full-recalculate-stats`** один раз (пустые stats) |
| A10 | Nightly/CI **drift reconcile** — страховка, не замена онлайн-логики |
| A11 | `ProcessedCounterEvent` — отдельная коллекция идемпотентности |
| **A12** | **Семантика unread (продукт, зафиксировано):** прочитано ⇔ в истории `MessageStatus` есть **`read`**; до этого (`unread`, `sent`, `delivered`, …) — в счётчике непрочитанного. См. §3.1, [ARCHITECTURE §4.6](./COUNTERS_WORKER_ARCHITECTURE.md#46-семантика-unread-зафиксировано) | Одна `isUnreadForUser()` во всех пересчётах |

---

## 3. Согласованные решения (2026-05-28)

**Q1–Q4** — зафиксированная продуктовая семантика; реализуем **именно так** (см. **A12**, §3.1).

| # | Решение | Реализация |
|---|---------|------------|
| **Q1** | = **A12**. **Прочитано** = в истории есть **`read`**. До этого — непрочитано | `isUnreadForUser()` = нет `read` в истории |
| **Q2** | Переход **`read` → `unread`** — **не требуется** | Не проектируем API и сценарии «снова непрочитано»; при случайной записи `unread` после `read` счётчик **не** вернёт сообщение (в истории уже есть `read`, A12) |
| **Q3** | Отправитель **не** входит в unread | `senderId !== userId` в slice и агрегациях (как сейчас) |
| **Q4** | Сообщения с `type` **`system.*`** **не** участвуют в unread | Как в `messageController` (`isSystemMessage`): нет `MessageStatus` на create, исключение в `isUnreadForUser` / `$match` по `Message.type` |
| **Q5** | Mark all read → одно событие **`dialog.messages.bulk_read`** | |
| **Q6** | **dialog-read-worker** после task публикует **`dialog.messages.bulk_read`** | |
| **Q7** | **MessageStatusStats** — в counter-worker (`recalculateMessageStatusStats`); **reaction counts** — позже | Реакции остаются в hooks до отдельного projector |
| **Q8** | На **`message.create`**: `recalculateUserPackUnreadBySenderType` + delta **`messageCount`**; full **`recalculatePackStats`** — на `pack.dialog.*`, member | |
| **Q9** | POST message/read — **без** гарантии актуальных счётчиков в HTTP | Клиенты: Updates (RabbitMQ) + GET при открытии списка |
| **Q10** | **controlo-ui** — только **tenant-api GET** (счётчики по запросу), Updates **не** нужны | Внешние клиенты — **Updates из RabbitMQ** (`chat3_updates`); counter-Updates обязательны для них |
| **Q11** | **Да**, есть **внешние** подписчики на **`chat3_events`** | Breaking rename `*.update` → `*.changed`; **§VI.4** — `EVENTS.md` + changelog для интеграторов |
| **Q12** | **Outbox relay — отдельный процесс** (`outbox-relay`) | Не in-process в tenant-api |
| **Q13** | **`full-recalculate-stats`** — обязательный шаг install / post-install | README + helm hook |
| **Q14** | Stats **только по событиям** counter-worker; при `dialog.member.add` **не** создаём нулевые stats в API | Консистентность пустой БД — **init full-recalculate** (A9) |

### 3.1. `isUnreadForUser` (спецификация для фазы I)

```text
read(message, viewerUserId) :=
  ∃ MessageStatus (messageId, viewerUserId) with status === 'read'

unread(message, viewerUserId) :=
  message.type does NOT match /^system\./
  AND message.senderId !== viewerUserId (normalized)
  AND NOT read(message, viewerUserId)
```

**Примеры:**

| История статусов (по времени) | В unread-счётчике? |
|-------------------------------|--------------------|
| `unread` | да |
| `unread` → `sent` → `delivered` | да (read ещё не было) |
| `unread` → `delivered` → `read` | нет |
| нет строк `MessageStatus` | да (как сейчас в `recalculateUserStats`: нет `read`) |

Пересчёт в MongoDB — та же логика, что в as-is `recalculateUserStats`: `$lookup` на наличие **`read`**, не «последний статус = unread».

**Q2:** `read` → `unread` **не поддерживаем**. Запись `unread` после `read` в БД **не** возвращает сообщение в счётчик (A12: `read` уже в истории).

**Задача фазы I:** вынести **A12** в `isUnreadForUser` и использовать везде (slice, full-recalculate, тесты). Менять смысл **нельзя**.

---

## 4. Карта фаз (чистая реализация)

| Фаза | Название | Результат |
|------|----------|-----------|
| **I** | Core | `counterProcessor`, модели, outbox, тесты, `isUnreadForUser` |
| **II** | tenant-api | Только domain + outbox; новые имена Event; **удалён** старый counter-код |
| **III** | counter-worker | Сервис, consumer, все counter-события, counter-Updates |
| **IV** | update-worker | Только domain Updates; read `UserDialogStats` из DB при необходимости |
| **V** | Потоки read | bulk_read, dialog-read-worker, mark all read |
| **VI** | Install & quality | docker-compose, init recalc, docs, drift job, CI contract tests |

Параллельно можно вести **фазы I–II** (модели + API) и **III** (worker), merge перед первым E2E на чистом стенде.

---

## 5. Фаза I — Core (`counterProcessor` + модели)

### 5.1. Модели

| ID | Задача |
|----|--------|
| I.1 | `ProcessedCounterEvent` `(tenantId, eventId)` unique |
| I.2 | `OutboxEvent` + индексы `published`, `createdAt` |
| I.3 | `EventType` enum: `message.status.changed`, `dialog.member.changed`, `message.changed`, …; **убрать** старые `*.update` из enum |
| I.4 | `dialog.messages.bulk_read` в enum |

### 5.2. counterProcessor

| ID | Задача |
|----|--------|
| I.5 | `counterEvents.ts` — whitelist |
| I.6 | `resolveSlice(event)` — dialog-centric |
| I.7 | `isUnreadForUser()` — §3.1 (Q1–Q4); рефактор `counterUtils` — одна функция/пайплайн «нет `read` в истории» |
| I.8 | `recalculateSlice(tenantId, slice)` — dialog → user → dialogStats → pack |
| I.9 | `publishCounterUpdates()` — read-after-write, coalesce по userId |
| I.10 | `processCounterEvent()` — idempotency → slice → updates → markProcessed |

### 5.3. Outbox relay

| ID | Задача |
|----|--------|
| I.11 | `publishOutboxBatch()` — relay в RabbitMQ |
| I.12 | In tenant-api: запись domain + outbox в **одной** MongoDB transaction (Q12) — `createEventWithOutbox` |

### 5.4. Тесты

| ID | Задача |
|----|--------|
| I.13 | Unit: `resolveSlice`, `isUnreadForUser` |
| I.14 | Integration: `message.create` / `message.status.changed` → stats + Updates (memory MongoDB) |
| I.15 | Contract fixtures: `fixtures/events/*.json`, `expected-stats.json`, `expected-updates.json` |
| I.16 | Duplicate `eventId` — нет двойных Updates |

### Критерии готовности фазы I

- [x] `counterProcessor` покрыт тестами без запуска воркера.
- [x] `recalculateSlice` и `full-recalculate` используют одни и те же функции пересчёта (`recalculateUserDialogUnread`).
- [x] **I.15** golden fixtures: `fixtures/events/*.json`, `expected-stats.json`, `expected-updates.json`, `counterGoldenFixtures.test.js`.

---

## 6. Фаза II — tenant-api (только command)

**Принцип:** в одном проходе **вырезаем** весь counter-код из API.

| ID | Задача | Файлы |
|----|--------|-------|
| II.1 | Удалить bulkWrite unread при `message.create` | `messageController.ts` |
| II.2 | Удалить `finalizeCounterUpdateContext` из hot path | controllers |
| II.3 | Удалить `decrementUserDialogUnreadBySenderTypeForRead` | `userDialogController.ts` |
| II.4 | Убрать counter из `MessageStatus` hooks; stats → counter-worker | `MessageStatus.ts` |
| II.5 | `applyMarkDialogAllRead` — только domain + emit `dialog.messages.bulk_read` | `dialogMemberUtils.ts` |
| II.6 | pack/userPack markAllRead — только события | `userPackController`, `packController` |
| II.7 | Публиковать **`message.status.changed`** вместо `message.status.update` | `userDialogController.ts` |
| II.8 | Переименовать остальные domain events (`message.changed`, …) | controllers, `eventUtils` |
| II.9 | Outbox: message/status/dialog flows пишут outbox в txn | controllers |
| II.10 | Удалить lazy `recalculateDialogStats` из GET **или** оставить read-only fallback без записи | `dialogController.ts` |
| II.11 | Тесты API: нет записей в UserDialogStats при POST message/read | integration tests |

### Критерии готовности фазы II

- [x] Grep по `updateUnreadCount`, `finalizeCounterUpdateContext`, `decrementUserDialog` в tenant-api — **0** в hot path (только тесты).
- [x] События в БД с новыми `eventType`; II.10 — GET/create без записи `DialogStats` из API.

---

## 7. Фаза III — `@chat3/counter-worker`

| ID | Задача |
|----|--------|
| III.1 | Пакет `packages/counter-worker` (как `update-worker`) |
| III.2 | Consumer `counter_worker_queue`, binding counter-relevant events, `prefetch=1` |
| III.3 | `processEvent` → `processCounterEvent` для whitelist |
| III.4 | Handlers: `message.create`, `message.status.changed`, `dialog.member.*`, `dialog.topic.create`, `pack.dialog.*`, `dialog.messages.bulk_read` |
| III.5 | Логирование: `eventId`, duration slice, tenantId, dialogId |
| III.6 | DLQ / nack при ошибке slice (без markProcessed) |
| III.7 | docker-compose / k8s manifest |
| III.8 | E2E: поднять стек → POST message → stats + counter-Updates |

### Критерии готовности фазы III

- [x] counter-worker — **единственный** процесс, пишущий user/pack/dialog/**MessageStatusStats** онлайн (реакции — hooks, Q7).
- [x] Ошибки slice → rethrow → nack/requeue в `createConsumer`.
- [x] E2E на чистом стенде в CI (ручной smoke: POST message + workers).
- [x] **III.5** лог `eventId`, `dialogId`, `durationMs` в `processCounterEvent` (`[counterProcessor] slice ok:`).

---

## 8. Фаза IV — update-worker (только domain)

| ID | Задача |
|----|--------|
| IV.1 | Удалить `updateDialogMessageCount`, `recalculatePackStats`, `recalculateUserPackUnreadBySenderType` |
| IV.2 | Удалить `createPackStatsUpdate` / `createUserPackStatsUpdate` из update-worker |
| IV.3 | `createMessageUpdate` / `createDialogUpdate` — **read** `UserDialogStats` из DB для `context.unreadCount` |
| IV.4 | Подписка на **новые** eventType в `shouldCreateUpdate` |
| IV.5 | Тесты: MessageUpdate без записи в stats |

---

## 9. Фаза V — Read-потоки

| ID | Задача |
|----|--------|
| V.1 | `dialog-read-worker`: после task → `createEvent('dialog.messages.bulk_read')` |
| V.2 | slice handler bulk_read |
| V.3 | Integration: mark all read, mark pack all read |
| V.4 | Убедиться: `MessageStatus.bulkWrite` в read-worker **не** трогает stats (только событие после) |

---

## 10. Фаза VI — Install, docs, quality

| ID | Задача |
|----|--------|
| VI.1 | README / deploy: порядок сервисов (mongo, rabbit, api, outbox-relay, counter-worker, update-worker, dialog-read-worker) |
| VI.2 | Init hook: `POST /init/full-recalculate-stats` после первого deploy |
| VI.3 | `reconcileCounterDrift` job (controlo или script) + алерт |
| VI.4 | Обновить `docs/API.md`, `docs/EVENTS.md`, `docs/statusMatrix.md` |
| VI.5 | Swagger / response schemas — без обещания sync unread в POST |
| VI.6 | Load test baseline (опционально): slice duration p99 |

**Статус фазы VI (v1):** VI.1–VI.5, VI.3 — готово; VI.6 — baseline в `test:counter-benchmark`; CI — `npm run test:ci:counters`.

### Фаза VI-b — Масштаб (после стабильного v1)

| ID | Задача |
|----|--------|
| VI.b1 | per-tenant serial (`p-queue` или `counter.{tenantId}`) |
| VI.b2 | Несколько replica + sharding tenants |
| VI.b3 | Coalesce/batch Updates при burst (если нужно) |

---

## 11. Структура кода (целевая)

```
packages-shared/utils/src/counterProcessor/
  counterEvents.ts
  resolveSlice.ts
  isUnreadForUser.ts
  recalculateSlice.ts
  publishCounterUpdates.ts
  processCounterEvent.ts

packages-shared/models/src/operational/
  ProcessedCounterEvent.ts
  OutboxEvent.ts
  Event.ts                    # EventType без *.update

packages/counter-worker/
  src/index.ts                # consumer only

packages/update-worker/
  src/index.ts                # domain updates only

packages/tenant-api/
  controllers/                # domain + outbox, no counterUtils writes
```

---

## 12. Тестовая стратегия

| Уровень | Когда |
|---------|-------|
| Unit | Фаза I |
| Integration counterProcessor | Фаза I |
| API regression (no stats write) | Фаза II |
| E2E stack | Фаза III |
| Contract golden | CI на каждый PR |
| Drift reconcile | Фаза VI, nightly |

**Обязательные сценарии на чистом стенде:**

1. message.create → N recipients, dialog in pack  
2. message.status.changed (read)  
3. dialog.messages.bulk_read  
4. duplicate eventId  
5. dialog.member.add / remove  
6. init full-recalculate на пустой БД → 0 drift  

---

## 13. Чеклист чистой установки

| Шаг | Действие |
|-----|----------|
| 1 | Deploy MongoDB, RabbitMQ |
| 2 | Deploy tenant-api + **outbox-relay** |
| 3 | Deploy counter-worker, update-worker, dialog-read-worker |
| 4 | Создать tenant / seed при необходимости |
| 5 | **`full-recalculate-stats`** |
| 6 | Smoke: message → read → mark all read; сверка UI и GET |
| 7 | Включить drift job |

**Откат:** откат версии релиза целиком (helm/image), не feature flag.

---

## 14. Риски

| Риск | Митигация |
|------|-----------|
| Внешний клиент не подписан на counter-Updates | Документация + контракт Updates (Q10, Q11) |
| controlo-ui «устаревшие» бейджи до refresh | Ожидаемо: только GET; не блокер v1 |
| Event before commit | Outbox (A1) |
| Partial slice failure | retry + reconcile (A10) |
| Два воркера — порядок Updates | update-worker читает stats из DB (фаза IV) |
| Breaking event names | Q11 — changelog + версия API для внешних подписчиков `chat3_events` |
| Переименование ломает старые тесты | Обновить тесты в фазах II–IV одним релизом |

---

## 15. Definition of Done

- [x] Один writer stats: **counter-worker**.
- [x] tenant-api без counter writes и без counter hooks (кроме MessageReaction — позже).
- [x] update-worker без stats aggregation.
- [x] Outbox + idempotent `processCounterEvent`.
- [x] `recalculateSlice` + `publishCounterUpdates` на всех counter-событиях.
- [x] Domain events без `*.update` в имени.
- [x] CI contract + E2E на чистом стенде (`test:counter-stack`, `reconcile-counter-drift`).
- [x] Install docs + init full-recalculate.
- [x] Drift job (`reconcileCounterDrift` + script + controlo GET).

---

## 16. Анализ: достаточно ли для реализации?

**Вердикт: да, стартовать фазу I можно.** Архитектура + фазы + §3 закрывают «что строим» и «как считаем». Для coding достаточно связки: этот план + [ARCHITECTURE §4–7](./COUNTERS_WORKER_ARCHITECTURE.md) + [ORDERING §7](./COUNTERS_WORKER_ORDERING_AND_TENANT_ISOLATION.md) + существующий `counterUtils` / `packStatsUtils` (рефактор под §3.1).

### 16.1. Что уже достаточно

| Область | Где |
|---------|-----|
| Роли сервисов, single writer, outbox | §2, ARCHITECTURE §4 |
| Алгоритм slice → publish | §5–7, ARCHITECTURE §4.6 |
| Whitelist событий, rename | ARCHITECTURE §5–6 |
| Семантика unread (Q1–Q4) | §3.1 |
| Клиенты: controlo GET vs RabbitMQ Updates | Q9–Q11 |
| Тесты и DoD | §12, §15 |
| Файлы для вырезания в API | §6 |

### 16.2. G1–G5 — не «уточнить с заказчиком», а **сделать в коде** в фазе I

Это не открытые вопросы. Решения уже есть в архитектуре; в плане они перечислены как **первые инженерные задачи**, потому что в репозитории **ещё нет** этих артефактов.

| # | Что сделать | Откуда взять ответ (уже есть) |
|---|-------------|-------------------------------|
| **G1** | Добавить модель **`OutboxEvent`** в MongoDB | A1, Q12: поля `eventId`, `tenantId`, `eventType`, `payload` (как у `Event`), `published: boolean`, `createdAt`, индекс `{ published: 1, createdAt: 1 }` |
| **G2** | Пакет **`outbox-relay`**: цикл «выбрать unpublished → publish в Rabbit → mark published» | Тот же exchange/routing, что `eventUtils` / `rabbitmqUtils` сейчас; env: `MONGO_URI`, `RABBIT_URL`, `BATCH_SIZE` (например 100), интервал poll (например 1s) |
| **G3** | Очередь **`counter_worker_queue`** + consumer | Как **update-worker**: binding `['#']` на `chat3_events`, `prefetch: 1`; в `processCounterEvent` — **whitelist** `eventType` (лишние события ack без работы) |
| **G4** | **`resolveSlice(event)`** — откуда брать `dialogId`, `userId`, … | Сейчас `event.data` **вложенный** (`data.message.message`, `data.dialog.dialogId` из `composeEventData`). В коде — маленькие extractors по типу события; в тестах — реальный payload из `messageController` |
| **G5** | Файл **`isUnreadForUser`** + unit/integration тесты | A12 / §3.1; логика = as-is `recalculateUserStats` (`$lookup` на `read`) |

**Итого:** G1–G5 не блокируют старт и **не требуют** отдельного согласования — это пункты чеклиста фазы I.

### 16.3. Позже (фазы VI / v1.1)

| # | Задача |
|---|--------|
| G7 | Changelog rename событий для внешних (Q11) — VI.4 |
| G8 | `reconcileCounterDrift` — VI.3 |
| G9 | TTL `ProcessedCounterEvent` — опционально |
| — | per-tenant queues, reaction projector, debounce |

### 16.4. Риск при Q1

Семантика **совпадает** с as-is (`нет read`). Риск — **разъезд копий** правила в API, `counterUtils`, full-recalculate. Митигация: одна `isUnreadForUser` + golden-тесты на `sent` / `delivered` / `read` (I.15).

---

## 17. Следующий шаг

1. **Фаза I:** модели + `counterProcessor` + `isUnreadForUser` (§3.1) + закрыть G1–G5.
2. Параллельно **фаза II** (вырезание API + outbox в txn).
3. **Фаза III** после merge — E2E на чистом стенде.

---

*Версия плана: **2.4** — Q2: read→unread не требуется; G1–G5 уточнены — 2026-05-28*
