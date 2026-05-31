# План PR2: убрать push `user.pack.stats.updated` (UserPackStatsUpdate)

Статус: **черновик для согласования**  
Связано: [UPDATES_UI_TARGETS.md](./UPDATES_UI_TARGETS.md) §6 п.3, §8 P6, PR1 (R0–R-ui, release 0.0.75)

---

## 1. Зачем

После PR1 (R0 + R1) число Updates уже меньше, но на одно counter-событие для пользователя из slice часто уходят **два** push в `users.list`:

| Update | Секция | Смысл |
|--------|--------|-------|
| `user.stats.update` | `data.user.stats` | агрегат по пользователю + **`packs.messages.*`** (dedupe multi-pack) |
| `user.pack.stats.updated` | `data.userPackStats` | unread **одного** `packId` |

Для **монитора / строки агента** (общий бейдж «непрочитанное в диалогах с паками») достаточно **`user.stats.update`** — это канон с 0.0.74 (`USER_PACKS_MESSAGES_STATS_PLAN.md` Q5).

Per-pack push нужен только если UI рисует **список паков с отдельным бейджем на каждой строке** в realtime без GET.

**Решение PR2:** отключить push `UserPackStatsUpdate` из counter-worker (аналог R0 для `PackStatsUpdate`). Per-pack unread остаётся в MongoDB и в GET API.

---

## 2. Что не трогаем

| Слой | Действие |
|------|----------|
| `UserPackUnreadBySenderType` | пересчёт в БД **без изменений** (`recalculateUserPackUnreadBySenderType`) |
| `UserPackedMessagesUnreadBySenderType` | пересчёт **без изменений** |
| `user.stats.update` | **единственный** push для packed-unread агрегата (`packs.messages.*`) |
| `GET /api/users/:userId/packs`, `GET /api/users/:userId/packs/:packId` | источник per-pack данных для UI списка паков |
| `buildUserPackStatsSection`, `createUserPackStatsUpdate` | **удалить функцию** (как `createPackStatsUpdate` в 0.0.75), не оставлять deprecated dead code |

---

## 3. Семантика (напоминание integrator)

```
sum(userPackStats.unreadCount по всем packId)  ≠  user.stats.packs.messages.totalUnreadCount
```

При multi-pack dialog агрегат считает диалог **один раз**; per-pack строки — **по каждому паку отдельно**. После PR2 integrator **не получает** per-pack push; для экрана «мои паки» — GET или invalidate кэша по `user.stats.update`.

---

## 4. Этап **R5** (PR2)

| ID | Изменение | Breaking? |
|----|-----------|-----------|
| **R5** | убрать вызов `createUserPackStatsUpdate` из `publishCounterUpdates` | нет для monitor-only; **да** для клиентов на `update.pack.*` |
| **R5-doc** | INTEGRATION.md, UPDATES.md, UPDATES_UI_TARGETS.md | нет |
| **R5-code** | удалить `createUserPackStatsUpdate`, маппинг `user.pack.stats.updated` | внутренний API utils |

Не путать с **R3** (один канал unread в `dialogs.list`) и **R4** (dedup Updates) — отдельные PR.

---

## 5. Изменения в коде

### 5.1. `publishCounterUpdates.ts`

Удалить блок:

```typescript
for (const packId of packIds) {
  for (const userId of userIds) {
    createUserPackStatsUpdate(...)
  }
}
```

Убрать импорты `createUserPackStatsUpdate`, `UserPackUnreadBySenderType`, `buildUserPackStatsFromBySenderRows` (если больше не нужны).

Оставить без изменений:

- цикл `createUserStatsUpdate` для `slice.userIds`
- цикл `createDialogMemberUpdate` для `slice.userDialogs`

### 5.2. `updateUtils.ts`

- удалить `createUserPackStatsUpdate`, тип `UserPackStatsUpdateData`
- в `getUpdateTypeFromEventType` — убрать ветку `user.pack.stats.updated`
- в `publishUpdate` — убрать `packUpdates` / category `pack` (или оставить пустым до появления других pack-Updates)
- routing key `update.pack.*` **перестанет генерироваться**

### 5.3. `eventUtils.ts`

- опционально убрать `'user.pack.stats.updated'` из `UI_TARGET_BY_UPDATE_EVENT_TYPE` (или оставить для исторических Update в БД)

### 5.4. Другие пакеты

Проверено: **`createUserPackStatsUpdate` вызывается только из `publishCounterUpdates`** (tenant-api уже не вызывает).

---

## 6. Документация

| Файл | Изменение |
|------|-----------|
| `INTEGRATION.md` | убрать секцию «User Pack Stats Updates» как push; указать GET для per-pack; deprecate `update.pack.*` binding |
| `UPDATES.md` | пометить `user.pack.stats.updated` / `UserPackStatsUpdate` как *push отключён*; канон packed unread — `user.stats.update` |
| `UPDATES_UI_TARGETS.md` | §8.4: добавить R5; §8.2 пересчитать «После R0–R5»; §10 — PR2 spec |
| `INTEGRATORS_COUNTERS_MIGRATION.md` | чеклист: per-pack только GET + invalidate по `user.stats.update` |
| `EVENTS.md` | уточнить: `user.pack.stats.updated` не push (если упоминается как Update) |

---

## 7. Тесты

| Тест | Действие |
|------|----------|
| `publishCounterUpdates.test.js` | удалить кейсы R1 для UserPack; добавить «не вызывает createUserPackStatsUpdate» |
| `counterStack.integration.test.js` | assert: после `message.create` в паке есть `user.stats.update`, **нет** `user.pack.stats.updated` |
| `eventUtils.test.js` | при удалении из UI map — обновить assert |

Прогон: `npm run test:ci:counters`, полный `npm test`.

---

## 8. Миграция integrator

### Monitor / inbox (типичный случай)

```javascript
// было (лишнее после PR2)
case 'user.pack.stats.updated':
  replaceUserPackStats(...);

// достаточно
case 'user.stats.update':
  store.users[userId].stats = update.data.user.stats; // includes packs.messages.*
```

### Экран «список паков с бейджами»

| Стратегия | Когда |
|-----------|-------|
| **GET при открытии** + refetch по `user.stats.update` | рекомендуется v1 |
| Подписка `update.pack.*` | **перестанет получать сообщения** после PR2 |

Пример invalidate:

```javascript
if (update.data?.context?.uiTarget === 'users.list' && update.eventType === 'user.stats.update') {
  invalidateUserPacksCache(update.userId); // следующий рендер — GET /users/:id/packs
}
```

### Подписки RabbitMQ

- `update.*.{userType}.{userId}.*` — по-прежнему OK (просто меньше сообщений)
- `update.pack.{userType}.{userId}.*` — **можно снять** после PR2

---

## 9. Оценка сокращения Updates

Пример из §8.2 UPDATES_UI_TARGETS: `message.create`, 2 получателя, 1 пак.

| | PR1 (0.0.75) | PR2 (R5) |
|--|--------------|----------|
| MessageUpdate | 2 | 2 |
| UserStatsUpdate | 2 | 2 |
| DialogMemberUpdate | 2 | 2 |
| UserPackStatsUpdate | 0–2 (slice) | **0** |
| **Итого counter+update** | ~6–8 | **~6** |

Выигрыш растёт с числом `packIds` в slice (раньше `|packIds| × |userIds|` UserPack Updates).

---

## 10. Риски и откат

| Риск | Митигация |
|------|-----------|
| Клиент ждёт live per-pack badge | GET + invalidate; документировать в INTEGRATION |
| Controlo UI показывает per-pack realtime | проверить controlo-ui; при необходимости polling GET |
| Старые Update в MongoDB с `user.pack.stats.updated` | не мигрируем; только новые события |

**Откат:** вернуть цикл в `publishCounterUpdates` (git revert PR2).

---

## 11. Вне PR2 (не блокирует R5)

- **R3:** unread sidebar только через `DialogMemberUpdate`
- **R4:** dedup `(eventId, userId, updateType)`; diff перед push (актуально было бы для UserPack — уже не нужно при R5)
- **Опциональный v2:** partial `user.stats` по `updatedFields` — по-прежнему отложено
- **Вернуть per-pack push** только если появится отдельный UI target / подписка (не `users.list` aggregate)

---

## 12. Чеклист реализации

- [x] R5: правка `publishCounterUpdates.ts`
- [x] Удаление `createUserPackStatsUpdate` и pack category в routing
- [x] Тесты counter stack
- [x] INTEGRATION.md + UPDATES.md + UPDATES_UI_TARGETS §11
- [ ] Smoke на staging: `message.create` в паке → один `user.stats.update`, нет `userpackstatsupdate`
- [ ] Release note для integrator (0.0.76)

---

## 13. Связанные документы

- [UPDATES_UI_TARGETS.md](./UPDATES_UI_TARGETS.md) — UI targets, аудит P6
- [USER_PACKS_MESSAGES_STATS_PLAN.md](./USER_PACKS_MESSAGES_STATS_PLAN.md) — `packs.messages.*` в `user.stats.update`
- [INTEGRATION.md](./INTEGRATION.md) — гайд для integrator
