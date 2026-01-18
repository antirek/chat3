# @chat3/user-grpc-server

gRPC сервер для пользователей Chat3

## Описание

gRPC сервер, предоставляющий интерфейс для работы с диалогами, сообщениями и получением обновлений в реальном времени через streaming.

## Установка

```bash
npm install
npm run build
```

## Запуск

```bash
npm start
```

Или через корневой package.json:

```bash
npm run start:user-grpc-server
```

## Конфигурация

Настройка через переменные окружения:

- `GRPC_HOST` - хост gRPC сервера (по умолчанию `0.0.0.0`)
- `GRPC_PORT` - порт gRPC сервера (по умолчанию `50051`)
- `TENANT_API_URL` - URL tenant-api (обязательно, например `http://localhost:3000`)
- `RABBITMQ_URL` - URL RabbitMQ (обязательно, например `amqp://localhost:5672`)

## gRPC Server Reflection

Сервер поддерживает **gRPC Server Reflection**, что позволяет инструментам автоматически обнаруживать доступные сервисы и методы без необходимости загрузки `.proto` файлов.

### Поддерживаемые инструменты

После запуска сервера вы можете использовать следующие инструменты для исследования API:

1. **Kreya** (GUI клиент)
   - Подключитесь к `localhost:50051`
   - Включите "Use Server Reflection"
   - Автоматически загрузит все доступные методы

2. **grpcurl** (CLI инструмент)
   ```bash
   # Список всех сервисов
   grpcurl -plaintext localhost:50051 list
   
   # Описание сервиса
   grpcurl -plaintext localhost:50051 describe chat3.user.Chat3UserService
   
   # Вызов метода
   grpcurl -plaintext -H "x-api-key: YOUR_KEY" -H "x-tenant-id: tnt_default" -H "x-user-id: user_1" \
     -d '{"page": 1, "limit": 10}' \
     localhost:50051 chat3.user.Chat3UserService/GetUserDialogs
   ```

3. **Postman**
   - Создайте новый gRPC запрос
   - Укажите адрес: `localhost:50051`
   - Включите "Server Reflection"
   - Автоматически загрузит методы и типы

4. **grpcui** (Веб-интерфейс)
   ```bash
   # Запуск через скрипт (автоматически установит grpcui, если его нет)
   ./start-grpcui.sh
   
   # Или вручную (требует Go)
   go install github.com/fullstorydev/grpcui/cmd/grpcui@latest
   grpcui -plaintext localhost:50051
   ```
   Откроется браузер с веб-интерфейсом для вызова методов (по умолчанию на http://localhost:8080).

## Методы API

### GetUserDialogs
Получить диалоги пользователя

**Метаданные:**
- `x-api-key` - API ключ (обязательно)
- `x-tenant-id` - ID тенанта (обязательно)
- `x-user-id` - ID пользователя (обязательно)

**Параметры:**
- `page` - номер страницы (по умолчанию 1)
- `limit` - количество элементов (по умолчанию 10)
- `filter` - фильтр в формате операторов
- `sort` - сортировка в формате JSON
- `include_last_message` - включить последнее сообщение

### GetDialogMessages
Получить сообщения диалога

**Метаданные:**
- `x-api-key` - API ключ (обязательно)
- `x-tenant-id` - ID тенанта (обязательно)
- `x-user-id` - ID пользователя (обязательно)

**Параметры:**
- `dialog_id` - ID диалога (обязательно)
- `page` - номер страницы (по умолчанию 1)
- `limit` - количество элементов (по умолчанию 10)
- `filter` - фильтр
- `sort` - сортировка

### SendMessage
Отправить сообщение

**Метаданные:**
- `x-api-key` - API ключ (обязательно)
- `x-tenant-id` - ID тенанта (обязательно)

**Параметры:**
- `dialog_id` - ID диалога (обязательно)
- `sender_id` - ID отправителя (обязательно)
- `content` - содержимое сообщения (обязательно)
- `type` - тип сообщения (по умолчанию `internal.text`)
- `meta` - метаданные (Struct)
- `idempotency_key` - ключ идемпотентности (опционально)

### SubscribeUpdates
Подписка на обновления (server streaming)

**Метаданные:**
- `x-api-key` - API ключ (обязательно)
- `x-tenant-id` - ID тенанта (обязательно)
- `x-user-id` - ID пользователя (обязательно)

**Возвращает:** stream Update

Первое сообщение - Update с `eventType="connection.established"` и `connId` в `data`.

## Структура проекта

```
packages/user-grpc-server/
# Proto файлы находятся в @chat3/user-grpc-proto (packages-shared/proto/)
├── src/
│   ├── config/                 # Конфигурация
│   ├── handlers/               # gRPC handlers
│   ├── services/               # Бизнес-логика
│   │   # Использует @chottodev/chat3-tenant-api-client (Chat3Client)
│   │   └── rabbitmqClient.ts   # RabbitMQ клиент
│   ├── utils/                  # Утилиты
│   └── index.ts                # Точка входа
├── package.json
└── tsconfig.json
```

## RabbitMQ

Сервер подключается к RabbitMQ и создает очереди для каждого соединения:
- Формат очереди: `user_{userId}_conn_{connId}_updates`
- TTL очереди: 1 час
- Routing key: `update.*.{userType}.{userId}.*`
- Exchange: `chat3_updates`

## Логирование

Все ошибки логируются в `console.log` с подробной информацией.
