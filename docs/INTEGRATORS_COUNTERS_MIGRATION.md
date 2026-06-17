# Миграция для интеграторов: счётчики, tenant-api и RabbitMQ

Версия изменений: **0.0.71+** (counter-worker, outbox-relay).

Документ для внешних команд, которые:

- вызывают **tenant-api** (HTTP);
- подписаны на **доменные события** (`chat3_events`);
- подписаны на **Updates** (`chat3_updates`).

Связанные внутренние документы: [COUNTERS_WORKER_IMPLEMENTATION_PLAN.md](./COUNTERS_WORKER_IMPLEMENTATION_PLAN.md), [EVENTS.md](./EVENTS.md).

---

## 1. Суть изменения одной фразой

**Счётчики непрочитанного больше не обновляются синхронно в tenant-api.**  
Запись в MongoDB (`UserDialogStats`, `UserStats`, pack-счётчики) и публикация **counter-Updates** в RabbitMQ выполняются **counter-worker** после доменного события.  
tenant-api пишет доменные данные и ставит событие в **outbox**; в RabbitMQ событие попадает через **outbox-relay**.

---

## 2. Что нужно в инфраструктуре (не только tenant-api)

| Сервис | Роль для интегратора |
|--------|----------------------|
| **tenant-api** | HTTP API, доменные сущности, outbox |
| **outbox-relay** | Доставка событий из MongoDB в `chat3_events` |
| **counter-worker** | Пересчёт stats + Updates со счётчиками |
| **update-worker** | Domain Updates (диалог, сообщение, typing, user) **без** записи stats |
| **RabbitMQ** | `chat3_events`, `chat3_updates` (как раньше) |

Если запущен только tenant-api, события могут задерживаться в outbox, а **unread в GET и в Updates не совпадут с ожиданием «сразу после POST»**.

После чистого seed / миграции: один раз **полный пересчёт** (`POST /api/init/full-recalculate-stats` в controlo-backend или кнопка в админке «Инициализация»).

---

## 3. Изменения в tenant-api (HTTP)

### 3.1. Синхронные счётчики убраны

Из API **больше не вызывается** (в момент запроса):

- инкремент/декремент `unreadCount` при `message.create`, смене статуса, mark all read;
- запись pack/user stats из контроллеров;
- обновление счётчиков в post-save hooks `MessageStatus`.

**Остаётся в API:**

- создание/изменение `Message`, `MessageStatus`, `DialogMember`, activity (`lastSeenAt`, `lastMessageAt` где применимо);
- доменные **Event** + запись в **OutboxEvent**;
- ответы HTTP с данными сущностей (сообщение, диалог, участник).

### 3.2. Eventual consistency

| Действие | Раньше (типично) | Сейчас |
|----------|------------------|--------|
| `POST` сообщение | unread в БД и часто в ответе сразу | unread в БД **после** counter-worker (секунды, зависит от очереди) |
| `POST` read / mark all read | счётчики в том же запросе | `MessageStatus` в API; unread — после `message.status.changed` или `dialog.messages.bulk_read` |
| `GET` диалоги / packs / stats | актуальные счётчики | актуальны **после** обработки события; до этого возможен старый snapshot |

**Рекомендация:** для UI и ботов ориентироваться на **Updates** из RabbitMQ (`UserStatsUpdate`, `DialogMemberUpdate`, `UserPackStatsUpdate`), а не на поле unread в теле синхронного `POST`. Для разовой сверки — `GET` после небольшой задержки или после получения Update.

### 3.3. Семантика «непрочитано» (важно для сверки с CRM)

Непрочитано = у получателя **нет** записи `MessageStatus` со статусом `read` для этого `messageId` (статусы `unread` / `sent` / `delivered` считаются непрочитанными).

Дополнительно при подсчёте:

- не учитываются сообщения с `senderId === viewer`;
- не учитываются сообщения с `type`, начинающимся с `system.`.

Обратный переход `read` → `unread` **не поддерживается**.

### 3.4. Mark all read / pack mark all read

Порядок:

1. API обновляет `UserDialogActivity` (`applyMarkDialogAllRead`) — **не пишет** `UserDialogStats` напрямую.
2. Пишутся `MessageStatus = read` синхронно (`markDialogMessagesAsReadUntil`).
3. Публикуется **`dialog.messages.bulk_read`** — в т.ч. при `processedCount = 0`, если до операции `UserDialogStats.unreadCount > 0` (drift).
4. counter-worker пересчитывает slice и шлёт Updates.

Событие **`dialog.messages.bulk_read` не уходит до записи статусов** в БД (или при отсутствии сообщений — сразу при `unreadCount > 0`).

#### Membership (`markAllReadForAllUsers` / `markPackAllRead`)

| Условие | Результат для user U |
|---------|----------------------|
| U member в dlgA и dlgB | Оба диалога: `MessageStatus` read + пересчёт → pack contact unread = 0 |
| U member **только** в dlgB, inbound **только** в dlgA | dlgA **не** обрабатывается; pack contact unread для U **может остаться > 0**, если unread был в A и U не member в A |
| U member только в dlgB, inbound только в dlgA (U не видит A) | pack contact unread для U = **0** (нет строк по A) |
| `?memberType=user` | Contacts в паке не обрабатываются |

**Q1 (продукт):** оператор **не всегда** member inbound-dialog при outbound в другом диалоге пака — интегратор должен учитывать partial membership или вызывать markAllRead после добавления в dlgA.

**HTTP vs eventual consistency:** `200 OK` = MessageStatus записаны для обработанных пар `(user, dialog)`. Финальные `UserPackUnreadBySenderType` / `GET /users/:userId/stats` — после counter-worker (секунды).

#### Когда contact pack unread остаётся > 0 после markAllRead

| Причина | Действие интегратора |
|---------|----------------------|
| User не member в диалоге с inbound | Добавить member в dlgA или не ожидать сброса |
| `memberType=user` не применён, но ожидали сброс для contact | Передать `?memberType=user` |
| Counter-worker ещё не обработал outbox | Poll stats / дождаться Updates |
| Drift stats без сообщений | Повторить markAllRead (эмитится `bulk_read` при `unreadCount > 0`) |

### 3.5. PATCH unread участника (`setUnreadCount`)

- `unreadCount: 0` — по-прежнему mark-all-read сценарий (activity + задача чтения); финальный unread в БД — через counter-worker.
- Установка произвольного unread «сверху» (external sync) **не записывает** счётчик напрямую: в ответе может быть старое значение из `UserDialogStats`, фактическое — после пересчёта по сообщениям.

---

## 4. Доменные события (`chat3_events`)

### 4.1. Доставка: outbox

1. tenant-api: `Event` в MongoDB + `OutboxEvent` (`published: false`).
2. **outbox-relay**: poll → `publish` в exchange **`chat3_events`** → `published: true`.

Прямого fire-and-forget publish из API **нет**. Небольшая задержка между commit в БД и появлением сообщения в RabbitMQ — норма.

Формат тела события в очереди **не менился** (поля `eventId`, `tenantId`, `eventType`, `entityType`, `entityId`, `data`, …).

### 4.2. Переименование `eventType` (breaking)

В доменных событиях **нет** суффикса `.update` — используется **`.changed`**.

| Было | Стало |
|------|-------|
| `dialog.update` | `dialog.changed` |
| `message.update` | `message.changed` |
| `dialog.member.update` | `dialog.member.changed` |
| `message.status.update` | `message.status.changed` |
| `message.reaction.update` | `message.reaction.changed` |
| `dialog.topic.update` | `dialog.topic.changed` |
| `user.update` | `user.changed` |

Подписки и фильтры по `eventType` в payload нужно обновить.

### 4.3. Новое событие

| eventType | Когда | Зачем |
|-----------|--------|--------|
| `dialog.messages.bulk_read` | После массовой записи `read` в `MessageStatus` | Пересчёт unread по диалогу для пользователя |

`entityType`: `dialogMember`, `entityId`: `{dialogId}:{userId}`.

### 4.4. Routing keys (breaking, если привязка по action)

Формат без изменений:

```text
{entityType}.{action}.{tenantId}
```

`action` — **последний сегмент** `eventType`. Примеры:

| eventType | entityType | Routing key |
|-----------|------------|-------------|
| `dialog.changed` | `dialog` | `dialog.changed.tnt_default` |
| `message.status.changed` | `messageStatus` | `messageStatus.changed.tnt_default` |
| `message.create` | `message` | `message.create.tnt_default` |

Раньше для тех же сущностей было, например, `dialog.update.tnt_default` — binding `dialog.update.*` **перестанет** получать события.

### 4.5. События, которые больше не публикуются в `chat3_events`

Следующие типы **не являются** доменными `Event` в journal и **не уходят** в `chat3_events`:

- `pack.stats.updated`
- `user.pack.stats.updated`

Агрегаты по пакам по-прежнему доступны через **Updates** (см. §5) и через **GET** tenant-api.

### 4.6. Какие события влияют на счётчики (для отладки)

counter-worker обрабатывает whitelist:

- `message.create`
- `message.status.changed`
- `dialog.messages.bulk_read`
- `dialog.member.add` / `dialog.member.remove` / `dialog.member.changed`
- `dialog.topic.create`
- `pack.dialog.add` / `pack.dialog.remove`

Остальные события в `chat3_events` для counter-worker no-op (ack без пересчёта).

---

## 5. Updates (`chat3_updates`)

### 5.1. Разделение ответственности

| Источник | Типы Updates |
|----------|----------------|
| **update-worker** | `DialogUpdate`, `MessageUpdate`, `TypingUpdate`, `UserUpdate` — контент/состав диалога, сообщения, typing |
| **counter-worker** | `UserStatsUpdate`, `DialogMemberUpdate` (поле unread), `PackStatsUpdate`, `UserPackStatsUpdate` |

update-worker **не пишет** stats в MongoDB и **не** пересчитывает pack unread.

### 5.2. Routing keys Updates (без изменений формата)

```text
update.{category}.{userType}.{userId}.{updateType}
```

Примеры:

- `update.dialog.user.usr_abc.dialogmemberupdate`
- `update.user.user.usr_abc.userstatsupdate`
- `update.pack.user.usr_abc.userpackstatsupdate`

Exchange: **`chat3_updates`** (env: `RABBITMQ_UPDATES_EXCHANGE`).

### 5.3. Когда ждать counter-Updates

После доменных событий из §4.6 counter-worker:

1. пересчитывает slice в MongoDB;
2. публикует Updates с актуальными полями unread / pack stats.

Типичная цепочка для нового сообщения:

```text
message.create (chat3_events)
  → counter-worker → UserStatsUpdate, DialogMemberUpdate, UserPackStatsUpdate (при необходимости)
  → update-worker  → MessageUpdate, DialogUpdate
```

Порядок доставки Updates **не гарантирован** между worker’ами; оба consumer’а читают одну очередь событий независимо (`update_worker_queue`, `counter_worker_queue`).

### 5.4. `UserStatsUpdate`

Публикуется counter-worker с `eventType` в документе Update: **`user.stats.update`** (внутренний тип Update, не доменный Event).

Поля в context/data — агрегаты пользователя: `totalUnreadCount`, `unreadDialogsCount`, `unreadBySenderType`, …

### 5.5. `DialogMemberUpdate` и unread

Unread в `member.state.unreadCount` для доставки клиенту обновляет **counter-worker** (после пересчёта из `Message` + `MessageStatus`).

update-worker по `dialog.member.changed` может создавать `DialogMemberUpdate` с контекстом участника; **источник истины для unread** — пересчёт counter-worker, не тело PATCH из API.

---

## 6. Чеклист для интегратора

- [ ] Подписка на `chat3_events`: заменить `*.update` → `*.changed` в фильтрах и routing keys.
- [ ] Добавить обработку `dialog.messages.bulk_read` (если нужна реакция на mark all read до уровня UI).
- [ ] Убрать ожидание мгновенного unread в ответах `POST` tenant-api.
- [ ] Подписаться на `UserStatsUpdate` / `DialogMemberUpdate` / `UserPackStatsUpdate` для бейджей (если ещё не были).
- [ ] Не слушать `pack.stats.updated` / `user.pack.stats.updated` в **events** exchange — только Updates.
- [ ] Убедиться, что в деплое есть **outbox-relay** и **counter-worker**.
- [ ] После миграции данных — полный пересчёт stats (админка или `POST /api/init/full-recalculate-stats`).

---

## 7. Обратная совместимость

| Область | Совместимость |
|---------|----------------|
| HTTP paths tenant-api | Без переименования маршрутов |
| Формат `data` в событиях (sections) | В основном сохранён (`context`, `dialog`, `message`, `member`, …) |
| `eventType` в событиях | **Breaking** rename |
| Routing keys `chat3_events` | **Breaking** для binding `*.update.*` |
| Синхронный unread в POST | **Breaking** по времени (eventual) |
| `pack.stats.updated` в events | **Breaking** (только Updates) |

---

## 8. MessageStatusStats (счётчики по статусам сообщения)

- Агрегат **`MessageStatusStats`** (сколько записей истории с каждым `status` на `messageId`) обновляет **counter-worker** при `message.create`, `message.status.changed`, `dialog.messages.bulk_read`.
- Hooks в `MessageStatus` для `updateStatusCount` **отключены**.
- Событие **`message.status.changed`** публикуется **после** `MessageStatus.create()` в API (как `bulk_read` после bulk write).
- **`MessageReactionStats`** — по-прежнему в hooks (v1.1).

---

## 9. Вопросы и контакты

При расхождении счётчиков между CRM и Chat3:

1. Проверить, что работают outbox-relay и counter-worker.
2. Сверить семантику read (§3.3) с вашей моделью.
3. Запустить полный пересчёт stats.
4. Сравнить `GET` tenant-api и последний `UserStatsUpdate` / `UserPackStatsUpdate` по `eventId` источника.

*Документ актуален для ветки с counter-worker (план v2.4).*
