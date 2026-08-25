# FDR-0002: Retention журналов MongoDB — 60 дней через TTL

- Status: draft
- Date: 2026-08-25
- Scope: mms3 / chat3
- Affects:
  - политика retention Mongo-журналов chat3: **60 дней** (TTL), без cron
  - модели в `packages-shared/models/src/journals/` (сейчас **ApiJournal**; правило на будущие journal-модели)
  - константа retention (аналог mone `journalLogTtl.js`)
  - Controlo activity / db-explorer: данные старше 60 дней недоступны; окно ≤30 дней activity сохраняется
  - при выкате: допустимо удалить старые документы журналов
- Related ADR: —
- Related issue: #15522
- Related: mone [FDR-0008](../../../../mone/message-server/docs/fdr/FDR-0008-journal-logs-retention-ttl.md) (#14569)

## Context

В MongoDB chat3 накапливаются API-журналы (`ApiJournal`). Нужна политика удаления устаревших записей без ручной чистки и без отдельного cron — по аналогии с mone #14569 / FDR-0008.

Задача #15522 («mms3: удаление журналов»). Verify 2026-08-25 (Ready): цель, AC, in/out scope, retention **60 дней**, способ **только MongoDB TTL** заданы в description; критичных пробелов нет.

Прецедент TTL в том же репо: `CounterHistory` (`expireAfterSeconds` = 90 суток) — **не** входит в унификацию в рамках #15522.

ADR не требуется: изменения внутри одного репо chat3; способ (Mongo TTL) уже выбран; тип/поле для TTL — деталь define/plan, не архитектурная граница.

## Decision

### 1. Способ удаления

1. Удаление устаревших журналов выполняется **только через MongoDB TTL-индексы** (`expireAfterSeconds`).
2. **Cron / scheduled job / ручные скрипты очистки в scope #15522 не вводятся.**

### 2. Retention

3. Срок хранения для **всех** in-scope journal-коллекций: **60 календарных дней** (`60 * 24 * 3600` секунд).
4. Retention задаётся **одной константой** в коде моделей journals (аналог mone `JOURNAL_LOG_TTL_SECONDS` / `journalLogTtl.js`), чтобы будущие модели в каталоге переиспользовали то же значение.

### 3. Scope коллекций

5. In-scope: **все** Mongoose-модели в каталоге `packages-shared/models/src/journals/` (сейчас только **ApiJournal**; при появлении новых файлов в каталоге — тот же TTL 60д).
6. Out-of-scope (явно):
   - `Message`, `Dialog` и прочие бизнес-коллекции;
   - `Event` / `Update` / Outbox / `ProcessedCounterEvent`;
   - `DialogReadTask`;
   - `CounterHistory` (TTL 90д **не** менять на 60 в #15522);
   - файловые и console-логи на сервере.

### 4. Поведение продукта

7. После применения TTL документы старше 60 дней **автоматически удаляются** MongoDB; в Controlo activity, db-explorer и любых читателях journal-коллекций записи старше retention **недоступны**.
8. Окно Controlo `/api/activity/api-requests` **≤ 30 дней** остаётся валидным: retention 60д строго больше рабочего окна activity.
9. Гарантия «ровно на границе 60 суток» не требуется: допустима задержка фонового TTL-монитора MongoDB.

### 5. Миграция и типы даты

10. При выкате **допустимо удалить** уже существующие документы журналов старше retention (и при необходимости — весь объём старых журналов, если это упрощает миграцию схемы).
11. Поле, по которому строится TTL, должно быть **совместимо с Mongo TTL**. Сейчас у `ApiJournal.createdAt` тип `Number` (микросекунды, `generateTimestamp`) — как у `CounterHistory`. В define/plan выбрать поле/тип так, чтобы TTL реально удалял (прецедент Number в том же репо / подход #14569), **не ломая** Controlo activity за 30 дней. Деталь реализации — не продуктовое исключение из retention.

### Acceptance (проверка успеха #15522)

- На journal-коллекциях из `packages-shared/models/src/journals/` (как минимум `ApiJournal`) **присутствует TTL-индекс** с retention **~60 дней** (проверка `getIndexes()` на деплоях tubo-mms3 / amone-mms3 / amax-mms3 / mone-mms3).
- Отдельного cron очистки журналов **нет**.
- Controlo activity за окно ≤30 дней продолжает работать.
- Wipe/удаление старых journal-документов при миграции — допустим; критерий done — наличие TTL, не обязательный e2e-wait удаления конкретного документа.

## Consequences

- Рост journal-коллекций ограничен окном ~60 дней.
- Операторы/поддержка не смогут смотреть ApiJournal старше 60 дней в Controlo / db-explorer.
- Define/plan: константа TTL, индекс на ApiJournal, проверка совместимости `createdAt` с Mongo TTL; при смене типа учесть п.10–11 и activity ≤30д.
- Будущие модели в `journals/` обязаны использовать ту же константу retention.
- Агенты: не тащить унификацию `CounterHistory` 90→60 и не вводить cron.

## Non-goals

- Cron или внешние job’ы очистки.
- TTL / retention на коллекциях вне `packages-shared/models/src/journals/`.
- Унификация TTL `CounterHistory` 90 → 60 дней.
- Изменение файловых / console логов.
- Soft-delete / архивирование журналов в другое хранилище.
- Новые границы репозиториев, API или деплоя (ADR не требуется).
- FDR-S (не кросс-репо контракт).
