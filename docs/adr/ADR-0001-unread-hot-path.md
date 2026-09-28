# ADR-0001: Горячий путь unread без скана истории и фоновый markAllRead

- Status: proposed
- Date: 2026-09-28
- Scope: mms3 / chat3
- Related FDR: FDR-0004
- Related issue: #16023

## Context

Индекс `{tenantId, dialogId, createdAt:-1}` не ограничивал aggregate: фильтр «нет MessageStatus read» и `$not` regex по `system.*` заставляли IXSCAN пройти всю ветку диалога. `dialog.messages.bulk_read` дополнительно загружал все `messageId` диалога и пересчитывал MessageStatusStats по каждому.

## Decision

- `message.create`, `message.deleted`, `message.status.changed`, `dialog.messages.bulk_read` обрабатывает `applyHotUnread`: дельта или `$set` нуля, без aggregate по истории.
- Полный пересчёт (`recalculateUserDialogUnread`) — один `$group` по окну `createdAt`, без `$lookup`.
- `resolveSlice` для `bulk_read` не читает все сообщения диалога.
- HTTP вызывает `scheduleDialogReadTask`. Пачка воркера по умолчанию 50, пауза 25 мс (`DIALOG_READ_BATCH_SIZE`, `DIALOG_READ_BATCH_SLEEP_MS`).
- tenant-api не пишет в лог полный `req.query` и mongo query.

## Consequences

- Нагрузка mongod на горячем диалоге перестаёт расти вместе с длиной истории.
- MessageStatus догоняет readUntil в dialog-read-worker. Counter на `bulk_read` только обнуляет счётчик.
- Лимиты памяти контейнеров и WiredTiger в этот ADR не входят.

## Alternatives

Оставить `$lookup`, но добавить `createdAt` в `$match`. Окно после `lastSeenAt` меньше, но каждое событие всё ещё гоняет aggregate. Для диалогов без watermark окно остаётся всей историей.
