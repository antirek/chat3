# Оценка архитектуры counter-worker (для обсуждения)

Документ дополняет [COUNTERS_WORKER_ARCHITECTURE.md](./COUNTERS_WORKER_ARCHITECTURE.md): насколько предложенная схема снижает риски со счётчиками, что даёт, чем платим, где остаются уязвимости.

**Вердикт в одном абзаце:** архитектура **существенно уменьшит** класс проблем «два писателя / двойной декремент / рассинхрон API и воркера», если довести миграцию до конца (single writer + идемпотентность + счётчики→Updates в одном месте). Она **не устранит** проблемы сложной доменной логики (mark-all-read, bulkWrite, паки, by-sender-type) и добавит новые операционные риски (задержка, порядок доставки, объём Updates). Выигрыш зависит от дисциплины реализации, а не от самой диаграммы.

---

## 1. Какие проблемы as-is закрывает

| Проблема (сейчас) | Снижение риска | Почему |
|-------------------|----------------|--------|
| Двойной декремент / инкремент (API + hook + worker) | **Высокое** | Один исполнитель `applyCounters`, hooks без счётчиков |
| Разные формулы в API и `recalculate*` | **Высокое** | Одна кодовая база `counterProcessor`; full-recalculate вызывает те же функции |
| Занижение/завышение из-за порядка событий в двух воркерах | **Среднее–высокое** | Идемпотентность по `eventId`; нет второго декремента в update-worker |
| Счётчики в БД ≠ то, что видит UI | **Среднее–высокое** | Явная цепочка «записали → `publishCounterUpdates` с read-after-write» |
| Сложно отладить «кто последний писал» | **Высокое** | Логи/история по `sourceEventId`, один сервис |
| Путаница Event vs Update в именах | **Среднее** | Переименование доменных событий; типы push отдельно |
| Синхронный `finalizeCounterUpdateContext` в API в обход очереди | **Высокое** | Убирается из hot path |

**Итого по классу багов:** да, для типичных инцидентов (0 unread при непрочитанном, double-decrement, расхождение пака и userStats) архитектура **целенаправленна и обоснована**.

---

## 2. Какие проблемы не закрывает (или переносит)

| Проблема | Остаётся? | Комментарий |
|----------|-----------|-------------|
| Ошибка в **формуле** пересчёта (by-sender-type, исключение sender) | Да | Single writer не исправляет неверную бизнес-логику — только концентрирует её |
| `markAllRead` + `dialog-read-worker` + bulkWrite без hooks | Частично | Нужно явное событие `dialog.messages.bulk_read` и один пересчёт; иначе снова обход counter-worker |
| Case/normalization `userId` | Частично | Должно быть в `counterProcessor`, не исчезает само |
| `statusMessageMatrix` vs unread (разная семантика) | Да | Это не счётчик; документация/UX, не воркер |
| Дрейф после сбоев / потерянных сообщений RabbitMQ | Да | Нужны мониторинг, DLQ, периодический full-recalculate |
| Производительность тяжёлого `recalculatePackStats` на каждое сообщение | Да | Может стать узким местом; возможны дебаунс/батчи |
| Миграция: старые данные уже испорчены | Да | Обязателен full-recalculate после деплоя |
| Сложность тестирования end-to-end | Смещается | Меньше путей в API, больше интеграционных тестов воркера |

---

## 3. Плюсы

### 3.1. Архитектурные

- **Единая точка истины для материализованных счётчиков** — проще рассуждать, ревьюить и менять правила.
- **Согласованность БД и push** — counter-worker пишет число и шлёт то же число в Update; меньше «REST показывает одно, бейдж — другое».
- **Разделение домена и доставки** — Event = факт, Update = представление для UI; проще онбординг новых разработчиков.
- **Идемпотентность по событию** — естественная модель для RabbitMQ (at-least-once).
- **full-recalculate как «починка»** — тот же код, что и онлайн: `recalculateSlice` на срезе = урезанный `full-recalculate-stats`.
- **Согласованность агрегатов** — пересчёт среза целиком, Updates только после записи (§5.4).

### 3.2. Эксплуатационные

- Меньше «магии» в mongoose hooks при HTTP-запросе — предсказуемее профилирование API.
- Централизованные метрики: lag очереди, `ProcessedCounterEvent`, счётчик Updates на событие.
- Проще откатить логику счётчиков (один сервис/модуль), не трогая все контроллеры.

### 3.3. Для продукта / клиентов

- Стабильнее бейджи и сортировка по unread в realtime.
- Меньше гонок при быстром «прочитал → написал → прочитал».

---

## 4. Минусы и цена внедрения

### 4.1. Сложность и сроки

- **Большая миграция** (фазы 3–4 высокий риск): нельзя «включить наполовину» без регрессий.
- **Два типа Updates** (counter vs domain) — клиент должен корректно мержить; возможны два push подряд на одно действие.
- **Переименование event types** — dual-publish, совместимость внешних потребителей events (если есть).

### 4.2. Поведение API

- **Eventual consistency:** сразу после `POST /messages` в ответе может быть устаревший `unreadCount`, пока не пришёл Update (или пока не сделали read-after-write с ожиданием — дорого).
- Клиенты, которые полагаются только на синхронный ответ HTTP, потребуют доработки (подписка на updates обязательна).

### 4.3. Операционные

- Ещё один критичный процесс (или жёсткая зависимость update-worker от counter-step).
- При падении counter-worker растёт lag: и счётчики, и бейджи отстают.
- **Больше записей Update** на одно `message.create` (N пользователей × user + pack stats) — нагрузка на MongoDB и RabbitMQ.

### 4.4. Организационные

- Риск «временно оставить» старый путь в API «на всякий случай» — снова два писателя.
- Требует дисциплины: любой новый путь изменения unread **только** через Event → counter-worker.

---

## 5. Слабые места (где чаще всего сломается)

### 5.1. Порядок и доставка

| Риск | Описание |
|------|----------|
| Event до commit MongoDB | Worker не видит `Message` / `MessageStatus` |
| Два воркера без ordering | `MessageUpdate` приходит раньше counter-Update |
| At-least-once duplicate | Повторная доставка события |
| Потеря события | Счётчик навсегда неверен |

**Рекомендации и альтернативы**

| Проблема | Рекомендуемый вариант | Альтернативы | Комментарий |
|----------|----------------------|--------------|-------------|
| Event до commit | **Transactional Outbox:** в одной транзакции с доменом пишем строку `OutboxEvent`; отдельный relay публикует в RabbitMQ после commit | (A) `createEvent` только в callback `session.commitTransaction()`; (B) retry в worker с backoff, если документ не найден (хрупко) | Outbox — надёжнее; retry — быстрый MVP с метрикой `event_not_ready` |
| Два воркера | **Один consumer, два шага:** `recalculateSlice` → `publishCounterUpdates` → `processDomainUpdates` в том же процессе | (A) Одна очередь, consumer tags с prefetch=1 по `dialogId` (partition key); (B) counter-worker публикует `counter.slice.done` → update-worker | Раздельные деплои возможны позже, если есть ordering по ключу |
| Дубликат события | **`ProcessedCounterEvent`** + идемпотентный `recalculateSlice` | Хранить hash payload в Redis с TTL | MongoDB достаточно; Redis — если очень высокий QPS |
| Потеря события | **DLQ** + алерт + **cron** `reconcileCounters` (sample tenants) | Только nightly full-recalculate | Cron ловит тихие потери; full-recalculate — страховка, не единственная линия |

**MVP:** outbox или publish-after-commit + один процесс (counters → updates) + `ProcessedCounterEvent` + DLQ.

---

### 5.2. Особые пути (обход single writer)

| Путь | Риск |
|------|------|
| dialog-read-worker | bulk `MessageStatus` без события → счётчики не пересчитаны |
| admin / скрипты / mongo shell | прямое изменение БД |
| `applyMarkDialogAllRead` | второй писатель счётчиков + Updates из API |
| ленивый recalculate в GET | расходится с counter-worker |

**Рекомендации и альтернативы**

| Путь | Рекомендуемый вариант | Альтернативы |
|------|----------------------|--------------|
| dialog-read-worker | По завершении задачи — **одно** событие `dialog.messages.bulk_read` (`dialogId`, `userId`, `untilCreatedAt`); counter-worker делает `recalculateSlice` | Публиковать `message.status.changed` батчем (N событий — нагрузка на очередь) |
| mark all read в API | API только пишет домен + **`dialog.messages.bulk_read`** (или `dialog.member.changed` без счётчиков); весь пересчёт в worker | Оставить `applyMarkDialogAllRead`, но убрать из него запись счётчиков и Updates — только постановка `DialogReadTask` |
| admin / скрипты | После скрипта — вызов `POST /init/full-recalculate-stats` или событие `tenant.counters.reconcile` | Запретить прямую правку коллекций `*Stats` в runbook |
| GET диалога | **Убрать** ленивый пересчёт; если `DialogStats` нет — отдавать 0 / фоновое событие `dialog.stats.rebuild` | Оставить lazy только в controlo-backend, не в tenant-api |

**Правило:** любой код, меняющий unread или `MessageStatus`, обязан заканчиваться **доменным Event**, а не вызовом `counterUtils` напрямую.

---

### 5.3. Объём и производительность

| Риск | Суть |
|------|------|
| Пересчёт среза на каждое событие | Тяжелее `$inc`, особенно `recalculatePackStats` |
| Шторм Updates | N пользователей × несколько типов Update на одно сообщение |

**Рекомендации и альтернативы**

| Задача | Рекомендуемый вариант | Альтернативы | Когда что |
|--------|----------------------|--------------|-----------|
| Пересчёт пака | **`recalculateUserPackUnreadBySenderType` на срезе** (только userId пака + dialogIds пака); `PackStats` — **инкремент** `messageCount` / member/topic по событию, full `recalculatePackStats` — реже | Full `recalculatePackStats` на каждое `message.create` | Full pack — при `pack.dialog.add/remove` и в nightly reconcile; на message — дельта messageCount + пересчёт unread по срезу |
| Burst сообщений | **Debounce по ключу** `(tenantId, packId)` 200–500 ms: накопить eventIds, один `recalculateSlice` | Без debounce | Debounce — если профиль покажет всплески; осторожно с latency бейджа |
| Размер среза | Минимум: `dialogId` + members + `getPackIdsForDialog` | Пересчёт всего tenant | Никогда whole-tenant в онлайне |
| Шторм Updates | **Coalesce:** один `user.stats.update` на userId с полным snapshot; опционально batch publish | Отдельный Update на каждую коллекцию | Клиент всё равно мержит по `userId`; меньше сообщений в RabbitMQ |
| Нагрузочный потолок | Лимит параллелизма consumer + метрика `counter_slice_duration_ms` p99 | Горизонтальное масштабирование с partition по `dialogId` | Partition сохраняет порядок внутри диалога |

**Компромисс:** unread/by-sender — только **пересчёт из фактов**; тяжёлые агрегаты пака (`messageCount`, members) — **дельта по событию** + периодический reconcile.

---

### 5.3.1. Производительность: не full `recalculatePackStats` на каждое сообщение

Сейчас в update-worker на многие события вызывается полный `recalculatePackStats`. В to-be:

```
message.create / message.status.changed:
  → recalculateUserPackUnreadBySenderType(tenantId, packId)  // из MessageStatus по диалогам пака
  → PackStats.messageCount += 1  (или пересчёт только messageCount по dialogIds пака)
  → НЕ полный scan всех DialogStats пака на каждый read
```

Полный `recalculatePackStats` — при `pack.dialog.add/remove`, `dialog.member.add/remove` (меняется состав), и в **scheduled reconcile**.

### 5.4. Согласованность нескольких агрегатов

**Решение для обсуждения (принято в целевой схеме):** не цепочка `$inc` по пяти коллекциям, а **пересчёт затронутого среза целиком**, и только после успешной записи всех агрегатов — **`publishCounterUpdates`**.

Одно доменное событие затрагивает, например:

- `UserDialogStats` / `UserDialogUnreadBySenderType` — по `(userId, dialogId)` в срезе
- `UserUnreadBySenderType` / `UserStats` — по каждому `userId` в срезе
- `UserPackUnreadBySenderType` / `PackStats` — по каждому `packId`, связанному с диалогом
- `DialogStats` — по `dialogId`

**Целевой порядок в counter-worker:**

```
1. Определить срез (dialogId, userIds, packIds) из события
2. recalculateSlice(event) — пересчитать и записать ВСЕ агрегаты среза из Message + MessageStatus
   (те же функции, что full-recalculate, но на ограниченном множестве)
3. Только если шаг 2 успешен — publishCounterUpdates (read-after-write из БД)
4. Пометить eventId обработанным
```

**Почему так:**

- Нет промежуточного состояния «диалог −1, пак ещё старый» между шагами.
- Повторная доставка события даёт тот же результат (идемпотентный пересчёт), а не накопление лишних `$inc`.
- Payload Update всегда снимок **после** полного пересчёта среза — UI получает согласованные числа.

**Остаточный риск:** сбой между записью коллекций внутри `recalculateSlice` без транзакции.

**Рекомендации и альтернативы (частичный сбой)**

| Вариант | Суть | Плюсы | Минусы |
|---------|------|-------|--------|
| **A. Retry всего slice** | При любой ошибке шага — не помечать `ProcessedCounterEvent`, nack → redelivery | Просто, идемпотентный пересчёт | Повторная работа |
| **B. Версия среза** | В `CounterSliceRun` пишем `version`, `status: pending\|done`; Updates только при `done` | Видно «зависшие» срезы | Ещё одна коллекция |
| **C. MongoDB multi-document transaction** | Один session на все upsert в срезе (replica set) | ACID в пределах транзакции | Лимит 16 MB, latency, не все кластеры |
| **D. Saga + компенсация** | Откат предыдущих шагов при сбое | — | Сложно, дублирует идею пересчёта |
| **E. Reconcile job** | Онлайн — A; фоном сравнение агрегатов с пересчётом из Message | Ловит хвосты | Задержка обнаружения |

**Рекомендация:** **A + E** для MVP; **B** если нужен мониторинг в UI admin; **C** только для критичного пути (например bulk_read), если команда готова поддерживать транзакции.

Порядок записи внутри slice (минимизация «странного» состояния): dialog-level → user-dialog → user-level → pack-level; Updates **только** после успеха всех шагов.

---

### 5.5. Тестирование и наблюдаемость

| Пробел | Почему больно |
|--------|----------------|
| Баги только при lag очереди | Сложно воспроизвести локально |
| Нет контракта event → DB → Update | Регрессии при смене payload |
| Нет метрики drift | Ошибка месяцами до жалобы пользователя |

**Рекомендации и альтернативы**

**Контрактные / интеграционные тесты** (mongodb-memory-server + fake-amqplib):

| Сценарий | Assert |
|----------|--------|
| `message.create` → worker | `UserDialogStats`, `UserPackUnreadBySenderType`, `UserStats` = ожидание из fixture Message/MessageStatus |
| после worker | `Update` с `eventType: user.stats.update`, payload.unreadCount === DB |
| `message.status.changed` (read) | unread 0 / −1 согласованно на dialog, user, pack |
| duplicate `eventId` | счётчики и Updates не удваиваются |
| `dialog.messages.bulk_read` | один slice, один волной Updates |

Формат: таблица golden fixtures (`events/`, `expected-stats.json`, `expected-updates.json`) — один тест на строку.

**Метрика «online vs full recalculate» (reconcile)**

| Подход | Описание |
|--------|----------|
| **Scheduled reconcile** | Раз в N часов для sample / всех tenants: `fullRecalculateUser(userId)` в фоне, сравнить с материализованными полями |
| **Метрика drift** | `counter_drift{tenant, level}` = 1 если \|stored − recomputed\| > 0 для `unreadCount` / `unreadBySenderType` |
| **Алерт** | drift > 0 для tenant или > X пользователей за 15 мин |
| **После деплоя** | Обязательный `full-recalculate-stats` + выборочный reconcile 1% users |

**Альтернатива метрике:** не сравнивать в проде постоянно, а только **canary tenant** + интеграционные тесты в CI — дешевле, но хуже ловит прод-данные.

**Операционные метрики (минимум):**

- `counter_slice_duration_ms` (histogram по eventType)
- `counter_events_processed_total` / `counter_events_failed_total`
- `counter_updates_published_total` по типу Update
- `rabbitmq_consumer_lag` counter-worker
- `outbox_relay_lag` (если outbox)

**Рекомендация:** CI — полный контрактный набор; прод — reconcile 1×/сутки + алерт drift + dashboard lag.

---

## 6. Сравнение: оставить as-is vs counter-worker

| Критерий | As-is (патчи) | Counter-worker (полная миграция) |
|----------|---------------|----------------------------------|
| Риск double-decrement | Средний (уже ловили) | Низкий при single writer |
| Сложность кода | Размазана, но привычна | Концентрирована, выше порог входа |
| Latency для UI | Часто синхронно в API | +десятки–сотни ms через очередь |
| Latency для API | Тяжёлые bulkWrite в request | Легче HTTP |
| Масштабирование API | Счётчики мешают горизонтали | API stateless, воркер масштабируется |
| Отладка инцидента | «Где писали?» | «Смотрим eventId в counter-worker» |
| Стоимость миграции | Низкая | Высокая |

**Вывод:** as-is с точечными фиксами дешевле краткосрочно, но **не снимает системный риск**. Counter-worker окупается при регулярных инцидентах со счётчиками и планах развивать realtime UI.

---

## 7. Рекомендации для обсуждения (позиции команды)

### Стоит делать, если согласны с:

1. UI **обязан** обрабатывать counter-Updates; HTTP — не источник правды для бейджей после мутаций.
2. Готовы к **одному** обязательному full-recalculate после фаз 3–4 на проде.
3. Готовы **убрать** счётчики из hooks и API полностью, без «временных» дублей.
4. Заложить **outbox / retry** или принять риск event-before-commit явно.

### Стоит отложить / упростить MVP, если:

1. Критичен **синхронный** `unreadCount` в ответе `POST` — тогда гибрид (лёгкий preview в API + воркер как source of truth) или ожидание воркера в API (антипаттерн).
2. Нет ресурсов на нагрузочное тестирование паков — начать с **дельт** вместо full `recalculatePackStats` на каждое событие.
3. Внешние подписчики на `message.status.update` — сначала dual-publish имён событий.

### Компромиссный MVP (меньше риска внедрения)

1. Один процесс: `processCounters` → `publishCounterUpdates` → `processDomainUpdates`.
2. Счётчики уже вынести из update-worker, **но** пока оставить в API с feature-flag «только воркер» для staging.
3. Идемпотентность + интеграционные тесты до переключения прода.
4. Метрика: `sum(UserDialogStats.unread)` vs пересчёт из MessageStatus — алерт при расхождении.
5. В counter-worker **только** `recalculateSlice` + `publishCounterUpdates`, без `$inc` в онлайне.

---

## 8. Вопросы для встречи

1. Допустима ли для продукта **задержка бейджа** 100–500 ms после отправки/прочтения?
2. Нужен ли в ответе API **синхронный** unread или достаточно Update?
3. Границы **среза** пересчёта на `message.create` (только диалог / все паки диалога / debounce пака)?
4. Как объединять **два Updates** на клиенте (message + stats) — один batch channel?
5. Кто владеет **мониторингом** расхождения счётчиков после релиза?
6. Один воркер vs два деплоя — приоритет простоты деплоя или изоляции сбоев?

---

## 9. Итоговая оценка (шкала для обсуждения)

| Аспект | Оценка 1–5 | Комментарий |
|--------|------------|-------------|
| Снижение багов double-write / race | **5** | Главный выигрыш архитектуры |
| Снижение багов wrong formula | **2** | Нужны тесты и recalculate, не архитектура |
| Согласованность UI и БД | **4** | При обязательном publishCounterUpdates |
| Простота разработки (краткосрочно) | **2** | Миграция тяжёлая |
| Простота разработки (долгосрочно) | **4** | Один модуль счётчиков |
| Операционная надёжность | **3** | Зависимость от очереди; нужны DLQ и recalculate |
| Производительность под нагрузкой | **3** | Риск full recalculate пака; шторм Updates |
| Стоимость внедрения | **2** | Высокая |

**Общая рекомендация:** архитектуру **одобрять как целевую**, внедрять **поэтапно** с MVP «один consumer, counters→updates→domain» и жёстким запретом дублирования в API. Без фазы идемпотентности и без отключения hooks **выигрыш будет частичным** — это главный риск «сделали воркер, забыли убрать API».

---

См. также: [COUNTERS_WORKER_ARCHITECTURE.md](./COUNTERS_WORKER_ARCHITECTURE.md) (целевая схема), [USER_UNREAD_BY_SENDER_TYPE_PLAN.md](./USER_UNREAD_BY_SENDER_TYPE_PLAN.md) (детали by-sender-type).
