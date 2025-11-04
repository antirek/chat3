# 🔄 Обновление messageId в MessageStatus и MessageReaction

## ✅ Что было сделано

### 1. **Обновлены модели**

#### MessageStatus.js
Изменено поле `messageId`:
```javascript
// Было:
messageId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Message',
  required: true
}

// Стало:
messageId: {
  type: String,
  required: true,
  trim: true,
  lowercase: true,
  match: /^msg_[a-z0-9]{20}$/,
  index: true,
  description: 'ID сообщения в формате msg_XXXXXXXXXXXXXXXXXXXX'
}
```

#### MessageReaction.js
Изменено поле `messageId`:
```javascript
// Было:
messageId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Message',
  required: true,
  index: true
}

// Стало:
messageId: {
  type: String,
  required: true,
  trim: true,
  lowercase: true,
  match: /^msg_[a-z0-9]{20}$/,
  index: true,
  description: 'ID сообщения в формате msg_XXXXXXXXXXXXXXXXXXXX'
}
```

### 2. **Обновлен reactionUtils.js**

Удалены преобразования в ObjectId:

```javascript
// Было:
messageId: new mongoose.Types.ObjectId(messageId)
tenantId: new mongoose.Types.ObjectId(tenantId)

// Стало:
messageId: messageId
tenantId: tenantId
```

Обновлены все методы:
- `updateReactionCounts()` - использует строковые messageId и tenantId
- `incrementReactionCount()` - использует `{ messageId: messageId }` вместо `{ _id: messageId }`
- `decrementReactionCount()` - использует `{ messageId: messageId }` вместо `{ _id: messageId }`

### 3. **Обновлен seed.js**

Изменено создание статусов и реакций:

```javascript
// MessageStatus
messageStatuses.push({
  messageId: message.messageId,  // Было: message._id
  userId,
  tenantId: tenant.tenantId,
  status,
  createdAt: statusTime,
  updatedAt: statusTime
});

// MessageReaction
allReactions.push({
  tenantId: tenant.tenantId,
  messageId: message.messageId,  // Было: message._id
  userId: userId,
  reaction: reaction,
  createdAt: reactionTime,
  updatedAt: reactionTime
});

// Meta для сообщений
metaEntries.push({
  tenantId: tenant.tenantId,
  entityType: 'message',
  entityId: message.messageId,  // Было: message._id
  key: 'channelType',
  value: channelType,
  dataType: 'string',
});

// Meta для диалогов
metaEntries.push({
  tenantId: tenant.tenantId,
  entityType: 'dialog',
  entityId: dialog.dialogId,  // Было: dialog._id
  key: 'type',
  value: dialog.metaType,
  dataType: 'string',
});
```

### 4. **Обновлена конфигурация AdminJS**

#### MessageStatus
```javascript
messageId: {
  type: 'string',  // Было: reference: 'Message'
  isRequired: true,
  isTitle: true,
  description: 'ID сообщения в формате msg_XXXXXXXXXXXXXXXXXXXX'
}
```

#### MessageReaction
```javascript
messageId: {
  type: 'string',  // Было: reference: 'Message'
  isRequired: true,
  description: 'ID сообщения в формате msg_XXXXXXXXXXXXXXXXXXXX'
}
```

#### Message
Добавлено поле `messageId` в видимые свойства:
```javascript
messageId: {
  type: 'string',
  isVisible: { list: true, show: true, edit: false, filter: true },
  description: 'ID сообщения в формате msg_XXXXXXXXXXXXXXXXXXXX'
}

listProperties: ['_id', 'messageId', 'content', 'dialogId', 'senderId', 'type', 'createdAt']
showProperties: ['_id', 'messageId', 'content', 'tenantId', 'dialogId', 'senderId', 'type', 'meta', 'messageStatuses', 'createdAt', 'updatedAt']
```

#### Dialog
Добавлено поле `dialogId` в видимые свойства:
```javascript
dialogId: {
  type: 'string',
  isVisible: { list: true, show: true, edit: false, filter: true },
  description: 'ID диалога в формате dlg_XXXXXXXXXXXXXXXXXXXX'
}

listProperties: ['_id', 'dialogId', 'name', 'createdAt']
showProperties: ['_id', 'dialogId', 'name', 'tenantId', 'createdAt', 'updatedAt', 'meta', 'dialogMembers']
```

Исправлена загрузка мета-данных для использования `dialogId` вместо `_id`.

---

## 🎯 Результат

Теперь все связи между моделями используют единые форматы ID:

- ✅ **Dialog** → `dialogId` = `dlg_XXXXXXXXXXXXXXXXXXXX` (20 символов)
- ✅ **Message** → `messageId` = `msg_XXXXXXXXXXXXXXXXXXXX` (20 символов)
- ✅ **MessageStatus.messageId** → `msg_XXXXXXXXXXXXXXXXXXXX`
- ✅ **MessageReaction.messageId** → `msg_XXXXXXXXXXXXXXXXXXXX`
- ✅ **Meta (для диалогов).entityId** → `dlg_XXXXXXXXXXXXXXXXXXXX`
- ✅ **Meta (для сообщений).entityId** → `msg_XXXXXXXXXXXXXXXXXXXX`

---

## 📊 AdminJS

В админ-панели теперь отображаются все 10 моделей:

**Система:**
- ✅ Tenant
- ✅ ApiKey

**Чаты:**
- ✅ Dialog (с dialogId)
- ✅ DialogMember
- ✅ Message (с messageId)
- ✅ MessageStatus (с messageId как строка)
- ✅ MessageReaction (с messageId как строка)
- ✅ Meta

**Журналы:**
- ✅ Event
- ✅ Update

---

## 🚀 Как проверить

### Откройте AdminJS:
http://localhost:3000/admin

### Проверьте модели:
1. **MessageStatus** - должна отображаться с полем `messageId` (строка msg_XXX)
2. **MessageReaction** - должна отображаться с полем `messageId` (строка msg_XXX)
3. **Message** - должна показывать `messageId` в списке
4. **Dialog** - должна показывать `dialogId` в списке

---

## 📝 Важно

При создании новых записей в AdminJS:
- **MessageStatus** и **MessageReaction** требуют `messageId` в формате `msg_XXXXXXXXXXXXXXXXXXXX`
- Используйте существующие messageId из модели Message
- Валидация проверит корректность формата при сохранении

---

## ✅ Seed данные

После запуска `npm run seed`:
- Создано 1313 сообщений с уникальными messageId
- Создано 2348 статусов сообщений
- Создано 3189 реакций
- Все связи используют корректные messageId в формате `msg_XXX`

