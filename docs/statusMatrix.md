# statusMessageMatrix - Матрица статусов сообщения

## Обзор

`statusMessageMatrix` — агрегированная матрица **текущих** статусов получателей сообщения: для каждого `userId` берётся последняя запись в `MessageStatus` (по `createdAt`), затем считается число получателей по паре `userType` + `status`. Статусы отправителя исключаются.

## Назначение

`statusMessageMatrix` используется для:
- Отображения статистики статусов сообщения для всех получателей (исключая отправителя)
- Определения, сколько получателей каждого типа сейчас в каждом статусе
- Визуализации матрицы статусов в UI (например, в модальном окне)
- Обеспечения единообразия матрицы для всех участников диалога

## Структура данных

### Формат ответа

`statusMessageMatrix` — это массив объектов следующей структуры:

```javascript
[
  {
    userType: "user",      // Тип пользователя (user, bot, contact и т.д.) или null
    status: "read",        // Статус сообщения (unread, delivered, read)
    count: 3              // Количество записей в истории с этим статусом
  },
  {
    userType: "user",
    status: "delivered",
    count: 2
  },
  {
    userType: "bot",
    status: "read",
    count: 1
  }
]
```

### Поля

- **`userType`** (string | null) — тип пользователя:
  - `"user"` — обычный пользователь
  - `"bot"` — бот
  - `"contact"` — контакт
  - `null` — тип не определен
- **`status`** (string) — статус сообщения:
  - `"unread"` — непрочитано
  - `"delivered"` — доставлено
  - `"read"` — прочитано
- **`count`** (number) — число получателей данного `userType` с текущим статусом `status`

## Как работает

### Алгоритм формирования

Функция `buildStatusMessageMatrix` использует MongoDB aggregation pipeline:

1. **Фильтрация** (`$match`):
   - Выбирает все записи `MessageStatus` для указанного сообщения
   - Исключает статусы отправителя сообщения (`userId: { $ne: senderId }`)

2. **Последний статус на получателя** (`$sort` + `$group` по `userId`):
   - Берётся последняя запись `MessageStatus` для каждого получателя

3. **Группировка** (`$group`):
   - Группирует получателей по комбинации `userType` и `status`
   - Считает число получателей в каждой группе (`count: { $sum: 1 }`)

4. **Проекция** (`$project`):
   - Формирует финальную структуру объекта
   - Убирает служебное поле `_id`

5. **Сортировка** (`$sort`):
   - Сортирует по `userType` (по возрастанию)
   - Затем по `status` (по возрастанию)

### Важные особенности

#### Текущий статус, не история

**ВАЖНО**: в матрице учитывается только **последний** статус каждого получателя.

Если пользователь прошёл `unread` → `delivered` → `read`, в матрице будет одна строка:
`{ userType: "user", status: "read", count: 1 }`.

Полная история по-прежнему хранится в коллекции `MessageStatus`.

#### Исключение отправителя сообщения

Статусы отправителя сообщения **всегда исключаются** из матрицы. Это сделано для того, чтобы:
- Показывать статусы всех получателей сообщения
- Обеспечить единообразие матрицы для всех участников диалога (матрица одинакова для всех)
- Отправитель видит, кто получил/прочитал его сообщение
- Получатели видят статусы других получателей (но не отправителя)
- В групповых чатах корректно отображается количество прочитавших (например, `read=2` означает, что 2 получателя прочитали сообщение)

**Пример для группового чата:**
- Группа: alice, bob, charlie, diana (4 участника)
- alice отправила сообщение
- bob и charlie прочитали (read)
- diana не прочитала (unread)

Матрица для всех участников будет одинаковой:
```javascript
[
  { userType: "user", status: "read", count: 2 },    // bob и charlie
  { userType: "user", status: "unread", count: 1 }    // diana
]
```

Статусы alice (отправителя) исключены, так как отправитель обычно не имеет статуса доставки/прочтения для своего сообщения.

## Использование в API

### Endpoints

`statusMessageMatrix` возвращается в следующих endpoints:

1. **`GET /api/users/:userId/dialogs/:dialogId/messages`**
   - Возвращает список сообщений с `statusMessageMatrix` для каждого сообщения
   - Исключает статусы пользователя `userId`

2. **`GET /api/users/:userId/dialogs/:dialogId/messages/:messageId`**
   - Возвращает одно сообщение с `statusMessageMatrix`
   - Исключает статусы пользователя `userId`

### Пример ответа

```json
{
  "data": [
    {
      "messageId": "msg_abc123",
      "content": "Привет!",
      "senderId": "alice",
      "statusMessageMatrix": [
        {
          "userType": "user",
          "status": "read",
          "count": 3
        },
        {
          "userType": "user",
          "status": "delivered",
          "count": 1
        },
        {
          "userType": "bot",
          "status": "read",
          "count": 1
        }
      ]
    }
  ]
}
```

## Примеры использования

### Определение, прочитано ли сообщение получателями

```javascript
const statusMatrix = message.statusMessageMatrix || [];

// Ищем запись с userType='user' и status='read' с count >= 1
const readStatus = statusMatrix.find(
  item => item.userType === 'user' && item.status === 'read' && item.count >= 1
);

if (readStatus) {
  console.log(`Сообщение прочитано ${readStatus.count} получателем(ями) типа "user"`);
}
```

### Подсчет общего количества прочитанных сообщений

```javascript
const statusMatrix = message.statusMessageMatrix || [];

// Суммируем все записи со статусом "read"
const totalReadCount = statusMatrix
  .filter(item => item.status === 'read')
  .reduce((sum, item) => sum + item.count, 0);

console.log(`Всего прочитано: ${totalReadCount} раз(а)`);
```

### Анализ по типам пользователей

```javascript
const statusMatrix = message.statusMessageMatrix || [];

// Группируем по типам пользователей
const byUserType = statusMatrix.reduce((acc, item) => {
  const type = item.userType || 'unknown';
  if (!acc[type]) acc[type] = {};
  acc[type][item.status] = item.count;
  return acc;
}, {});

console.log('Статистика по типам:', byUserType);
// {
//   user: { read: 3, delivered: 1 },
//   bot: { read: 1 }
// }
```

## Отличия от других полей

### statusMessageMatrix vs statuses

- **`statusMessageMatrix`** — агрегированная матрица статусов **всех получателей** (исключая отправителя)
- **`statuses`** (устаревшее) — массив всех статусов сообщения, включая статусы всех пользователей

### statusMessageMatrix vs reactionSet

- **`statusMessageMatrix`** — информация о статусах доставки/прочтения сообщения
- **`reactionSet`** — информация о реакциях (эмодзи) на сообщение

## Валидация

Структура `statusMessageMatrix` валидируется в `responseSchemas.js`:

- Должен присутствовать в ответе
- Должен быть массивом
- Каждый элемент должен содержать:
  - `userType` (string | null)
  - `status` (string)
  - `count` (number)

## Реализация

### Функция: `buildStatusMessageMatrix`

```javascript
export async function buildStatusMessageMatrix(tenantId, messageId, senderId) {
  return await MessageStatus.aggregate([
    {
      $match: {
        tenantId: tenantId,
        messageId: messageId,
        userId: { $ne: senderId } // Исключаем статусы отправителя сообщения
      }
    },
    {
      $group: {
        _id: {
          userType: { $ifNull: ['$userType', null] },
          status: '$status'
        },
        count: { $sum: 1 }
      }
    },
    {
      $project: {
        _id: 0,
        userType: '$_id.userType',
        status: '$_id.status',
        count: 1
      }
    },
    {
      $sort: {
        userType: 1,
        status: 1
      }
    }
  ]);
}
```

### Расположение

- **Функция**: `src/apps/tenant-api/utils/userDialogUtils.js`
- **Использование**: `src/apps/tenant-api/controllers/userDialogController.js`
- **Валидация**: `src/apps/tenant-api/validators/schemas/responseSchemas.js`

## UI интеграция

В тестовом интерфейсе `api-test-user-dialogs.html` есть модальное окно для просмотра матрицы статусов:

- Кнопка "📊 Матрица статусов" для каждого сообщения
- Модальное окно с таблицей статусов
- Отображение URL запроса для получения данных

## Примечания

1. **Производительность**: Aggregation pipeline оптимизирован для работы с большими объемами данных
2. **Индексы**: Используются индексы на `MessageStatus` для быстрого поиска:
   - `{ messageId, userId, createdAt: -1 }`
   - `{ tenantId, messageId, userId, createdAt: -1 }`
3. **Сортировка**: Результаты всегда отсортированы по `userType` и `status` для предсказуемости
4. **Null значения**: `userType` может быть `null`, если тип пользователя не определен

