# Custom ID Fields

## Overview

В дополнение к стандартному MongoDB `_id`, модели `Dialog` и `Message` теперь имеют собственные кастомные ID поля:

- **dialogId** - для модели Dialog
- **messageId** - для модели Message

## Format

### dialogId
- **Префикс**: `dlg_`
- **Длина**: 20 символов (английские буквы в нижнем регистре + цифры)
- **Пример**: `dlg_3k7m9q2w5x8n1p4r6t9y`
- **Regex**: `/^dlg_[a-z0-9]{20}$/`

### messageId
- **Префикс**: `msg_`
- **Длина**: 20 символов (английские буквы в нижнем регистре + цифры)
- **Пример**: `msg_7a2b9c4d8e1f5g3h6j0k`
- **Regex**: `/^msg_[a-z0-9]{20}$/`

## Implementation Details

### Auto-generation
Оба ID генерируются автоматически при создании документа через функцию `default` в схеме Mongoose:

```javascript
// Dialog
dialogId: {
  type: String,
  required: false, // Генерируется автоматически
  unique: true,
  trim: true,
  lowercase: true,
  match: /^dlg_[a-z0-9]{20}$/,
  index: true,
  default: generateDialogId
}

// Message
messageId: {
  type: String,
  required: false, // Генерируется автоматически
  unique: true,
  trim: true,
  lowercase: true,
  match: /^msg_[a-z0-9]{20}$/,
  index: true,
  default: generateMessageId
}
```

### Indexes
Для обоих полей создаются уникальные индексы:

```javascript
dialogSchema.index({ dialogId: 1 }, { unique: true });
messageSchema.index({ messageId: 1 }, { unique: true });
```

## Usage

### Creating Documents

При создании документов ID генерируются автоматически:

```javascript
// Dialog
const dialog = await Dialog.create({
  tenantId: 'tnt_default',
  name: 'My Dialog',
  createdBy: 'user123'
});

console.log(dialog.dialogId); // dlg_3k7m9q2w5x8n1p4r6t9y
console.log(dialog._id);      // 6909c3b3104ed448215f85ac

// Message
const message = await Message.create({
  tenantId: 'tnt_default',
  dialogId: dialog._id,
  senderId: 'user123',
  content: 'Hello!',
  type: 'text'
});

console.log(message.messageId); // msg_7a2b9c4d8e1f5g3h6j0k
console.log(message._id);       // 6909c3b4104ed448215f85ad
```

### Querying by Custom ID

Вы можете использовать кастомные ID для поиска:

```javascript
// Find dialog by dialogId
const dialog = await Dialog.findOne({ dialogId: 'dlg_3k7m9q2w5x8n1p4r6t9y' });

// Find message by messageId
const message = await Message.findOne({ messageId: 'msg_7a2b9c4d8e1f5g3h6j0k' });
```

### API Usage

В API можно использовать как `_id`, так и кастомные ID:

```javascript
// Using MongoDB _id
GET /api/dialogs/6909c3b3104ed448215f85ac

// Using dialogId
GET /api/dialogs/dlg_3k7m9q2w5x8n1p4r6t9y

// Using messageId
GET /api/messages/msg_7a2b9c4d8e1f5g3h6j0k
```

## Benefits

1. **Human-readable**: Легко определить тип сущности по префиксу
2. **URL-safe**: Содержат только безопасные символы
3. **Fixed length**: Предсказуемая длина облегчает валидацию
4. **Unique**: Гарантированная уникальность через индексы
5. **Lowercase**: Избегаем проблем с регистром

## Migration

Для существующих данных без кастомных ID:

```javascript
// Массовая генерация dialogId для существующих записей
const dialogsWithoutId = await Dialog.find({ dialogId: { $exists: false } });
for (const dialog of dialogsWithoutId) {
  dialog.dialogId = generateDialogId();
  await dialog.save();
}

// Массовая генерация messageId для существующих записей
const messagesWithoutId = await Message.find({ messageId: { $exists: false } });
for (const message of messagesWithoutId) {
  message.messageId = generateMessageId();
  await message.save();
}
```

## Validation

При попытке вставить некорректный ID формат, Mongoose вернет ошибку:

```javascript
const dialog = new Dialog({
  dialogId: 'invalid_id', // ❌ Не соответствует regex
  tenantId: 'tnt_default',
  name: 'Test',
  createdBy: 'user'
});

await dialog.save();
// => ValidationError: dialogId: Path `dialogId` is invalid (invalid_id).
```

## Performance

- Индексы на `dialogId` и `messageId` обеспечивают быстрый поиск O(log n)
- Уникальные индексы предотвращают дубликаты на уровне базы данных
- Кастомные ID имеют фиксированную длину, что улучшает производительность индексов

## Security

- ID генерируются случайным образом из набора 36 символов (26 букв + 10 цифр)
- Вероятность коллизии: 36^20 ≈ 1.3 × 10^31 возможных комбинаций
- Невозможность предсказания следующего ID (в отличие от автоинкремента)


