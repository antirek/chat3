# Protocol Documentation
<a name="top"></a>

## Table of Contents

- [chat3_user.proto](#chat3_user-proto)
    - [AddDialogMembersRequest](#chat3-user-AddDialogMembersRequest)
    - [AddDialogMembersResponse](#chat3-user-AddDialogMembersResponse)
    - [CreateDialogRequest](#chat3-user-CreateDialogRequest)
    - [CreateDialogResponse](#chat3-user-CreateDialogResponse)
    - [Dialog](#chat3-user-Dialog)
    - [DialogInfo](#chat3-user-DialogInfo)
    - [DialogMember](#chat3-user-DialogMember)
    - [FindDialogByMetaRequest](#chat3-user-FindDialogByMetaRequest)
    - [FindDialogByMetaResponse](#chat3-user-FindDialogByMetaResponse)
    - [GetDialogMessagesRequest](#chat3-user-GetDialogMessagesRequest)
    - [GetDialogMessagesResponse](#chat3-user-GetDialogMessagesResponse)
    - [GetUserDialogsRequest](#chat3-user-GetUserDialogsRequest)
    - [GetUserDialogsResponse](#chat3-user-GetUserDialogsResponse)
    - [GetUserRequest](#chat3-user-GetUserRequest)
    - [GetUserResponse](#chat3-user-GetUserResponse)
    - [MarkDialogAllReadRequest](#chat3-user-MarkDialogAllReadRequest)
    - [MarkDialogAllReadResponse](#chat3-user-MarkDialogAllReadResponse)
    - [MemberState](#chat3-user-MemberState)
    - [Message](#chat3-user-Message)
    - [MessageStatus](#chat3-user-MessageStatus)
    - [Pagination](#chat3-user-Pagination)
    - [RemoveDialogMemberRequest](#chat3-user-RemoveDialogMemberRequest)
    - [RemoveDialogMemberResponse](#chat3-user-RemoveDialogMemberResponse)
    - [SendMessageRequest](#chat3-user-SendMessageRequest)
    - [SendMessageResponse](#chat3-user-SendMessageResponse)
    - [SendTypingIndicatorRequest](#chat3-user-SendTypingIndicatorRequest)
    - [SendTypingIndicatorResponse](#chat3-user-SendTypingIndicatorResponse)
    - [SenderInfo](#chat3-user-SenderInfo)
    - [SetMessageDeletedRequest](#chat3-user-SetMessageDeletedRequest)
    - [SetMessageDeletedResponse](#chat3-user-SetMessageDeletedResponse)
    - [SetMessageReactionRequest](#chat3-user-SetMessageReactionRequest)
    - [SetMessageReactionResponse](#chat3-user-SetMessageReactionResponse)
    - [SetMessageStatusRequest](#chat3-user-SetMessageStatusRequest)
    - [SetMessageStatusResponse](#chat3-user-SetMessageStatusResponse)
    - [SubscribeUpdatesRequest](#chat3-user-SubscribeUpdatesRequest)
    - [Update](#chat3-user-Update)
    - [UpsertUserRequest](#chat3-user-UpsertUserRequest)
    - [UpsertUserResponse](#chat3-user-UpsertUserResponse)
    - [User](#chat3-user-User)
  
    - [Chat3UserService](#chat3-user-Chat3UserService)
  
- [Scalar Value Types](#scalar-value-types)



<a name="chat3_user-proto"></a>
<p align="right"><a href="#top">Top</a></p>

## chat3_user.proto



<a name="chat3-user-AddDialogMembersRequest"></a>

### AddDialogMembersRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user_id | [string](#string) |  | Actor операции. |
| dialog_id | [string](#string) |  |  |
| member_user_ids | [string](#string) | repeated | Кого добавить. |






<a name="chat3-user-AddDialogMembersResponse"></a>

### AddDialogMembersResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| dialog | [DialogInfo](#chat3-user-DialogInfo) |  |  |
| added_user_ids | [string](#string) | repeated | Фактически добавленные (без уже состоявших в dialog). |






<a name="chat3-user-CreateDialogRequest"></a>

### CreateDialogRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user_id | [string](#string) |  | Actor create; всегда добавляется в members. |
| member_user_ids | [string](#string) | repeated | Дополнительные участники (без дублей, без обязательности существования в Chat3 — обычно интегратор делает UpsertUser заранее). |
| meta | [google.protobuf.Struct](#google-protobuf-Struct) |  | Произвольная meta. Примеры интегратора: {type:group,title:...} или {type:dm,dmKey:...}. |






<a name="chat3-user-CreateDialogResponse"></a>

### CreateDialogResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| dialog | [DialogInfo](#chat3-user-DialogInfo) |  |  |
| created | [bool](#bool) |  | Для create всегда true (идемпотентность 1:1 делает интегратор через FindDialogByMeta). |






<a name="chat3-user-Dialog"></a>

### Dialog



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| dialog_id | [string](#string) |  |  |
| tenant_id | [string](#string) |  |  |
| name | [string](#string) |  |  |
| created_by | [string](#string) |  |  |
| created_at | [double](#double) |  |  |
| updated_at | [double](#double) |  |  |
| meta | [google.protobuf.Struct](#google-protobuf-Struct) |  | Opaque meta dialog (type, title, dmKey, … — на стороне интегратора). |
| member | [DialogMember](#chat3-user-DialogMember) |  | Контекст членства запрашивающего user_id (unread и т.п.). |
| last_message | [Message](#chat3-user-Message) |  | Последнее сообщение, если include_last_message=true. |






<a name="chat3-user-DialogInfo"></a>

### DialogInfo
Компактное представление dialog после create / find / members.


| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| dialog_id | [string](#string) |  |  |
| tenant_id | [string](#string) |  |  |
| created_at | [double](#double) |  |  |
| meta | [google.protobuf.Struct](#google-protobuf-Struct) |  | Opaque meta dialog. |
| member_user_ids | [string](#string) | repeated | Текущий список member user_id. |






<a name="chat3-user-DialogMember"></a>

### DialogMember



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user_id | [string](#string) |  |  |
| meta | [google.protobuf.Struct](#google-protobuf-Struct) |  |  |
| state | [MemberState](#chat3-user-MemberState) |  |  |






<a name="chat3-user-FindDialogByMetaRequest"></a>

### FindDialogByMetaRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user_id | [string](#string) |  | Опционально: если задан — dialog вернётся только если user member. |
| meta_key | [string](#string) |  | Ключ meta, напр. dmKey. |
| meta_value | [string](#string) |  | Точное значение meta, напр. alice:bob. |






<a name="chat3-user-FindDialogByMetaResponse"></a>

### FindDialogByMetaResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| found | [bool](#bool) |  | false — dialog с таким meta не найден (или нет членства). |
| dialog | [DialogInfo](#chat3-user-DialogInfo) |  | Заполняется только если found=true. |






<a name="chat3-user-GetDialogMessagesRequest"></a>

### GetDialogMessagesRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user_id | [string](#string) |  | Запрашивающий пользователь (проверка членства). |
| dialog_id | [string](#string) |  | Целевой dialog. |
| page | [int32](#int32) |  |  |
| limit | [int32](#int32) |  |  |
| filter | [string](#string) |  |  |
| sort | [string](#string) |  | Sort, напр. {&#34;createdAt&#34;:1} для хронологии. |






<a name="chat3-user-GetDialogMessagesResponse"></a>

### GetDialogMessagesResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| messages | [Message](#chat3-user-Message) | repeated |  |
| pagination | [Pagination](#chat3-user-Pagination) |  |  |






<a name="chat3-user-GetUserDialogsRequest"></a>

### GetUserDialogsRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user_id | [string](#string) |  | Пользователь, чьи dialogs вернуть. |
| page | [int32](#int32) |  | Номер страницы (с 1). |
| limit | [int32](#int32) |  | Размер страницы. |
| filter | [string](#string) |  | Filter expression (синтаксис как у Tenant API list dialogs). |
| sort | [string](#string) |  | Sort, обычно JSON, напр. {&#34;updatedAt&#34;:-1}. |
| include_last_message | [bool](#bool) |  | Если true — в каждый Dialog включить last_message. |






<a name="chat3-user-GetUserDialogsResponse"></a>

### GetUserDialogsResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| dialogs | [Dialog](#chat3-user-Dialog) | repeated |  |
| pagination | [Pagination](#chat3-user-Pagination) |  |  |






<a name="chat3-user-GetUserRequest"></a>

### GetUserRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user_id | [string](#string) |  |  |






<a name="chat3-user-GetUserResponse"></a>

### GetUserResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user | [User](#chat3-user-User) |  |  |






<a name="chat3-user-MarkDialogAllReadRequest"></a>

### MarkDialogAllReadRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user_id | [string](#string) |  |  |
| dialog_id | [string](#string) |  |  |






<a name="chat3-user-MarkDialogAllReadResponse"></a>

### MarkDialogAllReadResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| message | [string](#string) |  |  |
| dialog_id | [string](#string) |  |  |
| user_id | [string](#string) |  |  |






<a name="chat3-user-MemberState"></a>

### MemberState



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| unread_count | [int32](#int32) |  |  |
| last_seen_at | [double](#double) |  |  |
| last_message_at | [double](#double) |  |  |
| is_active | [bool](#bool) |  |  |






<a name="chat3-user-Message"></a>

### Message



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| message_id | [string](#string) |  |  |
| dialog_id | [string](#string) |  |  |
| sender_id | [string](#string) |  |  |
| type | [string](#string) |  | Тип, напр. internal.text. |
| content | [string](#string) |  |  |
| meta | [google.protobuf.Struct](#google-protobuf-Struct) |  |  |
| statuses | [MessageStatus](#chat3-user-MessageStatus) | repeated |  |
| reaction_set | [google.protobuf.Struct](#google-protobuf-Struct) |  |  |
| sender_info | [SenderInfo](#chat3-user-SenderInfo) |  |  |
| created_at | [double](#double) |  |  |
| topic_id | [string](#string) |  |  |
| topic | [google.protobuf.Struct](#google-protobuf-Struct) |  |  |
| deleted | [bool](#bool) |  | Soft-delete flag. |
| deleted_at | [double](#double) |  |  |
| deleted_by | [string](#string) |  |  |
| status_message_matrix | [google.protobuf.Struct](#google-protobuf-Struct) |  |  |
| edited | [bool](#bool) |  |  |
| edited_at | [double](#double) |  |  |
| edited_by | [string](#string) |  |  |






<a name="chat3-user-MessageStatus"></a>

### MessageStatus



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user_id | [string](#string) |  |  |
| status | [string](#string) |  | Значение статуса, напр. read / delivered. |
| read_at | [double](#double) |  |  |
| created_at | [double](#double) |  |  |






<a name="chat3-user-Pagination"></a>

### Pagination



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| page | [int32](#int32) |  |  |
| limit | [int32](#int32) |  |  |
| total | [int32](#int32) |  |  |
| pages | [int32](#int32) |  |  |






<a name="chat3-user-RemoveDialogMemberRequest"></a>

### RemoveDialogMemberRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user_id | [string](#string) |  | Actor операции. |
| dialog_id | [string](#string) |  |  |
| member_user_id | [string](#string) |  | Кого удалить. |






<a name="chat3-user-RemoveDialogMemberResponse"></a>

### RemoveDialogMemberResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| dialog | [DialogInfo](#chat3-user-DialogInfo) |  |  |






<a name="chat3-user-SendMessageRequest"></a>

### SendMessageRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user_id | [string](#string) |  | Отправитель (actor). |
| dialog_id | [string](#string) |  |  |
| content | [string](#string) |  | Текст / payload сообщения. |
| type | [string](#string) |  | Тип сообщения, напр. internal.text. |
| meta | [google.protobuf.Struct](#google-protobuf-Struct) |  | Произвольная meta сообщения. |
| idempotency_key | [string](#string) |  | Ключ идемпотентности (повтор с тем же ключом не создаст дубликат). |






<a name="chat3-user-SendMessageResponse"></a>

### SendMessageResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| message | [Message](#chat3-user-Message) |  |  |






<a name="chat3-user-SendTypingIndicatorRequest"></a>

### SendTypingIndicatorRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user_id | [string](#string) |  | Кто печатает (должен быть member dialog). |
| dialog_id | [string](#string) |  |  |






<a name="chat3-user-SendTypingIndicatorResponse"></a>

### SendTypingIndicatorResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| message | [string](#string) |  |  |
| dialog_id | [string](#string) |  |  |
| user_id | [string](#string) |  |  |
| expires_in_ms | [int32](#int32) |  | Через сколько мс индикатор истечёт на клиентах. |






<a name="chat3-user-SenderInfo"></a>

### SenderInfo



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user_id | [string](#string) |  |  |
| name | [string](#string) |  |  |
| created_at | [double](#double) |  |  |
| meta | [google.protobuf.Struct](#google-protobuf-Struct) |  |  |






<a name="chat3-user-SetMessageDeletedRequest"></a>

### SetMessageDeletedRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user_id | [string](#string) |  |  |
| message_id | [string](#string) |  |  |
| deleted | [bool](#bool) |  | true — пометить удалённым, false — восстановить. |
| deleted_by | [string](#string) |  | Кто удалил (обычно = user_id). |






<a name="chat3-user-SetMessageDeletedResponse"></a>

### SetMessageDeletedResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| message | [Message](#chat3-user-Message) |  |  |






<a name="chat3-user-SetMessageReactionRequest"></a>

### SetMessageReactionRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user_id | [string](#string) |  |  |
| dialog_id | [string](#string) |  |  |
| message_id | [string](#string) |  |  |
| reaction | [string](#string) |  | Код/emoji реакции. |
| set | [bool](#bool) |  | true — поставить, false — снять. |






<a name="chat3-user-SetMessageReactionResponse"></a>

### SetMessageReactionResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| message | [string](#string) |  |  |
| reaction_set | [google.protobuf.Struct](#google-protobuf-Struct) |  |  |






<a name="chat3-user-SetMessageStatusRequest"></a>

### SetMessageStatusRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user_id | [string](#string) |  |  |
| dialog_id | [string](#string) |  |  |
| message_id | [string](#string) |  |  |
| status | [string](#string) |  | Новый статус для user_id, напр. read. |






<a name="chat3-user-SetMessageStatusResponse"></a>

### SetMessageStatusResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| status | [MessageStatus](#chat3-user-MessageStatus) |  |  |
| message | [Message](#chat3-user-Message) |  |  |






<a name="chat3-user-SubscribeUpdatesRequest"></a>

### SubscribeUpdatesRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user_id | [string](#string) |  | Пользователь, на чьи updates подписаться. |






<a name="chat3-user-Update"></a>

### Update
Персональное update-событие из потока SubscribeUpdates.


| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| update_id | [string](#string) |  |  |
| tenant_id | [string](#string) |  |  |
| user_id | [string](#string) |  |  |
| entity_id | [string](#string) |  |  |
| event_id | [string](#string) |  |  |
| source_event_type | [string](#string) |  | Исходный domain event, напр. message.create. |
| update_type | [string](#string) |  |  |
| data | [google.protobuf.Struct](#google-protobuf-Struct) |  | Полезная нагрузка update (структура зависит от update_type). |
| created_at | [double](#double) |  | Unix time (мс, double как в Chat3). |






<a name="chat3-user-UpsertUserRequest"></a>

### UpsertUserRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user_id | [string](#string) |  | Id пользователя (будет нормализован: trim &#43; lowercase). |
| name | [string](#string) |  | Отображаемое имя → meta.name. |
| type | [string](#string) |  | Тип, по умолчанию user. |
| meta | [google.protobuf.Struct](#google-protobuf-Struct) |  | Дополнительная meta (мержится с name). |






<a name="chat3-user-UpsertUserResponse"></a>

### UpsertUserResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user | [User](#chat3-user-User) |  |  |
| created | [bool](#bool) |  | true если пользователь только что создан. |






<a name="chat3-user-User"></a>

### User



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user_id | [string](#string) |  | Стабильный id пользователя в тенанте (часто login). |
| tenant_id | [string](#string) |  |  |
| type | [string](#string) |  | Тип сущности user, обычно &#34;user&#34;. |
| created_at | [double](#double) |  |  |
| meta | [google.protobuf.Struct](#google-protobuf-Struct) |  | Профильная meta (name и произвольные ключи). |





 

 

 


<a name="chat3-user-Chat3UserService"></a>

### Chat3UserService
Chat3UserService — интеграторский User gRPC API.

Auth (gRPC metadata на каждый вызов):
  - x-api-key: API key тенанта
  - x-tenant-id: идентификатор тенанта

Контекст пользователя — поле user_id в теле RPC (не JWT).
Meta на сущностях — opaque google.protobuf.Struct (продуктовые конвенции
вроде type/dmKey живут у интегратора, не в Chat3).

| Method Name | Request Type | Response Type | Description |
| ----------- | ------------ | ------------- | ------------|
| GetUserDialogs | [GetUserDialogsRequest](#chat3-user-GetUserDialogsRequest) | [GetUserDialogsResponse](#chat3-user-GetUserDialogsResponse) | Список диалогов пользователя. Поддерживает page/limit, filter/sort (как в Tenant REST) и опционально last_message. |
| GetDialogMessages | [GetDialogMessagesRequest](#chat3-user-GetDialogMessagesRequest) | [GetDialogMessagesResponse](#chat3-user-GetDialogMessagesResponse) | История сообщений диалога с пагинацией. user_id должен быть участником dialog (иначе ошибка доступа). |
| SendMessage | [SendMessageRequest](#chat3-user-SendMessageRequest) | [SendMessageResponse](#chat3-user-SendMessageResponse) | Отправить сообщение в dialog. type по умолчанию для текста: internal.text; content — тело сообщения. Членство в dialog для SendMessage не требуется (поведение Chat3). |
| SubscribeUpdates | [SubscribeUpdatesRequest](#chat3-user-SubscribeUpdatesRequest) | [Update](#chat3-user-Update) stream | Server-streaming подписка на персональные updates пользователя (новые сообщения, статусы, typing и т.д. через chat3_updates). |
| SetMessageStatus | [SetMessageStatusRequest](#chat3-user-SetMessageStatusRequest) | [SetMessageStatusResponse](#chat3-user-SetMessageStatusResponse) | Выставить статус сообщения для user_id (например read / delivered). |
| SetMessageReaction | [SetMessageReactionRequest](#chat3-user-SetMessageReactionRequest) | [SetMessageReactionResponse](#chat3-user-SetMessageReactionResponse) | Поставить или снять реакцию на сообщение (set=true/false). |
| SendTypingIndicator | [SendTypingIndicatorRequest](#chat3-user-SendTypingIndicatorRequest) | [SendTypingIndicatorResponse](#chat3-user-SendTypingIndicatorResponse) | Короткий индикатор «печатает» в dialog. Требует членства в dialog. |
| SetMessageDeleted | [SetMessageDeletedRequest](#chat3-user-SetMessageDeletedRequest) | [SetMessageDeletedResponse](#chat3-user-SetMessageDeletedResponse) | Soft-delete / restore сообщения (deleted=true/false). |
| MarkDialogAllRead | [MarkDialogAllReadRequest](#chat3-user-MarkDialogAllReadRequest) | [MarkDialogAllReadResponse](#chat3-user-MarkDialogAllReadResponse) | Пометить весь dialog прочитанным для user_id (сброс unread). |
| UpsertUser | [UpsertUserRequest](#chat3-user-UpsertUserRequest) | [UpsertUserResponse](#chat3-user-UpsertUserResponse) | Создать пользователя или обновить существующего по user_id. name записывается в meta.name; дополнительные ключи — в meta. |
| GetUser | [GetUserRequest](#chat3-user-GetUserRequest) | [GetUserResponse](#chat3-user-GetUserResponse) | Получить пользователя тенанта по user_id (профиль &#43; meta). |
| CreateDialog | [CreateDialogRequest](#chat3-user-CreateDialogRequest) | [CreateDialogResponse](#chat3-user-CreateDialogResponse) | Создать dialog: actor (user_id) всегда становится member; member_user_ids — дополнительные участники; meta — произвольные ключи. |
| FindDialogByMeta | [FindDialogByMetaRequest](#chat3-user-FindDialogByMetaRequest) | [FindDialogByMetaResponse](#chat3-user-FindDialogByMetaResponse) | Найти dialog по одному meta key/value (tenant-scoped). Если передан user_id — возвращает результат только при членстве этого user. Типичный паттерн 1:1 у интегратора: meta_key=dmKey, meta_value=a:b. |
| AddDialogMembers | [AddDialogMembersRequest](#chat3-user-AddDialogMembersRequest) | [AddDialogMembersResponse](#chat3-user-AddDialogMembersResponse) | Добавить участников в существующий dialog. Дедуп: уже состоящие в dialog не возвращаются в added_user_ids. |
| RemoveDialogMember | [RemoveDialogMemberRequest](#chat3-user-RemoveDialogMemberRequest) | [RemoveDialogMemberResponse](#chat3-user-RemoveDialogMemberResponse) | Удалить участника из dialog. Нельзя удалить последнего member. |

 



## Scalar Value Types

| .proto Type | Notes | C++ | Java | Python | Go | C# | PHP | Ruby |
| ----------- | ----- | --- | ---- | ------ | -- | -- | --- | ---- |
| <a name="double" /> double |  | double | double | float | float64 | double | float | Float |
| <a name="float" /> float |  | float | float | float | float32 | float | float | Float |
| <a name="int32" /> int32 | Uses variable-length encoding. Inefficient for encoding negative numbers – if your field is likely to have negative values, use sint32 instead. | int32 | int | int | int32 | int | integer | Bignum or Fixnum (as required) |
| <a name="int64" /> int64 | Uses variable-length encoding. Inefficient for encoding negative numbers – if your field is likely to have negative values, use sint64 instead. | int64 | long | int/long | int64 | long | integer/string | Bignum |
| <a name="uint32" /> uint32 | Uses variable-length encoding. | uint32 | int | int/long | uint32 | uint | integer | Bignum or Fixnum (as required) |
| <a name="uint64" /> uint64 | Uses variable-length encoding. | uint64 | long | int/long | uint64 | ulong | integer/string | Bignum or Fixnum (as required) |
| <a name="sint32" /> sint32 | Uses variable-length encoding. Signed int value. These more efficiently encode negative numbers than regular int32s. | int32 | int | int | int32 | int | integer | Bignum or Fixnum (as required) |
| <a name="sint64" /> sint64 | Uses variable-length encoding. Signed int value. These more efficiently encode negative numbers than regular int64s. | int64 | long | int/long | int64 | long | integer/string | Bignum |
| <a name="fixed32" /> fixed32 | Always four bytes. More efficient than uint32 if values are often greater than 2^28. | uint32 | int | int | uint32 | uint | integer | Bignum or Fixnum (as required) |
| <a name="fixed64" /> fixed64 | Always eight bytes. More efficient than uint64 if values are often greater than 2^56. | uint64 | long | int/long | uint64 | ulong | integer/string | Bignum |
| <a name="sfixed32" /> sfixed32 | Always four bytes. | int32 | int | int | int32 | int | integer | Bignum or Fixnum (as required) |
| <a name="sfixed64" /> sfixed64 | Always eight bytes. | int64 | long | int/long | int64 | long | integer/string | Bignum |
| <a name="bool" /> bool |  | bool | boolean | boolean | bool | bool | boolean | TrueClass/FalseClass |
| <a name="string" /> string | A string must always contain UTF-8 encoded or 7-bit ASCII text. | string | String | str/unicode | string | string | string | String (UTF-8) |
| <a name="bytes" /> bytes | May contain any arbitrary sequence of bytes. | string | ByteString | str | []byte | ByteString | string | String (ASCII-8BIT) |

