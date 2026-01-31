[**@chat3/user-grpc-client-ts v0.0.26**](../README.md)

***

[@chat3/user-grpc-client-ts](../globals.md) / SendMessageOptions

# Interface: SendMessageOptions

Defined in: [Chat3GrpcClient.ts:59](https://github.com/antirek/chat3/blob/main/packages/user-grpc-client-ts/src/Chat3GrpcClient.ts#L59)

Опции для отправки сообщения

## Properties

### content

> **content**: `string`

Defined in: [Chat3GrpcClient.ts:61](https://github.com/antirek/chat3/blob/main/packages/user-grpc-client-ts/src/Chat3GrpcClient.ts#L61)

Содержимое сообщения

***

### idempotencyKey?

> `optional` **idempotencyKey**: `string`

Defined in: [Chat3GrpcClient.ts:67](https://github.com/antirek/chat3/blob/main/packages/user-grpc-client-ts/src/Chat3GrpcClient.ts#L67)

Ключ идемпотентности для предотвращения дублирования сообщений

***

### meta?

> `optional` **meta**: `Record`\<`string`, `any`\>

Defined in: [Chat3GrpcClient.ts:65](https://github.com/antirek/chat3/blob/main/packages/user-grpc-client-ts/src/Chat3GrpcClient.ts#L65)

Метаданные сообщения (произвольный объект)

***

### type?

> `optional` **type**: `string`

Defined in: [Chat3GrpcClient.ts:63](https://github.com/antirek/chat3/blob/main/packages/user-grpc-client-ts/src/Chat3GrpcClient.ts#L63)

Тип сообщения (по умолчанию: `internal.text`)
