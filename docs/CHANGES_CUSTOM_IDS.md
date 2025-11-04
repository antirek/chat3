# Изменения: Добавление кастомных ID

## ✅ Выполнено

### 1. Модель Dialog
**Файл**: `src/models/Dialog.js`

**Добавлено поле `dialogId`**:
- Формат: `dlg_` + 20 символов (a-z, 0-9)
- Пример: `dlg_3k7m9q2w5x8n1p4r6t9y`
- Генерируется автоматически при создании
- Уникальный индекс
- Regex валидация: `/^dlg_[a-z0-9]{20}$/`

**Код генерации**:
```javascript
function generateDialogId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'dlg_';
  for (let i = 0; i < 20; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
```

### 2. Модель Message
**Файл**: `src/models/Message.js`

**Добавлено поле `messageId`**:
- Формат: `msg_` + 20 символов (a-z, 0-9)
- Пример: `msg_7a2b9c4d8e1f5g3h6j0k`
- Генерируется автоматически при создании
- Уникальный индекс
- Regex валидация: `/^msg_[a-z0-9]{20}$/`

**Код генерации**:
```javascript
function generateMessageId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'msg_';
  for (let i = 0; i < 20; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
```

## Характеристики

### Формат ID
- ✅ Префикс для идентификации типа (`dlg_`, `msg_`)
- ✅ Фиксированная длина (24 символа total: 4 префикс + 20 ID)
- ✅ Lowercase символы (безопасно для URL)
- ✅ Случайная генерация (36^20 комбинаций)
- ✅ Автоматическое создание через `default` функцию

### Валидация
- ✅ Mongoose regex validation
- ✅ Unique index на уровне базы данных
- ✅ Обязательное соответствие формату

### Индексы
```javascript
// Dialog
dialogSchema.index({ dialogId: 1 }, { unique: true });

// Message  
messageSchema.index({ messageId: 1 }, { unique: true });
```

## Использование

### Автоматическая генерация
```javascript
const dialog = await Dialog.create({
  tenantId: 'tnt_default',
  name: 'Test Dialog',
  createdBy: 'user123'
});
// dialog.dialogId автоматически установлен
// Например: 'dlg_k3m7p2w9x5n8q1r4t6y0'

const message = await Message.create({
  tenantId: 'tnt_default',
  dialogId: dialog._id,
  senderId: 'user123',
  content: 'Hello!',
  type: 'text'
});
// message.messageId автоматически установлен
// Например: 'msg_a2b7c4d9e1f5g3h6j8k0'
```

### Поиск по кастомному ID
```javascript
// По dialogId
const dialog = await Dialog.findOne({ 
  dialogId: 'dlg_k3m7p2w9x5n8q1r4t6y0' 
});

// По messageId
const message = await Message.findOne({ 
  messageId: 'msg_a2b7c4d9e1f5g3h6j8k0' 
});
```

## Преимущества

1. **Читаемость**: Сразу понятно что за сущность (dialog/message)
2. **URL-safe**: Только безопасные символы
3. **Предсказуемая длина**: Упрощает валидацию
4. **Уникальность**: Гарантирована на уровне БД
5. **Совместимость**: MongoDB `_id` остается для внутренних ссылок

## Обратная совместимость

- ✅ MongoDB `_id` остается основным ключом
- ✅ Ссылки (`ref`) используют `_id`
- ✅ Кастомные ID - дополнительное удобство
- ✅ API может работать с обоими типами ID

## Документация

Полная документация создана в файле: `CUSTOM_IDS.md`


