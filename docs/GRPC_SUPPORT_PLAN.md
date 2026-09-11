# План: поддержка gRPC-интерфейса (сервер + клиент)

## Цель

Пользовательский gRPC:

1. **gRPC-сервер** — полноценный transport-адаптер к домену (не прокси HTTP).
2. **gRPC-клиент (TypeScript)** — пакет в монорепо (без npm publish в первом релизе).
3. **Общий proto-контракт**.

Канон домена — **один набор application services**, который вызывают и REST (`tenant-api`), и gRPC. Outbox/events — тот же путь, что сегодня (`eventUtils.createEvent`).

**HTTP API не убираем и не ломаем:** `tenant-api` остаётся полноценным публичным интерфейсом. Рефакторинг только выносит логику из fat-controllers в services; Express-handlers становятся тонкими обёртками с тем же контрактом URL/JSON (регрессия — существующие тесты + Swagger). gRPC — **дополнительный** транспорт, не замена REST.

Транспорт: **plaintext** (TLS не в scope первого релиза).

## Статус реализации (ветка `feature/grpc-app-services`)

| Компонент | Статус |
|-----------|--------|
| `@chat3/app-services` | auth, typing, status, reaction, soft-delete, **sendMessage**, **markDialogAllRead**, **listUserDialogs**, **listUserDialogMessages** |
| Proto (`user_id` в теле) | полный scope |
| `user-grpc-server` | **все MVP RPC** + SubscribeUpdates |
| `user-grpc-client-ts` | те же методы + stream |
| REST thin adapters | соответствующие handlers на services |
| Hardening / npm publish / TLS | позже |

## Зафиксированные решения

| # | Решение |
|---|---------|
| 1 | Application services сразу в `packages-shared/app-services` (`@chat3/app-services`) |
| 2 | Делаем **полный** user MVP: все базовые RPC + soft-delete + mark-all-read (не «срез на проверку архитектуры») |
| 3 | TS-клиент только как workspace-пакет; npm publish — позже |
| 4 | gRPC plaintext; TLS — hardening после релиза |
| 5 | Валидация бизнес-правил в **services** (вариант A); адаптеры только парсят transport |
| 6 | gRPC — **интеграторский** API: одно соединение / один API-ключ на тенант; **`user_id` в теле каждого RPC** (не в metadata). Metadata: `x-api-key`, `x-tenant-id`. Интегратор шлёт от разных пользователей своей системы без переподключения |

---

## Что не нравится в старом варианте (`origin/grpc`)

Текущий задел на ветке — **gRPC → HTTP tenant-api** (`Chat3Client` / axios):

| Минус | Почему плохо |
|-------|----------------|
| Лишний hop | latency, двойная сериализация JSON↔proto |
| Двойной auth | metadata → HTTP headers → `apiAuth` снова |
| Дрейф клиента | зависимость от REST SDK и формы URL |
| Ошибки/идемпотентность | маппинг через HTTP-статусы, костыли (axios в `SetMessageStatus`) |
| Ложная граница | «канон» выглядит как REST, хотя логика на самом деле в fat-controllers |

**Вывод:** код с `origin/grpc` полезен как черновик proto/streaming/auth metadata, но **архитектуру фасада над HTTP не переносим как целевую**.

---

## Целевая архитектура

```
                    ┌─────────────────────────┐
  REST clients ──►  │ tenant-api (Express)     │
                    │ тонкие route handlers    │
                    └───────────┬─────────────┘
                                │
                                ▼
                    ┌─────────────────────────┐
                    │ @chat3/app-services     │  ← единый канон use-case
                    │ listDialogs, sendMessage│
                    │ setStatus, softDelete…  │
                    └─────┬───────────┬───────┘
                          │           │
                          ▼           ▼
                   @chat3/models   eventUtils.createEvent
                   (+ shared utils)     → Outbox → workers
                                ▲
                    ┌───────────┴─────────────┐
  gRPC clients ──►  │ user-grpc-server        │
                    │ тонкие RPC handlers     │
                    │ + SubscribeUpdates(AMQP)│
                    └─────────────────────────┘
```

### Принципы

1. **Один use-case слой** — Express и gRPC только адаптируют transport (headers/metadata, status codes, proto↔DTO).
2. **Мутации только через `eventUtils.createEvent`** — иначе разъедутся Updates/counters.
3. **gRPC не ходит в tenant-api по HTTP** и не копирует оркестрацию контроллеров «сбоку».
4. **SubscribeUpdates** — отдельный realtime-путь на `chat3_updates`.
5. **Auth core** вынести из Express-middleware в общую функцию (API-ключ + tenant).
6. **Идентичность пользователя** — поле `user_id` (и при необходимости `sender_id` ≡ `user_id`) в **request message**, не `x-user-id` в metadata. Metadata только для интегратора: `x-api-key`, `x-tenant-id`.
7. **`Message.type`** — string (`internal.*` / `system.*` / `user.*`), как в Joi.
8. **Валидация** бизнес-правил в services; REST Joi / proto — тонкий входной слой.

### Анти-паттерны

| Не делать | Почему |
|-----------|--------|
| (A) Долгоживущий HTTP-facade | см. выше |
| (C) Второй Mongo-путь в gRPC «как в контроллерах» | два канона, расхождение events/enrichment |

Временный HTTP-facade **не используем** даже как bootstrap: сразу services.

---

## Что есть сейчас в коде (контекст рефакторинга)

- Отдельного service layer **нет**: fat-controllers в `packages/tenant-api/src/controllers/`.
- Shared: `@chat3/models`, `@chat3/utils` — строительные блоки, не use-cases.
- Куски домена локально в tenant-api: `dialogMemberUtils`, `messageEnrichment`, `queryParser`, `userDialogMessageFilterUtils` — при извлечении поднимать в shared / app-services.
- Auth: `packages/tenant-api/src/middleware/apiAuth.ts` завязан на Express.
- Workers менять не нужно при том же `createEvent`.

---

## Пакеты

| Пакет | Путь | Роль |
|-------|------|------|
| `@chat3/app-services` | `packages-shared/app-services` | use-cases + auth core |
| `@chat3/user-grpc-proto` | `packages-shared/proto` | контракт |
| `@chat3/user-grpc-server` | `packages/user-grpc-server` | RPC + AMQP stream (plaintext) |
| `@chat3/user-grpc-client-ts` | `packages-clients/user-grpc-client-ts` | SDK в монорепо |

Локальные utils tenant-api, нужные сервисам, переносить в `@chat3/utils` или внутрь `@chat3/app-services` по мере извлечения.

---

## Scope RPC / services (полный user-набор)

| Service | Источник логики сегодня | RPC (в теле всегда явный `user_id`, где нужен контекст пользователя) |
|---------|-------------------------|-----|
| `authenticateApiKey` | `middleware/apiAuth.ts` | interceptor: metadata `x-api-key` + `x-tenant-id` |
| `listUserDialogs` | `userDialogController.getUserDialogs` | `GetUserDialogs` (`user_id`) |
| `listUserDialogMessages` | `getUserDialogMessages` | `GetDialogMessages` (`user_id`, `dialog_id`) |
| `sendMessage` | `messageController.createMessage` | `SendMessage` (`user_id` как sender; отдельный `sender_id` не нужен или = `user_id`) |
| `setMessageStatus` | `userDialogController.updateMessageStatus` | `SetMessageStatus` (`user_id`, …) |
| `setMessageReaction` | `messageReactionController` | `SetMessageReaction` (`user_id`, …) |
| `sendTyping` | `typingController.sendTyping` | `SendTypingIndicator` (`user_id`, `dialog_id`) |
| `setMessageDeleted` | soft-delete / undelete | `SetMessageDeleted` (`user_id` / `deleted_by` по REST-контракту) |
| `markDialogAllRead` | `markAllRead` / dialog-read flow | `MarkDialogAllRead` (`user_id`, `dialog_id`) |
| _(не service)_ SubscribeUpdates | AMQP `chat3_updates` | `SubscribeUpdates` (**`user_id` в request**, не metadata; один стрим = один user; для другого user — новый RPC stream на том же канале) |

Порядок извлечения (все обязательны, порядок — для снижения риска регрессий):

typing → status → reaction → soft-delete → sendMessage → mark-all-read → list messages → list dialogs → SubscribeUpdates (AMQP можно параллельно).

В адаптерах: Joi/query ↔ proto, HTTP/gRPC status mapping, логирование.

Контракт ошибок сервиса — доменный (`NOT_FOUND`, `FORBIDDEN`, `VALIDATION`, …), без Express/HTTP.

---

## Актуализация контракта (из старой ветки + main)

1. **Update 0.0.77+** — `event_id`, `source_event_type`, `update_type` (не legacy `event_type`).
2. **Message** — soft-delete, `status_message_matrix`, `edited*` по наличию в REST.
3. Binding стрима: `update.*.{userType}.{userId}.*`.
4. Connection frame: `source_event_type = "connection.established"`, `conn_id` в `data`.
5. Новые RPC: `SetMessageDeleted`, `MarkDialogAllRead` — зеркало актуальных REST.
6. Убрать зависимость от `x-user-id` в metadata (как было на `origin/grpc`); везде явный `user_id` в proto request. `SendMessage`: предпочесть одно поле `user_id` вместо пары metadata+`sender_id`.

Proto/streaming со старой ветки — черновик; вызовы `Chat3Client` не переносим.

---

## Этапы

### Этап 0. Каркас

1. Ветка от `main`.
2. Создать `@chat3/app-services`; перенести proto + скелет server/client с `origin/grpc` (без HTTP SDK).
3. gRPC server + reflection, plaintext `:50051`.

### Этап 1. Application services + оба транспорта

Для **каждого** use-case из таблицы scope:

1. Извлечь в `@chat3/app-services`.
2. Перевести Express на service (REST без смены контракта).
3. Подключить gRPC-handler к тому же service.

Критерий: gRPC unary **не** использует axios/`Chat3Client` для домена.

### Этап 2. Proto под полный scope + main

Update/Message; `SetMessageDeleted`, `MarkDialogAllRead`; idempotency `SendMessage` на уровне service.

### Этап 3. TS-клиент (монорепо)

Все RPC + stream iterator; README. Без publish.

### Этап 4. Тесты

Unit services (`mongodb-memory-server`, `@onify/fake-amqplib`); адаптеры; integration gRPC + stream.

### Этап 5. Документация

`GRPC_USER_INTERFACE.md`, INTEGRATION.md, `.env.example`; `GRPC_IMPLEMENTATION_PLAN.md` → superseded.

### Этап 6. Позже (не блокер)

TLS, npm publish клиента, метрики, rate limit, resume stream.

---

## Порядок работ

```
0. app-services + proto + каркас gRPC
 → 1. Все services + REST thin + gRPC unary (полный scope)
  → 2. Proto Sync (Update/Message + новые RPC)
   → 3. TS-клиент в packages-clients
    → 4. Тесты
     → 5. Документация
```

Оценка: **~3–5 недель** (полный scope + soft-delete + mark-all-read).

---

## Риски

| Риск | Митигация |
|------|-----------|
| Толстые контроллеры (userDialog ~2.5k) | Извлекать по методу; REST-регрессия после каждого |
| Регрессии REST | Сначала service + Express, потом gRPC; существующие Jest |
| Дубль utils tenant-api | Поднимать в shared вместе с service |
| Очереди на соединение | auto-delete on cancel; лимит стримов |

---

## Definition of Done (первый релиз)

- [x] Все RPC из таблицы scope на `@chat3/app-services`, не через HTTP
- [x] Соответствующие Express-handlers на тех же services
- [x] Мутации через `eventUtils.createEvent` / outbox
- [x] Auth core общий; metadata только `x-api-key` / `x-tenant-id`
- [x] `user_id` в теле RPC (включая `SubscribeUpdatesRequest`)
- [x] `SubscribeUpdates` + Update proto 0.0.77+
- [x] Soft-delete и mark-all-read в proto и обоих транспортах
- [x] Валидация бизнес-правил в services
- [x] Клиент в монорепо; plaintext
- [x] Тесты + документация (базовый регресс HTTP зелёный)

## Связанные документы

- [INTEGRATION.md](./INTEGRATION.md), [UPDATES.md](./UPDATES.md), [API.md](./API.md)
- [UPDATE_TYPE_NAMING_PLAN.md](./UPDATE_TYPE_NAMING_PLAN.md)
- [fdr/FDR-0001-message-soft-delete.md](./fdr/FDR-0001-message-soft-delete.md)
- [`GRPC_IMPLEMENTATION_PLAN.md`](./GRPC_IMPLEMENTATION_PLAN.md) — устаревший backlog HTTP-facade

## Открытых блокеров нет

План готов к реализации. Уточнения по мелочам (имена полей proto, точный REST-маппинг soft-delete) — по ходу этапа 0–1.
