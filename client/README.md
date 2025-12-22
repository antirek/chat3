# @chat3/client

JavaScript клиент для Chat3 Tenant API.

## Установка

```bash
npm install @chat3/client
```

## Использование

```javascript
const { Chat3Client } = require('@chat3/client');

// Инициализация клиента
const client = new Chat3Client({
  baseURL: 'http://localhost:3000/api',
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
  baseURL: 'http://localhost:3000/api',  // Базовый URL API
  apiKey: 'your-api-key-here',            // API ключ для аутентификации
  tenantId: 'tnt_default',                // ID тенанта (опционально)
  debug: false                             // Включить логирование (опционально)
});
```

**Параметры:**
- `baseURL` (обязательно) - Базовый URL Tenant API (например, `http://localhost:3000/api`)
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
- `setMeta(entityType, entityId, key, data, options)` - Установить мета-тег
- `deleteMeta(entityType, entityId, key, params)` - Удалить мета-тег

### Typing
- `sendTypingSignal(dialogId, userId)` - Отправить индикатор печати

## Лицензия

ISC

