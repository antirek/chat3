# User ConnectRPC Server

ConnectRPC сервер для Chat3 User Service. Параллельная реализация на ConnectRPC (в дополнение к gRPC версии).

## Особенности

- **HTTP порт**: 8080 (в отличие от gRPC на 50051)
- **Express + ConnectRPC**: Использует Express для HTTP сервера и ConnectRPC для RPC
- **JSON по умолчанию**: Поддержка JSON сериализации для удобной отладки
- **CORS**: Настроен для браузерных запросов
- **Прямые вызовы из браузера**: Можно вызывать напрямую без прокси
- **Swagger UI**: Веб-интерфейс для просмотра и тестирования API

## Установка

```bash
npm install
```

## Сборка

```bash
npm run build
```

## Запуск

### Через скрипт

```bash
./start-user-connectrpc-server.sh
```

### Через npm

```bash
npm start
```

### Переменные окружения

- `CONNECT_HTTP_HOST` - HTTP хост (по умолчанию: `0.0.0.0`)
- `CONNECT_HTTP_PORT` - HTTP порт (по умолчанию: `8080`)
- `TENANT_API_URL` - URL Tenant API (по умолчанию: `http://localhost:3000`)
- `RABBITMQ_URL` - URL RabbitMQ (по умолчанию: `amqp://localhost:5672`)

## API Endpoints

- Health check: `GET /health`
- Swagger UI: `GET /api-docs` - Веб-интерфейс для просмотра и тестирования API (как Swagger UI)
- ConnectRPC endpoints: `/chat3.user.Chat3UserService/*`

## Swagger UI

Сервер включает **Swagger UI** для интерактивного просмотра и тестирования API:

- **URL**: http://localhost:8080/api-docs
- **Описание**: Веб-интерфейс для просмотра всех методов ConnectRPC API
- **Возможности**:
  - Просмотр всех доступных методов
  - Интерактивное тестирование методов
  - Отправка запросов с параметрами
  - Просмотр ответов

## Методы

- `GetUserDialogs` - Получить диалоги пользователя (unary)
- `GetDialogMessages` - Получить сообщения диалога (unary)
- `SendMessage` - Отправить сообщение (unary)
- `SubscribeUpdates` - Подписка на обновления (server streaming)

## Headers

Все методы требуют следующие headers:
- `x-api-key` - API ключ
- `x-tenant-id` - ID тенанта
- `x-user-id` - ID пользователя (для некоторых методов)

## Пример использования

```bash
# Health check
curl http://localhost:8080/health

# Swagger UI (откройте в браузере)
open http://localhost:8080/api-docs

# GetUserDialogs
curl -X POST http://localhost:8080/chat3.user.Chat3UserService/GetUserDialogs \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -H "x-tenant-id: tnt_default" \
  -H "x-user-id: user1" \
  -d '{"page": 1, "limit": 10}'
```

## Отличия от gRPC версии

1. **Порт**: HTTP 8080 вместо gRPC 50051
2. **Протокол**: ConnectRPC поверх HTTP вместо gRPC
3. **Сериализация**: JSON по умолчанию (можно использовать binary)
4. **Браузерная поддержка**: Прямые вызовы из браузера без прокси
5. **Отладка**: Удобная отладка через DevTools (JSON виден)
6. **Swagger UI**: Встроенный веб-интерфейс для просмотра API

## TODO

- [ ] Генерация OpenAPI спецификации из proto файла (сейчас используется минимальная спецификация)
- [ ] Использование interceptors для передачи RabbitMQ клиента
- [ ] Реализация отправки обновлений из RabbitMQ в async generator
- [ ] Типизация handlers через сгенерированные типы
