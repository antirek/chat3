[**@chat3/user-grpc-client-ts v0.0.26**](../README.md)

***

[@chat3/user-grpc-client-ts](../globals.md) / Chat3GrpcClient

# Class: Chat3GrpcClient

Defined in: [Chat3GrpcClient.ts:102](https://github.com/antirek/chat3/blob/main/packages/user-grpc-client-ts/src/Chat3GrpcClient.ts#L102)

TypeScript клиент для Chat3 gRPC User Service

Предоставляет удобный интерфейс для работы с gRPC сервисом пользователей Chat3.
Поддерживает получение диалогов, сообщений, отправку сообщений и подписку на обновления.

## Example

```typescript
const client = new Chat3GrpcClient({
  url: 'localhost:50051',
  apiKey: 'your-api-key',
  tenantId: 'tnt_default',
  userId: 'user_123'
});

const dialogs = await client.getUserDialogs({ page: 1, limit: 10 });
```

## Constructors

### Constructor

> **new Chat3GrpcClient**(`options`): `Chat3GrpcClient`

Defined in: [Chat3GrpcClient.ts:111](https://github.com/antirek/chat3/blob/main/packages/user-grpc-client-ts/src/Chat3GrpcClient.ts#L111)

Создает новый экземпляр клиента Chat3 gRPC

#### Parameters

##### options

[`Chat3GrpcClientOptions`](../interfaces/Chat3GrpcClientOptions.md)

Опции для создания клиента

#### Returns

`Chat3GrpcClient`

## Methods

### getDialogMessages()

> **getDialogMessages**(`dialogId`, `options`): `Promise`\<`any`\>

Defined in: [Chat3GrpcClient.ts:187](https://github.com/antirek/chat3/blob/main/packages/user-grpc-client-ts/src/Chat3GrpcClient.ts#L187)

Получить сообщения диалога

Выполняет запрос к gRPC серверу для получения списка сообщений указанного диалога
с поддержкой пагинации, фильтрации и сортировки.

#### Parameters

##### dialogId

`string`

ID диалога, сообщения которого нужно получить

##### options

[`GetDialogMessagesOptions`](../interfaces/GetDialogMessagesOptions.md) = `{}`

Опции для получения сообщений

#### Returns

`Promise`\<`any`\>

Промис с ответом, содержащим массив сообщений и информацию о пагинации

#### Example

```typescript
const response = await client.getDialogMessages('dlg_abc123', {
  page: 1,
  limit: 50,
  sort: '{"created_at": -1}'
});
console.log(response.messages); // Массив сообщений
```

***

### getUserDialogs()

> **getUserDialogs**(`options`): `Promise`\<`any`\>

Defined in: [Chat3GrpcClient.ts:145](https://github.com/antirek/chat3/blob/main/packages/user-grpc-client-ts/src/Chat3GrpcClient.ts#L145)

Получить диалоги пользователя

Выполняет запрос к gRPC серверу для получения списка диалогов пользователя
с поддержкой пагинации, фильтрации и сортировки.

#### Parameters

##### options

[`GetUserDialogsOptions`](../interfaces/GetUserDialogsOptions.md) = `{}`

Опции для получения диалогов

#### Returns

`Promise`\<`any`\>

Промис с ответом, содержащим массив диалогов и информацию о пагинации

#### Example

```typescript
const response = await client.getUserDialogs({
  page: 1,
  limit: 20,
  includeLastMessage: true,
  filter: '(tenantId,eq,tnt_default)'
});
console.log(response.dialogs); // Массив диалогов
console.log(response.pagination); // Информация о пагинации
```

***

### sendMessage()

> **sendMessage**(`dialogId`, `senderId`, `options`): `Promise`\<`any`\>

Defined in: [Chat3GrpcClient.ts:234](https://github.com/antirek/chat3/blob/main/packages/user-grpc-client-ts/src/Chat3GrpcClient.ts#L234)

Отправить сообщение в диалог

Выполняет запрос к gRPC серверу для отправки нового сообщения в указанный диалог.
Поддерживает различные типы сообщений и метаданные.

#### Parameters

##### dialogId

`string`

ID диалога, в который отправляется сообщение

##### senderId

`string`

ID пользователя-отправителя

##### options

[`SendMessageOptions`](../interfaces/SendMessageOptions.md)

Опции для отправки сообщения (содержимое, тип, метаданные)

#### Returns

`Promise`\<`any`\>

Промис с ответом, содержащим созданное сообщение

#### Example

```typescript
const response = await client.sendMessage('dlg_abc123', 'user_123', {
  content: 'Hello, world!',
  type: 'internal.text',
  meta: { channel: 'whatsapp', priority: 'high' },
  idempotencyKey: 'msg_unique_key_123'
});
console.log(response.message); // Созданное сообщение
```

***

### subscribeUpdates()

> **subscribeUpdates**(`callback`): () => `void`

Defined in: [Chat3GrpcClient.ts:290](https://github.com/antirek/chat3/blob/main/packages/user-grpc-client-ts/src/Chat3GrpcClient.ts#L290)

Подписаться на обновления в реальном времени (server streaming)

Создает server streaming соединение с gRPC сервером для получения обновлений
в реальном времени (новые сообщения, изменения статусов и т.д.).

Первое сообщение в потоке содержит `event_type="connection.established"` и `conn_id`
в поле `data`, который можно использовать для идентификации соединения.

#### Parameters

##### callback

(`update`) => `void`

Функция-обработчик, вызываемая при получении каждого обновления

#### Returns

Функция для отмены подписки и закрытия потока

> (): `void`

##### Returns

`void`

#### Example

```typescript
const unsubscribe = client.subscribeUpdates((update) => {
  if (update.event_type === 'connection.established') {
    console.log('Connected with connId:', update.data.conn_id);
  } else if (update.event_type === 'message.created') {
    console.log('New message:', update.data);
  }
});

// Позже отменить подписку
unsubscribe();
```
