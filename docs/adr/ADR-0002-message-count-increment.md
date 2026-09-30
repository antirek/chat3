# ADR-0002: Инкремент totalMessagesCount и messageCount без полного скана

- Status: proposed
- Date: 2026-09-30
- Scope: mms3 / chat3
- Related issue: #16074
- Related: ADR-0001 (unread, не менять)

## Context

На `message.create` и `message.deleted` `recalculateSlice` вызывает `Message.countDocuments` по всей истории отправителя (`UserStats.totalMessagesCount`) и диалога (`DialogStats.messageCount`). Стоимость растёт с длиной истории. Состав выборки тот же, что сейчас: все типы, включая `system.*`, кроме `deleted == true`.

`senderId` и `dialogId` после создания сообщения не меняются. `ProcessedCounterEvent` пишется после среза. Пока счётчик считается запросом, повтор среза идемпотентен. `$inc` без отдельной отметки при повторе даст второй ±1.

Mongo контуров вроде amax — standalone, многодокументной транзакции нет.

## Decision

- На `message.create` и `message.deleted` горячий путь не вызывает `countDocuments` по `messages` ради этих двух счётчиков.
- Перед `$inc` пишется `MessageCountClaim` с уникальным ключом `tenantId + eventId`. Повтор этого `eventId` счётчик не двигает.
- Создание неудалённого сообщения: +1 в `UserStats.totalMessagesCount` и `DialogStats.messageCount`. Мягкое удаление (`deleted == true`): −1. Восстановление (`message.deleted` при `deleted == false`): +1. `system.*` входит в оба счётчика.
- Обрыв между отметкой и `$inc` занижает счётчик до `POST /api/init/full-recalculate-stats`.
- `recalculateDialogStats` на этих событиях обновляет `topicCount` и `memberCount` и не перезаписывает `messageCount` полным сканом.
- Полный `countDocuments` остаётся в `recalculateUserStats` и в ручном полном пересчёте.
- `PackStats.messageCount` по-прежнему сумма `DialogStats.messageCount`.
- `ProcessedCounterEvent` по-прежнему пишется в конце среза.

## Consequences

- Цена события не зависит от длины истории сообщений отправителя и диалога.
- В окне сбоя счётчик может быть меньше факта, пока не выполнен полный пересчёт.
- Онлайн-путь этих двух полей расходится с правилом «только пересчёт из фактов» в `COUNTERS_WORKER_ARCHITECTURE.md`. Для unread такое же исключение уже в ADR-0001.

## Alternatives

Вариант B заметки (реже полный `countDocuments`) и вариант C (считать при чтении карточки) отклонены тикетом.

Отметка после `$inc` (вариант B вопроса q2) при обрыве завышает счётчик. Принят вариант A: занижение до сверки.

Перенос ±1 при смене `senderId` или `dialogId` не делается: такого перехода в API нет.
