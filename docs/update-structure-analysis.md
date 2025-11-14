# Анализ структуры payload'ов Update

> ℹ️ **Обновление:** рекомендации ниже реализованы в `src/utils/updateUtils.js` и описаны в `docs/UPDATES_V2.md`. Текст сохранён как исторический анализ исходного состояния.

## Проверенные источники

- Документы `Update` всегда имеют одинаковый каркас (`tenantId`, `userId`, `dialogId`, `entityId`, `eventId`, `eventType`, `data`, флаги публикации). Отличия между типами апдейтов находятся исключительно в содержимом `data`.

```4:64:src/models/Update.js
const updateSchema = new mongoose.Schema({
  tenantId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  dialogId: { type: String, required: true, index: true },
  entityId: { type: String, required: true, index: true },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
  eventType: { type: String, required: true },
  data: { type: mongoose.Schema.Types.Mixed, required: true },
  published: { type: Boolean, default: false, index: true },
  publishedAt: { type: Number },
  createdAt: { type: Number, default: generateTimestamp, index: true }
}, {
  timestamps: false
});
```

- Наборы событий, которые порождают апдейты, жёстко заданы в `updateUtils`.

```11:36:src/utils/updateUtils.js
const DIALOG_UPDATE_EVENTS = ['dialog.create', 'dialog.update', 'dialog.delete', 'dialog.member.add', 'dialog.member.remove'];
const DIALOG_MEMBER_UPDATE_EVENTS = ['dialog.member.update'];
const MESSAGE_UPDATE_EVENTS = ['message.create','message.update','message.delete','message.reaction.add','message.reaction.update','message.reaction.remove','message.status.create','message.status.update'];
const TYPING_EVENTS = ['dialog.typing'];
```

## Сравнение типов Update

| Тип update | Источники событий | Получатели | `entityId` | Структура `data` | Заметки |
| --- | --- | --- | --- | --- | --- |
| `DialogUpdate` | `dialog.create`, `dialog.update`, `dialog.delete`, `dialog.member.*` | Все активные участники диалога | `dlg_*` | Плоские поля диалога (`dialogId`, `tenantId`, `name`, таймстемпы, `meta`) + персональный `dialogMemberMeta` + дублирующий блок `dialogInfo` | `dialogId` и метаданные присутствуют дважды (корень + `dialogInfo`). |
| `DialogMemberUpdate` (но роутится как `DialogUpdate`) | `dialog.member.update` | Один участник, упомянутый в событии | `dlg_*` | Та же структура диалога, дополненная `memberData` (unread, lastSeenAt и т.д.) + `dialogMemberMeta` + `dialogInfo` | Получателю нужно смотреть `memberData.userId`, чтобы понять, кого обновили. Routing key не отличает апдейт участника от общего апдейта диалога. |
| `MessageUpdate` | `message.*`, `message.reaction.*`, `message.status.*` | Все активные участники | `msg_*` | Полный документ сообщения (контент, вложения, счётчики, статусы, `senderInfo`) + опциональные `statusUpdate`/`reactionUpdate` + ещё один `dialogInfo` | Персональные метаданные участника отсутствуют (хотя доступны в DialogUpdate); `dialogInfo` снова дублирует данные диалога. |
| `Typing` | `dialog.typing` | Все участники, кроме печатающего | `dlg_*` | `{ dialogId, typing: { userId, expiresInMs, timestamp, userInfo }, dialogInfo }` | Единственный тип, где `data` не содержит ни `meta` диалога, ни `dialogMemberMeta`; есть только специально собранные поля. |

### Ссылки на код

```101:175:src/utils/updateUtils.js
export async function createDialogUpdate(...) {
  const dialogData = { dialogId: dialog.dialogId, tenantId: dialog.tenantId, name: dialog.name, createdBy: dialog.createdBy, createdAt: dialog.createdAt, updatedAt: dialog.updatedAt, meta: dialogMeta, dialogMemberMeta: memberMeta };
  const dialogInfo = { dialogId: dialog.dialogId, name: dialog.name, createdBy: dialog.createdBy, createdAt: dialog.createdAt, updatedAt: dialog.updatedAt, meta: dialogMeta };
  return { tenantId, userId: member.userId, dialogId: dialog.dialogId, entityId: dialog.dialogId, eventId, eventType, data: { ...dialogData, dialogInfo } };
}
```

```229:276:src/utils/updateUtils.js
export async function createDialogMemberUpdate(...) {
  const dialogData = {
    dialogId: dialog.dialogId,
    tenantId: dialog.tenantId,
    name: dialog.name,
    createdBy: dialog.createdBy,
    createdAt: dialog.createdAt,
    updatedAt: dialog.updatedAt,
    meta: dialogMeta,
    dialogMemberMeta: memberMeta,
    memberData: {
      userId: member.userId,
      unreadCount: eventData.unreadCount ?? member.unreadCount,
      lastSeenAt: eventData.lastSeenAt || member.lastSeenAt,
      lastMessageAt: member.lastMessageAt,
      isActive: member.isActive
    }
  };
  const dialogInfo = { dialogId: dialog.dialogId, name: dialog.name, createdBy: dialog.createdBy, createdAt: dialog.createdAt, updatedAt: dialog.updatedAt, meta: dialogMeta };
  const updateData = { tenantId, userId, dialogId: dialog.dialogId, entityId: dialog.dialogId, eventId, eventType, data: { ...dialogData, dialogInfo } };
}
```

```296:389:src/utils/updateUtils.js
export async function createMessageUpdate(...) {
  const fullMessage = await buildFullMessagePayload(...); // adds meta, statuses, senderInfo
  if (eventType.startsWith('message.status.')) fullMessage.statusUpdate = { userId: eventData.userId, status: eventData.newStatus, oldStatus: eventData.oldStatus ?? null };
  if (eventType.startsWith('message.reaction.')) fullMessage.reactionUpdate = { userId: eventData.userId, reaction: eventData.reaction, oldReaction: eventData.oldReaction ?? null };
  fullMessage.dialogId = dialog.dialogId;
  const dialogInfo = { dialogId: dialog.dialogId, name: dialog.name, createdBy: dialog.createdBy, createdAt: dialog.createdAt, updatedAt: dialog.updatedAt, meta: dialogMeta };
  const updates = dialogMembers.map(member => ({
    tenantId,
    userId: member.userId,
    dialogId: dialog.dialogId,
    entityId: message.messageId,
    eventId,
    eventType,
    data: { ...fullMessage, dialogInfo }
  }));
}
```

```407:470:src/utils/updateUtils.js
export async function createTypingUpdate(...) {
  const dialogInfo = { dialogId: dialog.dialogId, name: dialog.name, createdBy: dialog.createdBy, createdAt: dialog.createdAt, updatedAt: dialog.updatedAt, meta: dialogMeta };
  const updatesPayload = dialogMembers
    .filter(member => member.userId !== typingUserId)
    .map(member => ({
      tenantId,
      userId: member.userId,
      dialogId: dialog.dialogId,
      entityId: dialog.dialogId,
      eventId,
      eventType,
      data: {
        dialogId: dialog.dialogId,
        typing: {
          userId: typingUserId,
          expiresInMs,
          timestamp,
          userInfo
        },
        dialogInfo
      }
    }));
```

```543:556:src/utils/updateUtils.js
export function getUpdateTypeFromEventType(eventType) {
  if (DIALOG_UPDATE_EVENTS.includes(eventType)) return 'DialogUpdate';
  if (DIALOG_MEMBER_UPDATE_EVENTS.includes(eventType)) return 'DialogUpdate'; // same routing key, single recipient
  if (MESSAGE_UPDATE_EVENTS.includes(eventType)) return 'MessageUpdate';
  if (TYPING_EVENTS.includes(eventType)) return 'Typing';
  return null;
}
```

## Расхождения с целью «единый диалоговый контракт»

1. **Разные корневые структуры `data`.** Диалоговые апдейты вкладывают сам диалог, message-апдейты — полный документ сообщения, typing — объект `{ typing: ... }`. Клиентам приходится ветвиться по `eventType`, вместо того чтобы опираться на единую схему с секциями `dialog`/`message`/`member`/`typing`.
2. **Избыточный `dialogInfo`.** Во всех апдейтах повторяются поля диалога в `dialogInfo`, хотя те же значения уже есть в корне (или доступны по `dialogId`). Особенно бьёт по размеру payload'ов для частых message-апдейтов.
3. **`DialogMemberUpdate` неотличим в маршрутизации.** Используется тот же routing key, что и для `DialogUpdate`, поэтому подписчики не могут фильтровать «дельты участников», не парся содержимое.
4. **Пробелы в персональных метаданных.** Только диалоговые апдейты несут `dialogMemberMeta`. Message и typing не включают, например, mute/notify настройки, из-за чего клиент вынужден делать дополнительные запросы.
5. **Неодинаковая семантика `entityId`.** Для dialog/member/typing апдейтов это `dialogId`, а для message — `messageId`. Это логично, но требует всегда учитывать `eventType`, чтобы понять, к чему относится событие.
6. **Разные объёмы дельт.** MessageUpdate всегда несёт полный список статусов и счётчики реакций даже при маленьких изменениях, тогда как DialogMemberUpdate передаёт только дельту в `memberData`. Размер payload сильно различается.

## Идеи по унификации payload'ов

1. **Ввести нормализованный конверт `data`**, например:
   ```json
   {
     "dialog": { ... },
     "member": { ... },        // present when relevant
     "message": { ... },       // present when relevant
     "typing": { ... },        // present when relevant
     "context": {
       "eventType": "...",
       "reason": "...",        // e.g. message_read vs. external_unread_set
       "updatedFields": [...]
     }
   }
   ```
   Такой конверт позволит клиентам обращаться к `dialog`/`member`/`message`/`typing` по фиксированным ключам и при этом не заставляет заполнять лишнее (достаточно тех секций, что актуальны).
2. **Вынести общие данные диалога в один объект `dialog`** вместо дублирования между корнем `data` и `dialogInfo`. И `DialogUpdate`, и `MessageUpdate` могут ссылаться на одну структуру, уменьшив размер сообщений.
3. **Разделить routing keys для дельт участников**, например публиковать `user.{userId}.dialogmemberupdate`. Тогда слушатели смогут подписываться только на изменения unreadCount и т.п., не парся поток общих `DialogUpdate`.
4. **Прикладывать `dialogMemberMeta` ко всем персонализированным апдейтам**, а не только к диалоговым. В message-апдейтах UI как раз решает, как показать уведомление, и наличие флагов «muted/notifySound» избавит от дополнительных запросов.
5. **Легковесные дельты для «тяжёлых» апдейтов.** Для статусных событий можно отделить `fullMessage` от `statusUpdate` или хотя бы добавить в `context` список секций, которые реально изменились. Это позволит держать общий контракт и снизить трафик.

Такая унификация позволит интерпретировать любое обновление как «в диалоге X произошло Y» и обрабатывать его по предсказуемому JSON-шаблону, что соответствует цели: все апдейты описывают состояние диалога и его содержимого максимально одинаково.

