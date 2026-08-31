# Changelog

Формат: [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/).  
Версии соответствуют monorepo и Docker-образу `antirek/mms3`.

---

## [0.0.83] — 2026-08-31

Controlo под path-gateway (`CONTROLO_PUBLIC_PATH`, #15601); ESLint: ignore локальных скриптов и чистка unused.

### Добавлено

- **`CONTROLO_PUBLIC_PATH`** — runtime base path для Controlo UI за path-gateway: `normalizePublicPath`, rewrite SPA `index.html`, config.js/Swagger через `CONTROL_APP_URL`, relative Vite base. FDR-0003.

### Изменено

- **ESLint:** ignore `scripts/**` и `*.mjs`; `performance` в globals; убраны unused imports/vars в tenant-api, utils, controlo-ui.

### Docker

```text
antirek/mms3:0.0.83
```

---

## [0.0.82] — 2026-08-25

Редактирование сообщений с историей версий (#15519), модалки в Controlo UI, TTL retention для ApiJournal (#15522).

### Добавлено

- **`PUT /api/messages/:messageId/edit`** — смена content; предыдущий текст в **`MessageVersion`**; на `Message` — `edited` / `editedAt` / `editedBy`.
- **`GET /api/messages/:messageId/versions`** — последние 20 версий.
- **SDK** (`@chat3/tenant-api-client`): helpers edit / versions.
- **Controlo UI:** модалки Править / Удалить (soft-delete) в таблице сообщений User Dialogs.
- **ApiJournal TTL 60 дней** — `expireAt` + Mongo TTL index (`JOURNAL_LOG_TTL_SECONDS`), FDR-0002.

### Docker

```text
antirek/mms3:0.0.82
```

---

## [0.0.81] — 2026-08-24

Soft-delete сообщений (#15507): флаг `deleted`, API, событие `message.deleted`, пересчёт unread без soft-deleted.

### Добавлено

- **`Message.deleted` / `deletedAt` / `deletedBy`** — soft-delete без физического удаления.
- **`PATCH /api/messages/:messageId`** — `{ deleted: boolean, deletedBy? }`; идемпотентно; undelete сбрасывает поля.
- **Событие `message.deleted`** — в enum Event, outbox, update-worker (`MessageUpdate`), counter-worker.
- Soft-deleted **исключаются** из unread (`deleted: { $ne: true }` в A12 / recalculate).
- **SDK:** helper в `@chat3/tenant-api-client`; Controlo UI labels; FDR-0001.
- Тесты: `messageController.patchMessageDeleted`, counter/processUpdateEvent fixtures.

### Docker

```text
antirek/mms3:0.0.81
```

---

## [0.0.80] — 2026-06-18

Pack unread после outbound + `markAllReadForAllUsers`: инвариант P1/P4, fix drift stats (C1), monotonic WS для `UserStatsUpdate`.

### Исправлено

- **C1 — drift stats при mark all read:** `dialog.messages.bulk_read` теперь эмитится не только при `processedCount > 0`, но и когда до операции `UserDialogStats.unreadCount > 0` (сообщения уже помечены read, счётчик в БД «залип»). Затронуты `markDialogMessagesAsReadUntil` и `runDialogReadTask` (`dialogReadTaskUtils.ts`).
- **WS ordering:** stale `UserStatsUpdate` после `message.create` больше не должен «откатывать» бейдж 0→1 после markAllRead — в payload добавлены monotonic-поля; клиенты могут использовать `shouldApplyUserStatsUpdate` из `@chat3/utils`.

### Добавлено

- **`UserStats.statsVersion`** — монотонный счётчик, `$inc` при пересчёте в counter-worker.
- **`shouldApplyUserStatsUpdate(local, incoming)`** в `@chat3/utils` — фильтрация устаревших WS-апдейтов по `statsVersion` / `lastUpdatedAt` / `packs.messages.lastUpdatedAt`.
- В **`UserStatsUpdate`** (`update.user`): поля `user.stats.statsVersion`, `user.stats.lastUpdatedAt`, `user.stats.packs.messages.lastUpdatedAt`.
- **Интеграционные тесты:**
  - P1-I1–I5: inbound dialog A + outbound dialog B + `markAllReadForAllUsers` → pack contact unread = 0 (`markPackAllReadForAllUsers.integration.test.js`);
  - P1-I2: drift stats + markAllRead (`markAllRead.integration.test.js`);
  - P4-I1/I2/R1: markAllRead → `dialog.member.remove` не восстанавливает pack contact unread (`markAllReadThenMemberRemove.integration.test.js`);
  - monotonic UserStatsUpdate (`userStatsUpdateMonotonic.integration.test.js`).
- **Unit-тесты:** `dialogReadTaskUtils.test.js`, `userStatsUpdateMonotonic.test.js`.

### Изменено (контракт / документация)

- **Swagger** `POST /packs/:packId/markAllReadForAllUsers` и `POST /users/:userId/packs/:packId/markAllRead`: явно описаны membership (только member-dialogs), async stats после HTTP 200, `?memberType=user`.
- **`INTEGRATORS_COUNTERS_MIGRATION.md`:** §3.4 mark all read (membership, drift, Q1 partial membership), §5.3 stale UserStatsUpdate.
- **`COUNTERS_EVENTS.md`:** строка `dialog.messages.bulk_read`, примечание к `dialog.member.remove` после markAllRead.

### Для интеграторов (message-server)

| Тема | Действие |
|------|----------|
| Pack unread после outbound | Refetch `GET /users/:userId/packs/:packId` после markAllRead; не полагаться только на WS |
| Stale WS | Применять `shouldApplyUserStatsUpdate` к `UserStatsUpdate` |
| Membership | Operator должен быть member в диалоге с inbound **или** принять partial pack unread |
| `meta.attention` | По-прежнему **не** снимается markAllRead — на стороне приложения (P2) |

Подробнее: [docs/proposal/MESSAGE_SERVER_PACK_CENTRIC_MMS3_GUIDE.md](docs/proposal/MESSAGE_SERVER_PACK_CENTRIC_MMS3_GUIDE.md).

### Docker

```text
antirek/mms3:0.0.80
```

---

## [0.0.79] — 2026-06-06

Кратко (предыдущий релиз):

- Join boundary: unread только для сообщений с `createdAt >= DialogMember.createdAt`.
- `dialog.member.remove`: пересчёт `UserStats` и `UserPackUnreadBySenderType` через counter-worker.
- `GET /api/messages`: слияние фильтров `createdAt` (`$gte` + `$lt`) в queryParser.

---

[0.0.83]: https://github.com/antirek/chat3/compare/3561ba7...6818eff
[0.0.82]: https://github.com/antirek/chat3/compare/e195759...3561ba7
[0.0.81]: https://github.com/antirek/chat3/compare/bf857d3...e195759
[0.0.80]: https://github.com/antirek/chat3/compare/8eb2024...bf857d3
[0.0.79]: https://github.com/antirek/chat3/commit/8eb20240f32b4353685ebdc07bc108ad3be6db06
