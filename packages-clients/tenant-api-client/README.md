# @chat3/tenant-api-client

JavaScript клиент для Chat3 Tenant API.

## Установка

```bash
npm install @chat3/tenant-api-client
```

## Использование

```javascript
const { Chat3Client } = require('@chat3/tenant-api-client');

// Инициализация клиента
const client = new Chat3Client({
  baseURL: 'http://localhost:3000',  // Без /api, префикс добавляется автоматически
  apiKey: 'your-api-key-here',
  tenantId: 'tnt_default', // Опционально, по умолчанию tnt_default
  debug: false // Опционально, включает логирование запросов
});

// Получение диалогов
const dialogs = await client.getDialogs();

// Создание диалога
const dialog = await client.createDialog({
  name: 'VIP чат',
  createdBy: 'carl',
  members: [
    { userId: 'carl', type: 'user', name: 'Carl Johnson' }
  ]
});

// Получение сообщений
const messages = await client.getDialogMessages(dialogId);

// Создание сообщения
const message = await client.createMessage(dialogId, {
  senderId: 'carl',
  content: 'Hello!',
  type: 'internal.text'
});
```

## Конфигурация

Клиент настраивается через параметры конструктора:

```javascript
const client = new Chat3Client({
  baseURL: 'http://localhost:3000',  // Без /api, префикс добавляется автоматически
  apiKey: 'your-api-key-here',            // API ключ для аутентификации
  tenantId: 'tnt_default',                // ID тенанта (опционально)
  debug: false                             // Включить логирование (опционально)
});
```

**Параметры:**
- `baseURL` (обязательно) - Базовый URL Tenant API (например, `http://localhost:3000`). Все endpoints автоматически получают префикс `/api`.
- `apiKey` (обязательно) - API ключ для аутентификации
- `tenantId` (опционально) - ID тенанта, по умолчанию `tnt_default`
- `debug` (опционально) - Включить логирование HTTP запросов через `axios-logger`

## API

### Tenants
- `getTenants(params)` - Получить все тенанты
- `getTenant(tenantId)` - Получить тенант по ID
- `createTenant(data)` - Создать тенант
- `deleteTenant(tenantId)` - Удалить тенант

### Dialogs
- `getDialogs(params)` - Получить все диалоги
- `createDialog(data)` - Создать диалог
- `getDialog(dialogId, params)` - Получить диалог по ID
- `getDialogMembers(dialogId, params)` - Получить участников диалога
- `deleteDialog(dialogId)` - Удалить диалог
- `getUserDialogs(userId, params)` - Получить диалоги пользователя

### Messages
- `getDialogMessages(dialogId, params)` - Получить сообщения диалога
- `getUserDialogMessages(userId, dialogId, params)` - Получить сообщения в контексте пользователя
- `createMessage(dialogId, data)` - Создать сообщение
- `getMessage(messageId)` - Получить сообщение по ID
- `getUserMessage(userId, dialogId, messageId)` - Получить сообщение в контексте пользователя
- `updateMessage(messageId, data)` - Обновить сообщение
- `patchMessageDeleted(messageId, { deleted, deletedBy? })` - Soft-delete / undelete сообщения
- `getMessages(params)` - Получить все сообщения

### Dialog Members
- `addDialogMember(dialogId, userId, options)` - Добавить участника
- `removeDialogMember(dialogId, userId)` - Удалить участника
- `updateDialogMemberUnread(dialogId, userId, data)` - Обновить счетчик непрочитанных

### Message Status
- `updateMessageStatusInContext(userId, dialogId, messageId, status)` - Обновить статус сообщения
- `getMessageStatuses(userId, dialogId, messageId, params)` - Получить историю статусов

### Reactions
- `getMessageReactionsInContext(userId, dialogId, messageId)` - Получить реакции на сообщение
- `setReaction(userId, dialogId, messageId, action, reaction)` - Установить/снять реакцию
  - `action`: 'set' или 'unset'
  - `reaction`: эмодзи или текст реакции (например, '👍', '❤️')

### Users
- `getUsers(params)` - Получить всех пользователей
- `createUser(userId, data)` - Создать пользователя
- `getUser(userId)` - Получить пользователя по ID
- `updateUser(userId, data)` - Обновить пользователя
- `deleteUser(userId)` - Удалить пользователя

### Meta
- `getMeta(entityType, entityId, key, params)` - Получить мета-тег
- `setMeta(entityType, entityId, key, value, options)` - Установить мета-тег
  - `value` - значение мета-тега (string, number, boolean, object, array)
  - `options.dataType` - тип данных: 'string', 'number', 'boolean', 'object', 'array' (по умолчанию 'string')
- `deleteMeta(entityType, entityId, key, params)` - Удалить мета-тег

### Typing
- `sendTypingSignal(dialogId, userId)` - Отправить индикатор печати

## Тестирование

### Unit тесты

```bash
npm test
```

Тесты используют моки и не требуют запуска реального API.

### Интеграционные тесты

Интеграционные тесты могут работать в двух режимах:

#### Режим 1: Тестовый сервер (по умолчанию) ⭐

По умолчанию интеграционные тесты используют встроенный тестовый сервер с `mongodb-memory-server` и `@onify/fake-amqplib`. Это означает, что **не требуется запущенный API сервер** - все работает изолированно.

Просто запустите:
```bash
npm test -- Chat3Client.integration.test.js
```

Тестовый сервер автоматически:
- ✅ Запускается на случайном порту
- ✅ Использует in-memory MongoDB
- ✅ Использует fake RabbitMQ
- ✅ Создает тестовый tenant и API ключ
- ✅ Останавливается после завершения тестов

#### Режим 2: Реальный API сервер

Если вы хотите протестировать клиент против реального запущенного API:

1. Запустите Tenant API:
   ```bash
   # В корне проекта
   npm run start:tenant-api
   ```

2. Сгенерируйте API ключ:
   ```bash
   # В корне проекта
   npm run generate-key
   ```

3. Установите переменные окружения:
   ```bash
   export USE_REAL_API=true
   export CHAT3_API_KEY=your-api-key-here
   export CHAT3_BASE_URL=http://localhost:3000
   export CHAT3_TENANT_ID=tnt_default
   ```

4. Запустите интеграционные тесты:
   ```bash
   npm test -- Chat3Client.integration.test.js
   ```

#### Автоматический запуск с реальным API (скрипт)

Скрипт автоматически запустит API, сгенерирует ключ и протестирует клиент:

```bash
# В директории client
./test-with-api.sh
```

Скрипт выполнит:
1. ✅ Проверку зависимостей и сервисов (MongoDB, RabbitMQ)
2. ✅ Генерацию API ключа
3. ✅ Запуск tenant-api в фоне
4. ✅ Ожидание готовности API
5. ✅ Запуск интеграционных тестов
6. ✅ Автоматическую очистку при завершении

#### Ручной запуск с реальным API

Для ручной проверки:

1. Запустите tenant-api:
   ```bash
   # В корне проекта
   npm run start:tenant-api
   ```

2. Сгенерируйте API ключ:
   ```bash
   # В корне проекта
   npm run generate-key
   ```

3. Запустите тестовый скрипт:
   ```bash
   # В директории client
   CHAT3_API_KEY=your-api-key node test-integration.js
   ```

Или с переменными окружения:
```bash
CHAT3_API_KEY=your-key \
CHAT3_BASE_URL=http://localhost:3000 \
CHAT3_TENANT_ID=tnt_default \
node test-integration.js
```

## Лицензия

ISC

