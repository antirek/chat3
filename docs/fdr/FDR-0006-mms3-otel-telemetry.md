# FDR-0006: Телеметрия MMS3 (OpenTelemetry) внутри chat3

- Status: draft
- Date: 2026-11-23
- Scope: mms3 / chat3
- Affects:
  - `tenant-api`
  - `outbox-relay`
  - `update-worker`
  - `counter-worker`
  - `dialog-read-worker`
- Related ADR: —
- Related issue: #16314
- Related: вложение `TZ-mms3.md` в #16314; space FDR-S-0023 / ADR-S-0018 (#15401, mms3 вне); [FDR-0005](./FDR-0005-http-health.md) (HTTP `/health` / `/ready`)
- Verify: `store/16314/16314_verify.md` (Ready; ответы чата 2026-11-23: q1=B, q2=A)

## Context

#16314 добавляет телеметрию в процессы MMS3 (репозиторий chat3), чтобы находить проблемы доставки outbox, обработки workers и отказов Tenant API. Канон имён метрик, labels и точек инкремента — вложение `TZ-mms3.md`. Образец платформы экспорта (OTLP/gRPC, три endpoint env, `SERVICE_NAME`) — #15401 / FDR-S-0023 / ADR-S-0018; код mone в эту задачу не входит.

Verify закрыл развилки:

1. **q1 = B.** Только spans и метрики **внутри** пяти процессов chat3. Persist W3C `traceparent` / `tracestate` в `OutboxEvent` и прокидка в AMQP headers ради продолжения цепочки #15401 **не** входят. Сквозной e2e с mone не обязателен для закрытия #16314. (Ответ journal 71748 про сквозняк для этой задачи перекрыт.)
2. **q2 = A.** DoD по метрикам — **полный** каталог `TZ-mms3.md`, включая reason-таксономии лент. MVP-урезание journal 72355 не применяется.
3. `health_check_status` **входит** (readiness 1/0). Фраза ТЗ «код для этой метрики пока не добавляем» для #16314 **не** действует.
4. Проставление `OTEL_*` / `SERVICE_NAME` / `DEPLOYMENT_ENVIRONMENT` в deploy-стеки **не** входит; env выставят вручную позже. Без env сервисы работают как до телеметрии.

## Decision

### 1. Где живёт поведение

Телеметрия #16314 — только в репозитории chat3, процессы:

`tenant-api`, `outbox-relay`, `update-worker`, `counter-worker`, `dialog-read-worker`.

Controlo / UI / integrator-grpc и код mone/signup **вне** решения.

### 2. Включение SDK

Телеметрия процесса включена только если заданы все три:

- `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`
- `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT`
- `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT`

Экспорт — **OTLP/gRPC**. Если хотя бы один endpoint не задан: SDK не поднимается, сигналы не собираются и не экспортируются; в stdout **один раз** — что переменные не заданы и телеметрия отключена. Старт и бизнес-поведение от отсутствия коллектора не зависят.

### 3. Resource attributes

| Атрибут | Источник |
|---------|----------|
| `service.name` | env `SERVICE_NAME` (имя процесса, напр. `tenant-api`) |
| `deployment.environment` | env `DEPLOYMENT_ENVIRONMENT` (строка как есть; канон значений — у оператора при выкладке) |

### 4. Traces (граница #16314)

- Внутри процесса: auto-instrumentation **точечно** по фактически используемым стекам (ориентир ТЗ: Express у tenant-api; Mongoose/Mongo; amqplib у процессов с Rabbit). Не регистрировать «всё подряд» и неиспользуемые instrumentations.
- При выключенной телеметрии auto-instrumentation не регистрировать.
- Ручные spans — только где auto не покрывает операцию.
- Ошибка в активном span — status error + событие exception.
- **Не** сохранять `traceparent`/`tracestate` в документы Mongo (`OutboxEvent` и др.) и **не** добавлять их в AMQP headers `publishEvent` ради продолжения цепочки mone. Обрыв контекста на границе HTTP→outbox→другой процесс / peer — ожидаем для #16314, не дефект. Follow-up на сквозняк с #15401 — отдельная задача.

### 5. Логи

- Существующие тексты/уровни/условия stdout **не менять**.
- Обёртка: сначала прежний stdout-лог, затем отдельная структурированная запись **только** в OTLP logs (не дублировать в stdout).
- В OTLP-логе: `trace_id` из активного контекста при наличии; для ошибок — `exception.type` / `message` / `stacktrace` (и аналоги из ТЗ).

### 6. `health_check_status` (gauge)

На **каждом** из пяти процессов: `1` = readiness ок (зависимости доступны, процесс может работать), `0` = deps плохие / не стартовал / shutdown.

- Это **OTEL-gauge readiness**, не замена HTTP probes.
- Согласование с FDR-0005: `GET /health` остаётся liveness без ping deps; readiness HTTP — `/ready`. Gauge можно кормить тем же смыслом deps (для tenant-api допустимо состояние `/ready` или прямая проверка Mongo/Rabbit); HTTP для gauge у workers **не** обязателен.
- Период повторной проверки deps — на define (рядом с существующим циклом сервиса).

### 7. Доменные метрики (полный каталог ТЗ)

Имена, labels (`outcome`, `reason`, …), правила инкремента и точки в коде — **как в `TZ-mms3.md`**. Обязательный набор включает, но не ограничивается:

**tenant-api:**  
`pack_messages_requests_total`, `pack_dialogs_requests_total`, `pack_selected_messages_requests_total`, `user_dialog_messages_requests_total`, `dialog_messages_requests_total`, `pack_write_requests_total`, `dialog_write_requests_total`, `message_status_requests_total`, `api_journal_writes_total` — с reason-таксономиями из ТЗ.

**outbox-relay:**  
`outbox_publish_attempts_total`, `outbox_publish_duration_seconds`, `outbox_event_delivery_lag_seconds`, `outbox_pending_events`, `rabbitmq_queue_messages` (`update_worker_queue`, `counter_worker_queue`), `rabbitmq_connection_up`.

**update-worker:**  
`update_worker_events_total`, `update_worker_event_duration_seconds`.

**counter-worker / dialog-read-worker:** отдельных бизнес-счётчиков сверх ТЗ нет; достаточно SDK, точечной auto-instrumentation, лог-обёртки и `health_check_status`. Очередь counter остаётся gauge outbox-relay.

Оговорка ТЗ: если смысл метрики уже реализован под другим именем — не дублировать; иначе вводить имена из ТЗ.

High-cardinality id (`tenantId`, `messageId`, …) **не** использовать как labels метрик.

### 8. Только телеметрия

Нельзя менять: HTTP-коды, ветвления, валидацию, retry/лимиты попыток outbox, порядок шагов, контракты API (в т.ч. внешний `publishEvent` → `boolean`), ack/requeue workers, тексты существующих stdout-логов. Метрики и spans — рядом с существующими ветками, без «починки» бизнес-ошибок.

### 9. Критерии закрытия #16314

1. Код телеметрии во всех пяти процессах.
2. Без OTEL endpoint env — поведение как до телеметрии (плюс одна stdout-строка про отключение).
3. Соответствие полному каталогу `TZ-mms3.md` и правилам этого FDR.
4. Обязательный smoke на конкретном контуре SigNoz и выкладка env в deploy **не** входят.

## Consequences

- SRE получает наблюдаемость внутри границы MMS3 (API RED/reasons, outbox lag/pending, Rabbit depth, worker outcomes) без ожидания сквозного trace mone→mms3.
- Обрыв trace на outbox/peer остаётся, как зафиксировано FDR-S-0023 для стороны mone, пока отдельная задача не продолжит цепочку.
- Фраза ТЗ про отложенный `health_check_status` для реализации #16314 не применяется — gauge обязателен.
- Полный reason-каталог лент увеличивает объём инструментирования tenant-api (complexity C); урезать без amend FDR нельзя.
- Status `draft`: в `accepted` переводит человек. После accept — `/task-define 16314`.

## Non-goals

- Persist / пропагация W3C context через OutboxEvent и AMQP к mone (#15401 follow-up).
- Проставление OTEL/`SERVICE_NAME`/`DEPLOYMENT_ENVIRONMENT` в deploy-стеки mone-mms3, amone-mms3 и др.
- Controlo, UI, Prometheus scrape, смена ack/nack/HTTP/retry.
- MVP-подмножество метрик вместо полного `TZ-mms3.md`.
- Flush OTLP по SIGTERM как отдельное требование (если не появится в define по аналогии с принятыми практиками репо — не блокер FDR).
