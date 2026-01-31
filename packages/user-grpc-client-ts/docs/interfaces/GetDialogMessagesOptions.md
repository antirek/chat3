[**@chat3/user-grpc-client-ts v0.0.26**](../README.md)

***

[@chat3/user-grpc-client-ts](../globals.md) / GetDialogMessagesOptions

# Interface: GetDialogMessagesOptions

Defined in: [Chat3GrpcClient.ts:45](https://github.com/antirek/chat3/blob/main/packages/user-grpc-client-ts/src/Chat3GrpcClient.ts#L45)

Опции для получения сообщений диалога

## Properties

### filter?

> `optional` **filter**: `string`

Defined in: [Chat3GrpcClient.ts:51](https://github.com/antirek/chat3/blob/main/packages/user-grpc-client-ts/src/Chat3GrpcClient.ts#L51)

Фильтр в формате операторов

***

### limit?

> `optional` **limit**: `number`

Defined in: [Chat3GrpcClient.ts:49](https://github.com/antirek/chat3/blob/main/packages/user-grpc-client-ts/src/Chat3GrpcClient.ts#L49)

Количество элементов на странице (по умолчанию: 10)

***

### page?

> `optional` **page**: `number`

Defined in: [Chat3GrpcClient.ts:47](https://github.com/antirek/chat3/blob/main/packages/user-grpc-client-ts/src/Chat3GrpcClient.ts#L47)

Номер страницы (по умолчанию: 1)

***

### sort?

> `optional` **sort**: `string`

Defined in: [Chat3GrpcClient.ts:53](https://github.com/antirek/chat3/blob/main/packages/user-grpc-client-ts/src/Chat3GrpcClient.ts#L53)

Сортировка в формате JSON
