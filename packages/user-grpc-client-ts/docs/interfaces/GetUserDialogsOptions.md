[**@chat3/user-grpc-client-ts v0.0.26**](../README.md)

***

[@chat3/user-grpc-client-ts](../globals.md) / GetUserDialogsOptions

# Interface: GetUserDialogsOptions

Defined in: [Chat3GrpcClient.ts:29](https://github.com/antirek/chat3/blob/main/packages/user-grpc-client-ts/src/Chat3GrpcClient.ts#L29)

Опции для получения диалогов пользователя

## Properties

### filter?

> `optional` **filter**: `string`

Defined in: [Chat3GrpcClient.ts:35](https://github.com/antirek/chat3/blob/main/packages/user-grpc-client-ts/src/Chat3GrpcClient.ts#L35)

Фильтр в формате операторов (например, `(tenantId,eq,tnt_default)`)

***

### includeLastMessage?

> `optional` **includeLastMessage**: `boolean`

Defined in: [Chat3GrpcClient.ts:39](https://github.com/antirek/chat3/blob/main/packages/user-grpc-client-ts/src/Chat3GrpcClient.ts#L39)

Включить последнее сообщение в каждый диалог

***

### limit?

> `optional` **limit**: `number`

Defined in: [Chat3GrpcClient.ts:33](https://github.com/antirek/chat3/blob/main/packages/user-grpc-client-ts/src/Chat3GrpcClient.ts#L33)

Количество элементов на странице (по умолчанию: 10)

***

### page?

> `optional` **page**: `number`

Defined in: [Chat3GrpcClient.ts:31](https://github.com/antirek/chat3/blob/main/packages/user-grpc-client-ts/src/Chat3GrpcClient.ts#L31)

Номер страницы (по умолчанию: 1)

***

### sort?

> `optional` **sort**: `string`

Defined in: [Chat3GrpcClient.ts:37](https://github.com/antirek/chat3/blob/main/packages/user-grpc-client-ts/src/Chat3GrpcClient.ts#L37)

Сортировка в формате JSON (например, `{"created_at": -1}`)
