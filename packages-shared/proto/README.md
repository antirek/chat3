# @chat3/user-grpc-proto

Protocol Buffers определения для gRPC User Service в Chat3.

## Описание

Этот пакет содержит общие `.proto` файлы для gRPC сервиса пользователей, которые используются как в `user-grpc-server`, так и в `user-grpc-client-ts`.

## Структура

```
packages-shared/proto/
├── src/
│   └── chat3_user.proto  # Определения gRPC сервиса для пользователей
├── package.json
└── README.md
```

## Использование

### В user-grpc-server

```typescript
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Используйте путь к proto файлу из пакета
const PROTO_PATH = path.join(__dirname, '../../packages-shared/proto/src/chat3_user.proto');
```

### В user-grpc-client-ts

```typescript
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Используйте путь к proto файлу из пакета
const PROTO_PATH = path.join(__dirname, '../../packages-shared/proto/src/chat3_user.proto');
```

## Преимущества

1. **Единый источник истины** - proto файлы определены в одном месте
2. **Синхронизация** - изменения автоматически доступны и серверу, и клиенту
3. **Версионирование** - версия proto синхронизирована с версией пакета
4. **Переиспользование** - proto файлы могут использоваться в других пакетах при необходимости
