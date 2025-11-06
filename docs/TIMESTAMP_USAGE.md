# Использование высокоточных временных меток

## Обзор

Проект использует временные метки с точностью до **микросекунд** (10⁻⁶ секунды) для всех временных полей.

## Формат

- **Тип**: `Number` в MongoDB/Mongoose
- **Формат**: Миллисекунды Unix timestamp с 6 знаками после запятой
- **Пример**: `1730891234567.123456`
  - `1730891234567` - миллисекунды
  - `.123456` - микросекунды

## Использование в моделях

### Вариант 1: Замена существующего Date поля

```javascript
import { generateTimestamp } from '../utils/timestampUtils.js';

const schema = new mongoose.Schema({
  name: String,
  
  // СТАРЫЙ СПОСОБ (Date)
  // createdAt: {
  //   type: Date,
  //   default: Date.now
  // }
  
  // НОВЫЙ СПОСОБ (Number с микросекундами)
  createdAt: {
    type: Number,
    default: generateTimestamp,
    description: 'Timestamp в миллисекундах с точностью до микросекунд'
  },
  
  updatedAt: {
    type: Number,
    default: generateTimestamp
  }
});
```

### Вариант 2: Добавление нового поля с сохранением старого

```javascript
const schema = new mongoose.Schema({
  name: String,
  
  // Старое поле для совместимости
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  // Новое высокоточное поле
  createdAtPrecise: {
    type: Number,
    default: generateTimestamp
  }
});
```

### Вариант 3: Pre-save hook для автоматического обновления

```javascript
import { generateTimestamp } from '../utils/timestampUtils.js';

const schema = new mongoose.Schema({
  name: String,
  createdAt: Number,
  updatedAt: Number
});

// Автоматически устанавливаем timestamp при создании и обновлении
schema.pre('save', function(next) {
  const now = generateTimestamp();
  
  if (this.isNew) {
    this.createdAt = now;
  }
  this.updatedAt = now;
  next();
});
```

## Использование в контроллерах

### Форматирование для API ответов

```javascript
import { formatTimestamp } from '../utils/timestampUtils.js';

// В контроллере
const message = await Message.findOne({ messageId });

const response = {
  data: {
    messageId: message.messageId,
    content: message.content,
    createdAt: message.createdAt, // Точный timestamp
    createdAtFormatted: formatTimestamp(message.createdAt, 'full'), // 06.11.2024, 15:30:45.123456
    createdAtISO: formatTimestamp(message.createdAt, 'iso'), // 2024-11-06T15:30:45.123456Z
    createdAtRelative: formatTimestamp(message.createdAt, 'relative') // 5 мин. назад
  }
};
```

### Форматы отображения

```javascript
const timestamp = generateTimestamp();

// Полный формат с микросекундами
formatTimestamp(timestamp, 'full')
// → "06.11.2024, 15:30:45.123456"

// Только дата
formatTimestamp(timestamp, 'date')
// → "06.11.2024"

// Только время
formatTimestamp(timestamp, 'time')
// → "15:30:45.123456"

// Дата и время без микросекунд
formatTimestamp(timestamp, 'datetime')
// → "06.11.2024, 15:30:45"

// ISO 8601 с микросекундами
formatTimestamp(timestamp, 'iso')
// → "2024-11-06T15:30:45.123456Z"

// Относительное время
formatTimestamp(timestamp, 'relative')
// → "5 мин. назад"
```

## Виртуальные поля для форматирования

```javascript
import { formatTimestamp } from '../utils/timestampUtils.js';

const schema = new mongoose.Schema({
  name: String,
  createdAt: {
    type: Number,
    default: generateTimestamp
  }
});

// Добавляем виртуальные поля для удобного форматирования
schema.virtual('createdAtFormatted').get(function() {
  return formatTimestamp(this.createdAt, 'full');
});

schema.virtual('createdAtRelative').get(function() {
  return formatTimestamp(this.createdAt, 'relative');
});

// Включаем виртуальные поля в JSON
schema.set('toJSON', { virtuals: true });
schema.set('toObject', { virtuals: true });
```

## Миграция существующих данных

### Скрипт миграции

```javascript
import { Dialog, Message, Event } from './models/index.js';

async function migrateTimestamps() {
  // Миграция диалогов
  const dialogs = await Dialog.find({});
  for (const dialog of dialogs) {
    if (!dialog.createdAtPrecise && dialog.createdAt) {
      dialog.createdAtPrecise = dialog.createdAt.getTime();
      await dialog.save();
    }
  }
  
  console.log(`Migrated ${dialogs.length} dialogs`);
  
  // Аналогично для других моделей
}
```

## Преимущества

1. **Высокая точность**: До микросекунд (10⁻⁶ сек)
2. **Одно поле**: Хранится как обычный Number в MongoDB
3. **Совместимость**: Легко конвертируется в Date: `new Date(Math.floor(timestamp))`
4. **Сортировка**: Работает как обычное число
5. **Читаемость**: Функции форматирования для различных представлений
6. **Производительность**: Number быстрее в операциях сравнения

## Технические детали

### Точность

- JavaScript Number: 64-bit IEEE 754 double precision
- Точность: ~15-17 значащих десятичных цифр
- Timestamp 2024 года: ~13 цифр целой части + 6 цифр дробной = 19 цифр всего
- **Безопасно**: Умещается в `Number.MAX_SAFE_INTEGER`

### Генерация

```javascript
// Использует process.hrtime.bigint() для получения наносекунд
const hrTime = process.hrtime.bigint();
const milliseconds = Number(hrTime) / 1_000_000;
// Результат: 1730891234567.123456
```

### Хранение в MongoDB

MongoDB хранит Number как BSON Double (64-bit), что полностью совместимо с JavaScript Number.

## Примеры запросов

```javascript
// Поиск по диапазону времени
const startTime = generateTimestamp() - 3600000; // 1 час назад
const endTime = generateTimestamp();

const messages = await Message.find({
  createdAt: {
    $gte: startTime,
    $lte: endTime
  }
});

// Сортировка по времени (работает как обычное число)
const sorted = await Message.find({})
  .sort({ createdAt: -1 }); // Сначала новые
```

## API Endpoints

При возврате данных из API можно включать разные форматы:

```json
{
  "data": {
    "messageId": "msg_abc123",
    "content": "Hello",
    "createdAt": 1730891234567.123456,
    "createdAtFormatted": "06.11.2024, 15:30:45.123456",
    "createdAtISO": "2024-11-06T15:30:45.123456Z",
    "createdAtRelative": "5 мин. назад"
  }
}
```

