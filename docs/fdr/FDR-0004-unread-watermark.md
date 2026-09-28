# FDR-0004: Unread по lastSeenAt и инкременту, markAllRead без синхронной записи статусов

- Status: draft
- Date: 2026-09-28
- Scope: mms3 / chat3
- Affects:
  - UserDialogStats.unreadCount / UserDialogUnreadBySenderType
  - UserDialogActivity.lastSeenAt (readUntil)
  - counter-worker: message.create / message.deleted / message.status.changed / dialog.messages.bulk_read
  - tenant-api и app-services: markAllRead / markPackAllRead
  - dialog-read-worker: DialogReadTask
- Related ADR: ADR-0001
- Related issue: #16023

## Context

28.09.2026 mongod MMS3 на app48: сотни медленных aggregate по `messages` (~8.2M docsExamined) и batch update `messagestatuses`. Горячий путь counter-worker на каждое событие вызывал `countUserDialogUnread` с `$lookup` в `messagestatuses` по всей ветке диалога. HTTP markAllRead синхронно писал MessageStatus пачками по 200.

`counterUpdateContexts` (глобальная Map) к инциденту не относится: размер был 0.

## Decision

1. Непрочитанное на полном пересчёте — сообщения участника с `createdAt >= DialogMember.createdAt` и, если задан `lastSeenAt`, `createdAt > lastSeenAt`. Свои и `system.*` и `deleted` не входят. `$lookup` в `messagestatuses` на этом пути нет.
2. Горячие события меняют сохранённый счётчик на ±1 или обнуляют его. Полный пересчёт остаётся для `dialog.member.add`, `dialog.member.changed`, `pack.dialog.*` и редкого reconcile.
3. `markAllRead` (диалог и пак) в HTTP: выставляет `lastSeenAt`, пишет unread = 0 и ставит `DialogReadTask`. Запись MessageStatus делает dialog-read-worker. В ответе `processedMessageCount` / `totalProcessedMessageCount` = 0, пока воркер не отработал.
4. Редкий полный пересчёт может расходиться с точечным `message.status.changed`, если `lastSeenAt` не сдвинут. Источник для сверки — окно `lastSeenAt`, не набор MessageStatus. Точечное прочтение держит инкремент до следующего reconcile.

## Consequences

- Клиент видит unread = 0 сразу после markAllRead, до фоновой проставки статусов.
- Потребители, которые ждали `processedMessageCount > 0` в том же ответе, получают 0 и задачу в `dialogreadtasks`.
- Reconcile больше не считает непрочитанным сообщение только потому, что нет строки MessageStatus, если оно не новее `lastSeenAt`.

## Open questions

Нет. Статус `accepted` ставит человек.
