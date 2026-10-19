# Protocol Documentation
<a name="top"></a>

## Table of Contents

- [chat3_integrator.proto](#chat3_integrator-proto)
    - [AddDialogMembersRequest](#chat3-integrator-AddDialogMembersRequest)
    - [AddDialogMembersResponse](#chat3-integrator-AddDialogMembersResponse)
    - [CreateDialogRequest](#chat3-integrator-CreateDialogRequest)
    - [CreateDialogResponse](#chat3-integrator-CreateDialogResponse)
    - [CreateTenantRequest](#chat3-integrator-CreateTenantRequest)
    - [CreateTenantResponse](#chat3-integrator-CreateTenantResponse)
    - [DeleteDialogRequest](#chat3-integrator-DeleteDialogRequest)
    - [DeleteDialogResponse](#chat3-integrator-DeleteDialogResponse)
    - [DeleteMetaRequest](#chat3-integrator-DeleteMetaRequest)
    - [DeleteMetaResponse](#chat3-integrator-DeleteMetaResponse)
    - [DeleteTenantRequest](#chat3-integrator-DeleteTenantRequest)
    - [DeleteTenantResponse](#chat3-integrator-DeleteTenantResponse)
    - [Dialog](#chat3-integrator-Dialog)
    - [DialogInfo](#chat3-integrator-DialogInfo)
    - [DialogMember](#chat3-integrator-DialogMember)
    - [DialogStatsLite](#chat3-integrator-DialogStatsLite)
    - [EnsureTenantRequest](#chat3-integrator-EnsureTenantRequest)
    - [EnsureTenantResponse](#chat3-integrator-EnsureTenantResponse)
    - [FindDialogByMetaRequest](#chat3-integrator-FindDialogByMetaRequest)
    - [FindDialogByMetaResponse](#chat3-integrator-FindDialogByMetaResponse)
    - [GetDialogMessagesRequest](#chat3-integrator-GetDialogMessagesRequest)
    - [GetDialogMessagesResponse](#chat3-integrator-GetDialogMessagesResponse)
    - [GetDialogRequest](#chat3-integrator-GetDialogRequest)
    - [GetDialogResponse](#chat3-integrator-GetDialogResponse)
    - [GetMessageRequest](#chat3-integrator-GetMessageRequest)
    - [GetMessageResponse](#chat3-integrator-GetMessageResponse)
    - [GetMetaRequest](#chat3-integrator-GetMetaRequest)
    - [GetMetaResponse](#chat3-integrator-GetMetaResponse)
    - [GetTenantRequest](#chat3-integrator-GetTenantRequest)
    - [GetTenantResponse](#chat3-integrator-GetTenantResponse)
    - [GetUserDialogsRequest](#chat3-integrator-GetUserDialogsRequest)
    - [GetUserDialogsResponse](#chat3-integrator-GetUserDialogsResponse)
    - [GetUserRequest](#chat3-integrator-GetUserRequest)
    - [GetUserResponse](#chat3-integrator-GetUserResponse)
    - [ListDialogMembersRequest](#chat3-integrator-ListDialogMembersRequest)
    - [ListDialogMembersResponse](#chat3-integrator-ListDialogMembersResponse)
    - [ListMessageStatusesRequest](#chat3-integrator-ListMessageStatusesRequest)
    - [ListMessageStatusesResponse](#chat3-integrator-ListMessageStatusesResponse)
    - [ListTenantsRequest](#chat3-integrator-ListTenantsRequest)
    - [ListTenantsResponse](#chat3-integrator-ListTenantsResponse)
    - [MarkDialogAllReadRequest](#chat3-integrator-MarkDialogAllReadRequest)
    - [MarkDialogAllReadResponse](#chat3-integrator-MarkDialogAllReadResponse)
    - [MemberState](#chat3-integrator-MemberState)
    - [Message](#chat3-integrator-Message)
    - [MessageStatus](#chat3-integrator-MessageStatus)
    - [Pagination](#chat3-integrator-Pagination)
    - [RemoveDialogMemberRequest](#chat3-integrator-RemoveDialogMemberRequest)
    - [RemoveDialogMemberResponse](#chat3-integrator-RemoveDialogMemberResponse)
    - [SearchMessagesRequest](#chat3-integrator-SearchMessagesRequest)
    - [SearchMessagesResponse](#chat3-integrator-SearchMessagesResponse)
    - [SendMessageRequest](#chat3-integrator-SendMessageRequest)
    - [SendMessageResponse](#chat3-integrator-SendMessageResponse)
    - [SendTypingIndicatorRequest](#chat3-integrator-SendTypingIndicatorRequest)
    - [SendTypingIndicatorResponse](#chat3-integrator-SendTypingIndicatorResponse)
    - [SenderInfo](#chat3-integrator-SenderInfo)
    - [SetMessageDeletedRequest](#chat3-integrator-SetMessageDeletedRequest)
    - [SetMessageDeletedResponse](#chat3-integrator-SetMessageDeletedResponse)
    - [SetMessageReactionRequest](#chat3-integrator-SetMessageReactionRequest)
    - [SetMessageReactionResponse](#chat3-integrator-SetMessageReactionResponse)
    - [SetMessageStatusRequest](#chat3-integrator-SetMessageStatusRequest)
    - [SetMessageStatusResponse](#chat3-integrator-SetMessageStatusResponse)
    - [SetMetaRequest](#chat3-integrator-SetMetaRequest)
    - [SetMetaResponse](#chat3-integrator-SetMetaResponse)
    - [SubscribeTenantUpdatesRequest](#chat3-integrator-SubscribeTenantUpdatesRequest)
    - [SubscribeUpdatesRequest](#chat3-integrator-SubscribeUpdatesRequest)
    - [TenantInfo](#chat3-integrator-TenantInfo)
    - [Update](#chat3-integrator-Update)
    - [UpdateDialogMetaRequest](#chat3-integrator-UpdateDialogMetaRequest)
    - [UpdateDialogMetaResponse](#chat3-integrator-UpdateDialogMetaResponse)
    - [UpsertUserRequest](#chat3-integrator-UpsertUserRequest)
    - [UpsertUserResponse](#chat3-integrator-UpsertUserResponse)
    - [User](#chat3-integrator-User)
    - [WatchUpdatesClientMsg](#chat3-integrator-WatchUpdatesClientMsg)
    - [WatchUsers](#chat3-integrator-WatchUsers)
  
    - [Chat3IntegratorService](#chat3-integrator-Chat3IntegratorService)
    - [Chat3TenantService](#chat3-integrator-Chat3TenantService)
  
- [Scalar Value Types](#scalar-value-types)



<a name="chat3_integrator-proto"></a>
<p align="right"><a href="#top">Top</a></p>

## chat3_integrator.proto



<a name="chat3-integrator-AddDialogMembersRequest"></a>

### AddDialogMembersRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user_id | [string](#string) |  | Actor операции. |
| dialog_id | [string](#string) |  |  |
| member_user_ids | [string](#string) | repeated | Кого добавить. |






<a name="chat3-integrator-AddDialogMembersResponse"></a>

### AddDialogMembersResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| dialog | [DialogInfo](#chat3-integrator-DialogInfo) |  |  |
| added_user_ids | [string](#string) | repeated | Фактически добавленные (без уже состоявших в dialog). |






<a name="chat3-integrator-CreateDialogRequest"></a>

### CreateDialogRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user_id | [string](#string) |  | Actor create; всегда добавляется в members. |
| member_user_ids | [string](#string) | repeated | Дополнительные участники (без дублей, без обязательности существования в Chat3 — обычно интегратор делает UpsertUser заранее). |
| meta | [google.protobuf.Struct](#google-protobuf-Struct) |  | Произвольная meta. Примеры интегратора: {type:group,title:...} или {type:dm,dmKey:...}. |






<a name="chat3-integrator-CreateDialogResponse"></a>

### CreateDialogResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| dialog | [DialogInfo](#chat3-integrator-DialogInfo) |  |  |
| created | [bool](#bool) |  | Для create всегда true (идемпотентность 1:1 делает интегратор через FindDialogByMeta). |






<a name="chat3-integrator-CreateTenantRequest"></a>

### CreateTenantRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| tenant_id | [string](#string) |  | Опционально; пусто → автогенерация. |
| meta | [google.protobuf.Struct](#google-protobuf-Struct) |  |  |






<a name="chat3-integrator-CreateTenantResponse"></a>

### CreateTenantResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| tenant | [TenantInfo](#chat3-integrator-TenantInfo) |  |  |
| created | [bool](#bool) |  |  |






<a name="chat3-integrator-DeleteDialogRequest"></a>

### DeleteDialogRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| dialog_id | [string](#string) |  |  |
| user_id | [string](#string) |  | Actor для dialog.delete event (опционально). |






<a name="chat3-integrator-DeleteDialogResponse"></a>

### DeleteDialogResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| dialog_id | [string](#string) |  |  |
| deleted | [bool](#bool) |  |  |






<a name="chat3-integrator-DeleteMetaRequest"></a>

### DeleteMetaRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| entity_type | [string](#string) |  |  |
| entity_id | [string](#string) |  |  |
| key | [string](#string) |  |  |
| user_id | [string](#string) |  |  |






<a name="chat3-integrator-DeleteMetaResponse"></a>

### DeleteMetaResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| deleted | [bool](#bool) |  |  |






<a name="chat3-integrator-DeleteTenantRequest"></a>

### DeleteTenantRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| tenant_id | [string](#string) |  |  |






<a name="chat3-integrator-DeleteTenantResponse"></a>

### DeleteTenantResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| tenant_id | [string](#string) |  |  |
| deleted | [bool](#bool) |  |  |






<a name="chat3-integrator-Dialog"></a>

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
| member | [DialogMember](#chat3-integrator-DialogMember) |  | Контекст членства запрашивающего user_id (unread и т.п.). |
| last_message | [Message](#chat3-integrator-Message) |  | Последнее сообщение, если include_last_message=true. |
| members_count | [int32](#int32) |  | Число участников (удобно для UI без отдельного ListDialogMembers). |
| stats | [DialogStatsLite](#chat3-integrator-DialogStatsLite) |  | Компактные stats dialog (member/message/topic counts). |






<a name="chat3-integrator-DialogInfo"></a>

### DialogInfo
Компактное представление dialog после create / find / members.


| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| dialog_id | [string](#string) |  |  |
| tenant_id | [string](#string) |  |  |
| created_at | [double](#double) |  |  |
| meta | [google.protobuf.Struct](#google-protobuf-Struct) |  | Opaque meta dialog. |
| member_user_ids | [string](#string) | repeated | Текущий список member user_id. |






<a name="chat3-integrator-DialogMember"></a>

### DialogMember



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user_id | [string](#string) |  |  |
| meta | [google.protobuf.Struct](#google-protobuf-Struct) |  |  |
| state | [MemberState](#chat3-integrator-MemberState) |  |  |






<a name="chat3-integrator-DialogStatsLite"></a>

### DialogStatsLite
Компактные счётчики dialog (как REST stats без Controlo-полей).


| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| member_count | [int32](#int32) |  |  |
| message_count | [int32](#int32) |  |  |
| topic_count | [int32](#int32) |  |  |






<a name="chat3-integrator-EnsureTenantRequest"></a>

### EnsureTenantRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| tenant_id | [string](#string) |  | Рекомендуется задавать для идемпотентности (amax install). |
| meta | [google.protobuf.Struct](#google-protobuf-Struct) |  | Применяется только при создании; существующий tenant meta не мержится. |






<a name="chat3-integrator-EnsureTenantResponse"></a>

### EnsureTenantResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| tenant | [TenantInfo](#chat3-integrator-TenantInfo) |  |  |
| created | [bool](#bool) |  | false — tenant уже существовал. |






<a name="chat3-integrator-FindDialogByMetaRequest"></a>

### FindDialogByMetaRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user_id | [string](#string) |  | Опционально: если задан — dialog вернётся только если user member. |
| meta_key | [string](#string) |  | Ключ meta, напр. dmKey. |
| meta_value | [string](#string) |  | Точное значение meta, напр. alice:bob. |






<a name="chat3-integrator-FindDialogByMetaResponse"></a>

### FindDialogByMetaResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| found | [bool](#bool) |  | false — dialog с таким meta не найден (или нет членства). |
| dialog | [DialogInfo](#chat3-integrator-DialogInfo) |  | Заполняется только если found=true. |






<a name="chat3-integrator-GetDialogMessagesRequest"></a>

### GetDialogMessagesRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user_id | [string](#string) |  | Запрашивающий пользователь (проверка членства). |
| dialog_id | [string](#string) |  | Целевой dialog. |
| page | [int32](#int32) |  |  |
| limit | [int32](#int32) |  |  |
| filter | [string](#string) |  |  |
| sort | [string](#string) |  | Sort, напр. {&#34;createdAt&#34;:1} для хронологии. |






<a name="chat3-integrator-GetDialogMessagesResponse"></a>

### GetDialogMessagesResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| messages | [Message](#chat3-integrator-Message) | repeated |  |
| pagination | [Pagination](#chat3-integrator-Pagination) |  |  |






<a name="chat3-integrator-GetDialogRequest"></a>

### GetDialogRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| dialog_id | [string](#string) |  |  |
| user_id | [string](#string) |  | Опционально: если задан — dialog вернётся только если user member. |






<a name="chat3-integrator-GetDialogResponse"></a>

### GetDialogResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| dialog | [DialogInfo](#chat3-integrator-DialogInfo) |  |  |
| member | [DialogMember](#chat3-integrator-DialogMember) |  | Заполняется, если в запросе был user_id (membership gate &#43; unread/activity). |
| stats | [DialogStatsLite](#chat3-integrator-DialogStatsLite) |  |  |






<a name="chat3-integrator-GetMessageRequest"></a>

### GetMessageRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| message_id | [string](#string) |  | Id сообщения (msg_…). |
| user_id | [string](#string) |  | Опционально: membership gate в dialog этого сообщения. |






<a name="chat3-integrator-GetMessageResponse"></a>

### GetMessageResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| message | [Message](#chat3-integrator-Message) |  |  |






<a name="chat3-integrator-GetMetaRequest"></a>

### GetMetaRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| entity_type | [string](#string) |  |  |
| entity_id | [string](#string) |  |  |
| key | [string](#string) |  | Если задан — вернуть только этот key в meta; иначе весь объект. |






<a name="chat3-integrator-GetMetaResponse"></a>

### GetMetaResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| meta | [google.protobuf.Struct](#google-protobuf-Struct) |  |  |






<a name="chat3-integrator-GetTenantRequest"></a>

### GetTenantRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| tenant_id | [string](#string) |  |  |






<a name="chat3-integrator-GetTenantResponse"></a>

### GetTenantResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| tenant | [TenantInfo](#chat3-integrator-TenantInfo) |  |  |






<a name="chat3-integrator-GetUserDialogsRequest"></a>

### GetUserDialogsRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user_id | [string](#string) |  | Пользователь, чьи dialogs вернуть. |
| page | [int32](#int32) |  | Номер страницы (с 1). |
| limit | [int32](#int32) |  | Размер страницы. |
| filter | [string](#string) |  | Filter expression (синтаксис как у Tenant API list dialogs). |
| sort | [string](#string) |  | Sort, обычно JSON, напр. {&#34;updatedAt&#34;:-1}. |
| include_last_message | [bool](#bool) |  | Если true — в каждый Dialog включить last_message. |






<a name="chat3-integrator-GetUserDialogsResponse"></a>

### GetUserDialogsResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| dialogs | [Dialog](#chat3-integrator-Dialog) | repeated |  |
| pagination | [Pagination](#chat3-integrator-Pagination) |  |  |






<a name="chat3-integrator-GetUserRequest"></a>

### GetUserRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user_id | [string](#string) |  |  |






<a name="chat3-integrator-GetUserResponse"></a>

### GetUserResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user | [User](#chat3-integrator-User) |  |  |






<a name="chat3-integrator-ListDialogMembersRequest"></a>

### ListDialogMembersRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| dialog_id | [string](#string) |  |  |
| page | [int32](#int32) |  |  |
| limit | [int32](#int32) |  |  |
| user_id | [string](#string) |  | Опционально: если задан — только member может листить roster. |






<a name="chat3-integrator-ListDialogMembersResponse"></a>

### ListDialogMembersResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| member_user_ids | [string](#string) | repeated |  |
| page | [int32](#int32) |  |  |
| limit | [int32](#int32) |  |  |
| total | [int32](#int32) |  |  |
| total_pages | [int32](#int32) |  |  |
| members | [DialogMember](#chat3-integrator-DialogMember) | repeated | Обогащённый roster (joined_at в state); параллельно member_user_ids для совместимости. |






<a name="chat3-integrator-ListMessageStatusesRequest"></a>

### ListMessageStatusesRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user_id | [string](#string) |  | Запрашивающий пользователь (проверка членства). |
| dialog_id | [string](#string) |  |  |
| message_id | [string](#string) |  |  |
| page | [int32](#int32) |  |  |
| limit | [int32](#int32) |  |  |






<a name="chat3-integrator-ListMessageStatusesResponse"></a>

### ListMessageStatusesResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| statuses | [MessageStatus](#chat3-integrator-MessageStatus) | repeated |  |
| pagination | [Pagination](#chat3-integrator-Pagination) |  |  |






<a name="chat3-integrator-ListTenantsRequest"></a>

### ListTenantsRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| page | [int32](#int32) |  |  |
| limit | [int32](#int32) |  |  |
| sort | [string](#string) |  | JSON, напр. {&#34;createdAt&#34;:-1}. |






<a name="chat3-integrator-ListTenantsResponse"></a>

### ListTenantsResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| tenants | [TenantInfo](#chat3-integrator-TenantInfo) | repeated |  |
| pagination | [Pagination](#chat3-integrator-Pagination) |  |  |






<a name="chat3-integrator-MarkDialogAllReadRequest"></a>

### MarkDialogAllReadRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user_id | [string](#string) |  |  |
| dialog_id | [string](#string) |  |  |






<a name="chat3-integrator-MarkDialogAllReadResponse"></a>

### MarkDialogAllReadResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| message | [string](#string) |  |  |
| dialog_id | [string](#string) |  |  |
| user_id | [string](#string) |  |  |






<a name="chat3-integrator-MemberState"></a>

### MemberState



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| unread_count | [int32](#int32) |  |  |
| last_seen_at | [double](#double) |  |  |
| last_message_at | [double](#double) |  |  |
| is_active | [bool](#bool) |  |  |
| joined_at | [double](#double) |  | Когда user стал member (мс/мкс timestamp Chat3). |






<a name="chat3-integrator-Message"></a>

### Message



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| message_id | [string](#string) |  |  |
| dialog_id | [string](#string) |  |  |
| sender_id | [string](#string) |  |  |
| type | [string](#string) |  | Тип, напр. internal.text. |
| content | [string](#string) |  |  |
| meta | [google.protobuf.Struct](#google-protobuf-Struct) |  |  |
| statuses | [MessageStatus](#chat3-integrator-MessageStatus) | repeated |  |
| reaction_set | [google.protobuf.Struct](#google-protobuf-Struct) |  |  |
| sender_info | [SenderInfo](#chat3-integrator-SenderInfo) |  |  |
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






<a name="chat3-integrator-MessageStatus"></a>

### MessageStatus



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user_id | [string](#string) |  |  |
| status | [string](#string) |  | Значение статуса, напр. read / delivered. |
| read_at | [double](#double) |  |  |
| created_at | [double](#double) |  |  |






<a name="chat3-integrator-Pagination"></a>

### Pagination



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| page | [int32](#int32) |  |  |
| limit | [int32](#int32) |  |  |
| total | [int32](#int32) |  |  |
| pages | [int32](#int32) |  |  |






<a name="chat3-integrator-RemoveDialogMemberRequest"></a>

### RemoveDialogMemberRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user_id | [string](#string) |  | Actor операции. |
| dialog_id | [string](#string) |  |  |
| member_user_id | [string](#string) |  | Кого удалить. |






<a name="chat3-integrator-RemoveDialogMemberResponse"></a>

### RemoveDialogMemberResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| dialog | [DialogInfo](#chat3-integrator-DialogInfo) |  |  |






<a name="chat3-integrator-SearchMessagesRequest"></a>

### SearchMessagesRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| page | [int32](#int32) |  |  |
| limit | [int32](#int32) |  |  |
| filter | [string](#string) |  | Filter expression (синтаксис как у Tenant API GET /api/messages). |
| sort | [string](#string) |  | Sort, напр. (createdAt,desc). |






<a name="chat3-integrator-SearchMessagesResponse"></a>

### SearchMessagesResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| messages | [Message](#chat3-integrator-Message) | repeated |  |
| pagination | [Pagination](#chat3-integrator-Pagination) |  |  |






<a name="chat3-integrator-SendMessageRequest"></a>

### SendMessageRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user_id | [string](#string) |  | Отправитель (actor). |
| dialog_id | [string](#string) |  |  |
| content | [string](#string) |  | Текст / payload сообщения. |
| type | [string](#string) |  | Тип сообщения, напр. internal.text. |
| meta | [google.protobuf.Struct](#google-protobuf-Struct) |  | Произвольная meta сообщения. |
| idempotency_key | [string](#string) |  | Ключ идемпотентности (повтор с тем же ключом не создаст дубликат). |






<a name="chat3-integrator-SendMessageResponse"></a>

### SendMessageResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| message | [Message](#chat3-integrator-Message) |  |  |






<a name="chat3-integrator-SendTypingIndicatorRequest"></a>

### SendTypingIndicatorRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user_id | [string](#string) |  | Кто печатает (должен быть member dialog). |
| dialog_id | [string](#string) |  |  |






<a name="chat3-integrator-SendTypingIndicatorResponse"></a>

### SendTypingIndicatorResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| message | [string](#string) |  |  |
| dialog_id | [string](#string) |  |  |
| user_id | [string](#string) |  |  |
| expires_in_ms | [int32](#int32) |  | Через сколько мс индикатор истечёт на клиентах. |






<a name="chat3-integrator-SenderInfo"></a>

### SenderInfo



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user_id | [string](#string) |  |  |
| name | [string](#string) |  |  |
| created_at | [double](#double) |  |  |
| meta | [google.protobuf.Struct](#google-protobuf-Struct) |  |  |






<a name="chat3-integrator-SetMessageDeletedRequest"></a>

### SetMessageDeletedRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user_id | [string](#string) |  |  |
| message_id | [string](#string) |  |  |
| deleted | [bool](#bool) |  | true — пометить удалённым, false — восстановить. |
| deleted_by | [string](#string) |  | Кто удалил (обычно = user_id). |






<a name="chat3-integrator-SetMessageDeletedResponse"></a>

### SetMessageDeletedResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| message | [Message](#chat3-integrator-Message) |  |  |






<a name="chat3-integrator-SetMessageReactionRequest"></a>

### SetMessageReactionRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user_id | [string](#string) |  |  |
| dialog_id | [string](#string) |  |  |
| message_id | [string](#string) |  |  |
| reaction | [string](#string) |  | Код/emoji реакции. |
| set | [bool](#bool) |  | true — поставить, false — снять. |






<a name="chat3-integrator-SetMessageReactionResponse"></a>

### SetMessageReactionResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| message | [string](#string) |  |  |
| reaction_set | [google.protobuf.Struct](#google-protobuf-Struct) |  |  |






<a name="chat3-integrator-SetMessageStatusRequest"></a>

### SetMessageStatusRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user_id | [string](#string) |  |  |
| dialog_id | [string](#string) |  |  |
| message_id | [string](#string) |  |  |
| status | [string](#string) |  | Новый статус для user_id, напр. read. |






<a name="chat3-integrator-SetMessageStatusResponse"></a>

### SetMessageStatusResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| status | [MessageStatus](#chat3-integrator-MessageStatus) |  |  |
| message | [Message](#chat3-integrator-Message) |  |  |






<a name="chat3-integrator-SetMetaRequest"></a>

### SetMetaRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| entity_type | [string](#string) |  | user | dialog | message | tenant | system | dialogMember | topic | pack |
| entity_id | [string](#string) |  |  |
| key | [string](#string) |  |  |
| value | [google.protobuf.Value](#google-protobuf-Value) |  | Значение meta (string/number/bool/struct/list/null). |
| data_type | [string](#string) |  | string | number | boolean | object | array (default: выводится из value). |
| user_id | [string](#string) |  | Actor для side-effect events (dialog.changed / message.changed). |






<a name="chat3-integrator-SetMetaResponse"></a>

### SetMetaResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| meta | [google.protobuf.Struct](#google-protobuf-Struct) |  | Полная meta сущности после записи (key → value). |






<a name="chat3-integrator-SubscribeTenantUpdatesRequest"></a>

### SubscribeTenantUpdatesRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| tenant_ids | [string](#string) | repeated | Список tenant для firehose. Пустой = все tenant (wildcard bind). |






<a name="chat3-integrator-SubscribeUpdatesRequest"></a>

### SubscribeUpdatesRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user_id | [string](#string) |  | Пользователь, на чьи updates подписаться. |






<a name="chat3-integrator-TenantInfo"></a>

### TenantInfo



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| tenant_id | [string](#string) |  |  |
| created_at | [double](#double) |  |  |
| meta | [google.protobuf.Struct](#google-protobuf-Struct) |  |  |






<a name="chat3-integrator-Update"></a>

### Update
Персональное update-событие из потока SubscribeUpdates / SubscribeTenantUpdates / WatchUpdates.


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






<a name="chat3-integrator-UpdateDialogMetaRequest"></a>

### UpdateDialogMetaRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user_id | [string](#string) |  | Actor операции (для event). |
| dialog_id | [string](#string) |  |  |
| meta | [google.protobuf.Struct](#google-protobuf-Struct) |  | Ключи мержатся в существующую meta (replace per-key, не wipe всего объекта). |






<a name="chat3-integrator-UpdateDialogMetaResponse"></a>

### UpdateDialogMetaResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| dialog | [DialogInfo](#chat3-integrator-DialogInfo) |  |  |






<a name="chat3-integrator-UpsertUserRequest"></a>

### UpsertUserRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user_id | [string](#string) |  | Id пользователя (будет нормализован: trim &#43; lowercase). |
| name | [string](#string) |  | Отображаемое имя → meta.name. |
| type | [string](#string) |  | Тип, по умолчанию user. |
| meta | [google.protobuf.Struct](#google-protobuf-Struct) |  | Дополнительная meta (мержится с name). |






<a name="chat3-integrator-UpsertUserResponse"></a>

### UpsertUserResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user | [User](#chat3-integrator-User) |  |  |
| created | [bool](#bool) |  | true если пользователь только что создан. |






<a name="chat3-integrator-User"></a>

### User



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user_id | [string](#string) |  | Стабильный id пользователя в тенанте (часто login). |
| tenant_id | [string](#string) |  |  |
| type | [string](#string) |  | Тип сущности user, обычно &#34;user&#34;. |
| created_at | [double](#double) |  |  |
| meta | [google.protobuf.Struct](#google-protobuf-Struct) |  | Профильная meta (name и произвольные ключи). |






<a name="chat3-integrator-WatchUpdatesClientMsg"></a>

### WatchUpdatesClientMsg
Клиентские команды для WatchUpdates (bidi).


| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| watch | [WatchUsers](#chat3-integrator-WatchUsers) |  |  |
| unwatch | [WatchUsers](#chat3-integrator-WatchUsers) |  |  |






<a name="chat3-integrator-WatchUsers"></a>

### WatchUsers



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| tenant_id | [string](#string) |  | Tenant scope для всех user_ids в этом batch. |
| user_ids | [string](#string) | repeated | Список userId; сервер дедуплицирует. Непустой. |
| user_type | [string](#string) |  | Опционально; default &#34;user&#34; для всего batch. |





 

 

 


<a name="chat3-integrator-Chat3IntegratorService"></a>

### Chat3IntegratorService
Chat3IntegratorService — интеграторский gRPC API (server↔server).

Auth (gRPC metadata):
  - x-api-key: секрет интегратора (единственный credential)

Tenant scope (не часть auth):
  - x-tenant-id: в каком tenant выполнять RPC (данные изолированы по tenant).
    Валидный ключ может работать с любым существующим tenant (allowlist нет).

Контекст пользователя — поле user_id в теле RPC (не JWT).
Meta на сущностях — opaque google.protobuf.Struct (продуктовые конвенции
вроде type/dmKey живут у интегратора, не в Chat3).

| Method Name | Request Type | Response Type | Description |
| ----------- | ------------ | ------------- | ------------|
| GetUserDialogs | [GetUserDialogsRequest](#chat3-integrator-GetUserDialogsRequest) | [GetUserDialogsResponse](#chat3-integrator-GetUserDialogsResponse) | Список диалогов пользователя. Поддерживает page/limit, filter/sort (как в Tenant REST) и опционально last_message. |
| GetDialogMessages | [GetDialogMessagesRequest](#chat3-integrator-GetDialogMessagesRequest) | [GetDialogMessagesResponse](#chat3-integrator-GetDialogMessagesResponse) | История сообщений диалога с пагинацией. user_id должен быть участником dialog (иначе ошибка доступа). |
| SendMessage | [SendMessageRequest](#chat3-integrator-SendMessageRequest) | [SendMessageResponse](#chat3-integrator-SendMessageResponse) | Отправить сообщение в dialog. type по умолчанию для текста: internal.text; content — тело сообщения. Членство в dialog для SendMessage не требуется (поведение Chat3). |
| SubscribeUpdates | [SubscribeUpdatesRequest](#chat3-integrator-SubscribeUpdatesRequest) | [Update](#chat3-integrator-Update) stream | Server-streaming подписка на персональные updates пользователя (новые сообщения, статусы, typing и т.д. через chat3_updates). Scope: один (tenant из x-tenant-id, user_id). |
| SubscribeTenantUpdates | [SubscribeTenantUpdatesRequest](#chat3-integrator-SubscribeTenantUpdatesRequest) | [Update](#chat3-integrator-Update) stream | Server-streaming firehose Updates по tenant(ам) или всем tenant. tenant_ids пустой → wildcard (все tenant). Иначе — bind per tenant. Auth: только x-api-key (x-tenant-id не задаёт scope этого stream). |
| WatchUpdates | [WatchUpdatesClientMsg](#chat3-integrator-WatchUpdatesClientMsg) stream | [Update](#chat3-integrator-Update) stream | Bidirectional multiplexed watch: один stream, динамический набор personal binds (watch/unwatch → AMQP bind/unbind на одной queue). Auth: только x-api-key. tenant_id — в каждом WatchUsers. Idle (пустой active set) не закрывает stream. Лимиты (server): max ~500 watched keys; max ~100 user_ids на сообщение; batch при превышении лимита отклоняется атомарно. |
| SetMessageStatus | [SetMessageStatusRequest](#chat3-integrator-SetMessageStatusRequest) | [SetMessageStatusResponse](#chat3-integrator-SetMessageStatusResponse) | Выставить статус сообщения для user_id (например read / delivered). |
| SetMessageReaction | [SetMessageReactionRequest](#chat3-integrator-SetMessageReactionRequest) | [SetMessageReactionResponse](#chat3-integrator-SetMessageReactionResponse) | Поставить или снять реакцию на сообщение (set=true/false). |
| SendTypingIndicator | [SendTypingIndicatorRequest](#chat3-integrator-SendTypingIndicatorRequest) | [SendTypingIndicatorResponse](#chat3-integrator-SendTypingIndicatorResponse) | Короткий индикатор «печатает» в dialog. Требует членства в dialog. |
| SetMessageDeleted | [SetMessageDeletedRequest](#chat3-integrator-SetMessageDeletedRequest) | [SetMessageDeletedResponse](#chat3-integrator-SetMessageDeletedResponse) | Soft-delete / restore сообщения (deleted=true/false). |
| MarkDialogAllRead | [MarkDialogAllReadRequest](#chat3-integrator-MarkDialogAllReadRequest) | [MarkDialogAllReadResponse](#chat3-integrator-MarkDialogAllReadResponse) | Пометить весь dialog прочитанным для user_id (сброс unread). |
| UpsertUser | [UpsertUserRequest](#chat3-integrator-UpsertUserRequest) | [UpsertUserResponse](#chat3-integrator-UpsertUserResponse) | Создать пользователя или обновить существующего по user_id. name записывается в meta.name; дополнительные ключи — в meta. |
| GetUser | [GetUserRequest](#chat3-integrator-GetUserRequest) | [GetUserResponse](#chat3-integrator-GetUserResponse) | Получить пользователя тенанта по user_id (профиль &#43; meta). |
| CreateDialog | [CreateDialogRequest](#chat3-integrator-CreateDialogRequest) | [CreateDialogResponse](#chat3-integrator-CreateDialogResponse) | Создать dialog: actor (user_id) всегда становится member; member_user_ids — дополнительные участники; meta — произвольные ключи. |
| FindDialogByMeta | [FindDialogByMetaRequest](#chat3-integrator-FindDialogByMetaRequest) | [FindDialogByMetaResponse](#chat3-integrator-FindDialogByMetaResponse) | Найти dialog по одному meta key/value (tenant-scoped). Если передан user_id — возвращает результат только при членстве этого user. Типичный паттерн 1:1 у интегратора: meta_key=dmKey, meta_value=a:b. |
| AddDialogMembers | [AddDialogMembersRequest](#chat3-integrator-AddDialogMembersRequest) | [AddDialogMembersResponse](#chat3-integrator-AddDialogMembersResponse) | Добавить участников в существующий dialog. Дедуп: уже состоящие в dialog не возвращаются в added_user_ids. |
| RemoveDialogMember | [RemoveDialogMemberRequest](#chat3-integrator-RemoveDialogMemberRequest) | [RemoveDialogMemberResponse](#chat3-integrator-RemoveDialogMemberResponse) | Удалить участника из dialog. Нельзя удалить последнего member. |
| GetDialog | [GetDialogRequest](#chat3-integrator-GetDialogRequest) | [GetDialogResponse](#chat3-integrator-GetDialogResponse) | Получить dialog по id (&#43; meta, member_user_ids). Если передан user_id — только при членстве этого user. |
| ListDialogMembers | [ListDialogMembersRequest](#chat3-integrator-ListDialogMembersRequest) | [ListDialogMembersResponse](#chat3-integrator-ListDialogMembersResponse) | Список участников dialog (user_id), с пагинацией. |
| UpdateDialogMeta | [UpdateDialogMetaRequest](#chat3-integrator-UpdateDialogMetaRequest) | [UpdateDialogMetaResponse](#chat3-integrator-UpdateDialogMetaResponse) | Merge meta dialog (opaque keys). Типично: смена title группы. Эмитит dialog.changed. |
| GetMessage | [GetMessageRequest](#chat3-integrator-GetMessageRequest) | [GetMessageResponse](#chat3-integrator-GetMessageResponse) | Получить одно сообщение по message_id (tenant из metadata). Если передан user_id — только при членстве этого user в dialog сообщения. |
| SearchMessages | [SearchMessagesRequest](#chat3-integrator-SearchMessagesRequest) | [SearchMessagesResponse](#chat3-integrator-SearchMessagesResponse) | Tenant-wide список/поиск сообщений (аналог GET /api/messages?filter=…). Не требует user_id / membership (integrator API-key scope). |
| ListMessageStatuses | [ListMessageStatusesRequest](#chat3-integrator-ListMessageStatusesRequest) | [ListMessageStatusesResponse](#chat3-integrator-ListMessageStatusesResponse) | История статусов сообщения (read/delivered/…) с пагинацией. user_id должен быть участником dialog сообщения. |
| DeleteDialog | [DeleteDialogRequest](#chat3-integrator-DeleteDialogRequest) | [DeleteDialogResponse](#chat3-integrator-DeleteDialogResponse) | Удалить dialog (каскад members/stats/meta/pack-links). Эмитит dialog.delete. user_id — actor для event (опционально). |
| SetMeta | [SetMetaRequest](#chat3-integrator-SetMetaRequest) | [SetMetaResponse](#chat3-integrator-SetMetaResponse) | Установить/обновить один meta key сущности. |
| GetMeta | [GetMetaRequest](#chat3-integrator-GetMetaRequest) | [GetMetaResponse](#chat3-integrator-GetMetaResponse) | Получить meta сущности: весь объект или один key. |
| DeleteMeta | [DeleteMetaRequest](#chat3-integrator-DeleteMetaRequest) | [DeleteMetaResponse](#chat3-integrator-DeleteMetaResponse) | Удалить один meta key сущности. |


<a name="chat3-integrator-Chat3TenantService"></a>

### Chat3TenantService
---------------------------------------------------------------------------
Chat3TenantService — provisioning / admin tenant CRUD (не User scope).

Auth (gRPC metadata):
  - x-api-key: обязателен
  - x-tenant-id: для CreateTenant / EnsureTenant ЗАПРЕЩЁН (как REST
    apiAuthForTenantCreation). Для Get/List/Delete игнорируется —
    tenant_id в теле запроса.
Permissions: Create/Ensure → write; Get/List → read; Delete → delete.
---------------------------------------------------------------------------

| Method Name | Request Type | Response Type | Description |
| ----------- | ------------ | ------------- | ------------|
| CreateTenant | [CreateTenantRequest](#chat3-integrator-CreateTenantRequest) | [CreateTenantResponse](#chat3-integrator-CreateTenantResponse) | Создать tenant. tenant_id пустой → автогенерация tnt_XXXXXXXX. |
| EnsureTenant | [EnsureTenantRequest](#chat3-integrator-EnsureTenantRequest) | [EnsureTenantResponse](#chat3-integrator-EnsureTenantResponse) | Идемпотентный провижининг: если tenant_id есть — вернуть; иначе создать. Без tenant_id всегда создаёт новый (как CreateTenant). |
| GetTenant | [GetTenantRequest](#chat3-integrator-GetTenantRequest) | [GetTenantResponse](#chat3-integrator-GetTenantResponse) | Получить tenant по id (&#43; meta). |
| ListTenants | [ListTenantsRequest](#chat3-integrator-ListTenantsRequest) | [ListTenantsResponse](#chat3-integrator-ListTenantsResponse) | Список всех tenants (пагинация). |
| DeleteTenant | [DeleteTenantRequest](#chat3-integrator-DeleteTenantRequest) | [DeleteTenantResponse](#chat3-integrator-DeleteTenantResponse) | Удалить tenant &#43; его entity meta (без cascade users/dialogs). |

 



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

