# 🔧 Исправления использования dialogId и messageId в контроллерах

## Проблема

После введения кастомных ID (`dialogId: dlg_XXX`, `messageId: msg_XXX`), endpoint'ы стали получать эти строковые ID в URL, но контроллеры продолжали искать по MongoDB ObjectId (`_id`).

---

## ✅ Исправления

### 1. **dialogController.js**

#### Метод `getById`
```javascript
// Было:
const dialog = await Dialog.findOne({
  _id: req.params.id,
  tenantId: req.tenantId
});

// Стало:
const dialog = await Dialog.findOne({
  dialogId: req.params.id,  // Теперь ищем по dialogId (dlg_XXX)
  tenantId: req.tenantId
});
```

#### Загрузка мета-данных
```javascript
// Было:
const meta = await metaUtils.getEntityMeta(
  req.tenantId,
  'dialog',
  dialog._id
);

// Стало:
const meta = await metaUtils.getEntityMeta(
  req.tenantId,
  'dialog',
  dialog.dialogId  // Используем dialogId для мета-данных
);
```

---

### 2. **messageController.js**

#### Метод `getDialogMessages`
```javascript
// Было:
const dialog = await Dialog.findOne({
  _id: dialogId,
  tenantId: req.tenantId
});
let query = {
  tenantId: req.tenantId,
  dialogId: dialogId  // Строка dlg_XXX не подходит для Message.dialogId (ObjectId)
};

// Стало:
const dialog = await Dialog.findOne({
  dialogId: dialogId,  // Ищем Dialog по dialogId (dlg_XXX)
  tenantId: req.tenantId
});
let query = {
  tenantId: req.tenantId,
  dialogId: dialog._id  // Используем ObjectId для поиска сообщений
};
```

#### Метод `createMessage`
```javascript
// Было:
const dialog = await Dialog.findOne({
  _id: dialogId,
  tenantId: req.tenantId
});
const message = await Message.create({
  tenantId: req.tenantId,
  dialogId: dialogId,  // Строка dlg_XXX
  content,
  senderId,
  type
});

// Стало:
const dialog = await Dialog.findOne({
  dialogId: dialogId,  // Ищем Dialog по dialogId (dlg_XXX)
  tenantId: req.tenantId
});
const message = await Message.create({
  tenantId: req.tenantId,
  dialogId: dialog._id,  // Используем ObjectId для связи в Message
  content,
  senderId,
  type
});
```

#### Создание MessageStatus
```javascript
// Было:
await MessageStatus.create({
  messageId: message._id,  // ObjectId
  userId: userId,
  tenantId: req.tenantId,
  status: 'unread'
});

// Стало:
await MessageStatus.create({
  messageId: message.messageId,  // Строка msg_XXX
  userId: userId,
  tenantId: req.tenantId,
  status: 'unread'
});
```

#### Helper function `enrichMessagesWithMetaAndStatuses`
```javascript
// Было:
const meta = await metaUtils.getEntityMeta(
  tenantId,
  'message',
  message._id
);
const messageStatuses = await MessageStatus.find({
  messageId: message._id,
  tenantId: tenantId
});

// Стало:
const meta = await metaUtils.getEntityMeta(
  tenantId,
  'message',
  message.messageId  // Используем messageId для мета-данных
);
const messageStatuses = await MessageStatus.find({
  messageId: message.messageId,  // Используем messageId для поиска статусов
  tenantId: tenantId
});
```

---

### 3. **messageStatusController.js**

#### Метод `updateMessageStatus`
```javascript
// Было:
const message = await Message.findOne({
  _id: messageId,
  tenantId: req.tenantId
});

// Стало:
const message = await Message.findOne({
  messageId: messageId,  // Ищем по messageId (msg_XXX)
  tenantId: req.tenantId
});
```

---

### 4. **dialogMemberController.js**

#### Метод `addDialogMember`
```javascript
// Было:
const { dialogId, userId } = req.params;
const member = await unreadCountUtils.addDialogMember(
  req.tenantId,
  userId,
  dialogId  // Строка dlg_XXX, а ожидается ObjectId
);

// Стало:
const { dialogId, userId } = req.params;
// Найти Dialog по dialogId для получения ObjectId
const { Dialog } = await import('../models/index.js');
const dialog = await Dialog.findOne({ dialogId: dialogId, tenantId: req.tenantId });
if (!dialog) {
  return res.status(404).json({
    error: 'Not Found',
    message: 'Dialog not found'
  });
}
const member = await unreadCountUtils.addDialogMember(
  req.tenantId,
  userId,
  dialog._id  // Передаем ObjectId
);
```

#### Метод `removeDialogMember`
```javascript
// Было:
const member = await DialogMember.findOne({
  tenantId: req.tenantId,
  userId,
  dialogId  // Строка dlg_XXX, а в БД ObjectId
});
await unreadCountUtils.removeDialogMember(
  req.tenantId,
  userId,
  dialogId  // Строка dlg_XXX
);

// Стало:
const { Dialog } = await import('../models/index.js');
const dialog = await Dialog.findOne({ dialogId: dialogId, tenantId: req.tenantId });
if (!dialog) {
  return res.status(404).json({
    error: 'Not Found',
    message: 'Dialog not found'
  });
}
const member = await DialogMember.findOne({
  tenantId: req.tenantId,
  userId,
  dialogId: dialog._id  // Используем ObjectId
});
await unreadCountUtils.removeDialogMember(
  req.tenantId,
  userId,
  dialog._id  // Передаем ObjectId
);
```

---

### 5. **metaController.js**

#### Helper function `verifyEntityExists`
```javascript
// Было:
case 'dialog':
  const dialog = await Dialog.findOne({ _id: entityId, tenantId });
  break;
case 'message':
  const message = await Message.findOne({ _id: entityId, tenantId });
  break;

// Стало:
case 'dialog':
  const dialog = await Dialog.findOne({ dialogId: entityId, tenantId });
  break;
case 'message':
  const message = await Message.findOne({ messageId: entityId, tenantId });
  break;
```

---

### 6. **userDialogController.js**

#### Метод `getUserDialogs`
```javascript
// Было:
const dialogs = dialogMembers.map(member => ({
  dialogId: member.dialogId._id,  // Возвращал ObjectId
  dialogName: member.dialogId.name,
  ...
}));

// Стало:
.populate('dialogId', 'dialogId name createdAt updatedAt')  // Добавлен dialogId в populate
...
const dialogs = dialogMembers.map(member => ({
  dialogId: member.dialogId.dialogId,  // Возвращает dlg_XXX
  dialogName: member.dialogId.name,
  dialogObjectId: member.dialogId._id,  // Сохраняем для поиска сообщений
  ...
}));
...
// Удаляем временное поле dialogObjectId из финального ответа
const { dialogObjectId, ...dialogWithoutObjectId } = dialog;
```

---

## 🎯 Ключевые принципы

### Внешние ID (API):
- **dialogId:** `dlg_XXXXXXXXXXXXXXXXXXXX` (20 символов) - используется в URL и ответах
- **messageId:** `msg_XXXXXXXXXXXXXXXXXXXX` (20 символов) - используется в URL и ответах

### Внутренние ID (БД):
- **Dialog._id:** MongoDB ObjectId - используется для связей в DialogMember и Message
- **Message._id:** MongoDB ObjectId - используется для внутренних операций

### Правила:
1. **URL параметры** содержат `dialogId` или `messageId` (строки)
2. **Поиск Dialog/Message** по `dialogId`/`messageId`
3. **Связи в БД** (DialogMember.dialogId, Message.dialogId) используют ObjectId
4. **MessageStatus.messageId** и **MessageReaction.messageId** используют строковый messageId
5. **Meta.entityId** использует строковые ID (dialogId для диалогов, messageId для сообщений)

---

## 🧪 Тестирование

После исправлений работают следующие endpoint'ы:

```bash
API_KEY="chat3_edabb7b0fb722074c0d2efcc262f386fa23708adef9115392d79b4e5774e3d28"

# 1. Получить список диалогов (вернет dialogId: dlg_XXX)
curl -H "X-API-Key: $API_KEY" -H "X-TENANT-ID: tnt_default" \
  "http://localhost:3000/api/dialogs?limit=1"

# 2. Получить конкретный диалог по dialogId
curl -H "X-API-Key: $API_KEY" -H "X-TENANT-ID: tnt_default" \
  "http://localhost:3000/api/dialogs/dlg_lmku3z429icej0sf12me"

# 3. Получить сообщения диалога по dialogId
curl -H "X-API-Key: $API_KEY" -H "X-TENANT-ID: tnt_default" \
  "http://localhost:3000/api/dialogs/dlg_lmku3z429icej0sf12me/messages?limit=5"

# 4. Получить диалоги пользователя
curl -H "X-API-Key: $API_KEY" -H "X-TENANT-ID: tnt_default" \
  "http://localhost:3000/api/users/carl/dialogs?limit=5"

# 5. Обновить статус сообщения (с messageId msg_XXX)
curl -X POST -H "X-API-Key: $API_KEY" -H "X-TENANT-ID: tnt_default" \
  "http://localhost:3000/api/messages/msg_abc123xyz/status/carl/read"

# 6. Добавить участника диалога (с dialogId dlg_XXX)
curl -X POST -H "X-API-Key: $API_KEY" -H "X-TENANT-ID: tnt_default" \
  -H "Content-Type: application/json" \
  "http://localhost:3000/api/dialogs/dlg_lmku3z429icej0sf12me/members/john/add"
```

---

## 📝 Измененные файлы

- ✅ `src/controllers/dialogController.js`
- ✅ `src/controllers/messageController.js`
- ✅ `src/controllers/messageStatusController.js`
- ✅ `src/controllers/dialogMemberController.js`
- ✅ `src/controllers/metaController.js`
- ✅ `src/controllers/userDialogController.js`

---

## 🚀 Перезапуск проекта

```bash
chmod +x final-restart.sh
./final-restart.sh
```

Или вручную:

```bash
# Остановка
pkill -f "node src" 2>/dev/null || true

# Запуск
cd /home/sergey/Projects/tmp3/chat3
npm start > /tmp/chat3.log 2>&1 &
node src/workers/updateWorker.js > /tmp/worker.log 2>&1 &
```

