**@chat3/user-grpc-client-ts v0.0.26**

***

# @chat3/user-grpc-client-ts

TypeScript клиент для Chat3 gRPC User Service

## Установка

```bash
npm install
npm run build
```

## Использование

```typescript
import { Chat3GrpcClient } from '@chat3/user-grpc-client-ts';

// Создание клиента
const client = new Chat3GrpcClient({
  url: 'localhost:50051',
  apiKey: 'your-api-key',
  tenantId: 'tnt_default',
  userId: 'user_123'
});

// Получение диалогов
const dialogsResponse = await client.getUserDialogs({
  page: 1,
  limit: 10,
  includeLastMessage: true
});
console.log('Dialogs:', dialogsResponse.dialogs);

// Получение сообщений диалога
const messagesResponse = await client.getDialogMessages('dlg_abc123', {
  page: 1,
  limit: 20
});
console.log('Messages:', messagesResponse.messages);

// Отправка сообщения
const messageResponse = await client.sendMessage('dlg_abc123', 'user_123', {
  content: 'Hello!',
  type: 'internal.text',
  meta: { channel: 'whatsapp' }
});
console.log('Sent message:', messageResponse.message);

// Подписка на обновления
const unsubscribe = client.subscribeUpdates((update) => {
  if (update.event_type === 'connection.established') {
    const connId = update.data?.conn_id;
    console.log('Connected with connId:', connId);
  } else {
    console.log('Update received:', update.event_type);
  }
});

// Отмена подписки
// unsubscribe();
```

## API

### constructor(options: Chat3GrpcClientOptions)

Создает новый клиент gRPC.

**Параметры:**
- `url` - URL gRPC сервера (например, `localhost:50051`)
- `apiKey` - API ключ для аутентификации
- `tenantId` - ID тенанта
- `userId` - ID пользователя

### getUserDialogs(options?: GetUserDialogsOptions): Promise<GetUserDialogsResponse>

Получить диалоги пользователя.

**Параметры:**
- `page` - номер страницы (по умолчанию 1)
- `limit` - количество элементов (по умолчанию 10)
- `filter` - фильтр в формате операторов
- `sort` - сортировка в формате JSON
- `includeLastMessage` - включить последнее сообщение

### getDialogMessages(dialogId: string, options?: GetDialogMessagesOptions): Promise<GetDialogMessagesResponse>

Получить сообщения диалога.

**Параметры:**
- `dialogId` - ID диалога
- `page` - номер страницы (по умолчанию 1)
- `limit` - количество элементов (по умолчанию 10)
- `filter` - фильтр
- `sort` - сортировка

### sendMessage(dialogId: string, senderId: string, options: SendMessageOptions): Promise<SendMessageResponse>

Отправить сообщение.

**Параметры:**
- `dialogId` - ID диалога
- `senderId` - ID отправителя
- `content` - содержимое сообщения
- `type` - тип сообщения (по умолчанию `internal.text`)
- `meta` - метаданные (объект)
- `idempotencyKey` - ключ идемпотентности (опционально)

### subscribeUpdates(callback: (update: Update) => void): () => void

Подписаться на обновления (server streaming).

**Параметры:**
- `callback` - функция обработки обновлений

**Возвращает:** функция для отмены подписки

**Примечание:** Первое сообщение содержит `eventType="connection.established"` и `connId` в `data`.

## Структура проекта

```
packages/user-grpc-client-ts/
# Proto файлы находятся в @chat3/user-grpc-proto (packages-shared/proto/)
├── src/
│   ├── Chat3GrpcClient.ts      # Основной клиент
│   └── index.ts                # Экспорты
├── package.json
└── tsconfig.json
```
