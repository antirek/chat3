# @chat3/user-grpc-proto

Proto-контракт интеграторского `Chat3UserService`.

- Auth: `x-api-key` (единственный credential)
- Tenant scope: `x-tenant-id` (не auth; ключ может любой tenant)
- Контекст пользователя: поле `user_id` в теле RPC
