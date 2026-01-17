# Инструкция по тестированию gRPC клиента

## Предварительные требования

1. **Запущен tenant-api** (порт 3000)
2. **Запущен update-worker** (для обработки событий и создания updates)
3. **Запущен RabbitMQ** (для очередей обновлений)
4. **Запущен user-grpc-server** (порт 50051)
5. **API ключ** для аутентификации
6. **Диалог с двумя участниками** (user_1 и user_2)

## Быстрый старт

### 1. Запустить gRPC сервер

```bash
cd packages/user-grpc-server
npm run build
npm start
```

Или через корневой package.json:

```bash
npm run start:user-grpc-server
```

### 2. Установить переменные окружения

```bash
export API_KEY="your-api-key-here"
export DIALOG_ID="dlg_xxxxxxxxxxxxxxxxxxxx"  # ID существующего диалога
export USER_1_ID="user_1"  # ID первого пользователя (по умолчанию)
export USER_2_ID="user_2"  # ID второго пользователя (по умолчанию)
export TENANT_ID="tnt_default"  # ID тенанта (по умолчанию)
export GRPC_SERVER_URL="localhost:50051"  # URL gRPC сервера (по умолчанию)
```

### 3. Запустить тест

```bash
cd packages/user-grpc-client-ts
npm run build
npm test
```

Или через скрипт:

```bash
./test-grpc.sh
```

## Что тестируется

1. ✅ Подключение двух пользователей к gRPC серверу
2. ✅ Подписка обоих пользователей на updates (streaming)
3. ✅ Получение connection ID для каждого подключения
4. ✅ Отправка сообщений одним пользователем
5. ✅ Получение updates обоими пользователями в реальном времени

## Ожидаемый результат

```
🚀 Starting gRPC test...
📡 [user_1] Subscribing to updates...
📡 [user_2] Subscribing to updates...
✅ [user_1] Connected! connId: conn_abc12
✅ [user_2] Connected! connId: conn_xyz34

✅ Both users connected!

📋 [user_1] Getting dialogs...
✅ [user_1] Found 5 dialogs
   💬 First dialog: Test Dialog

📋 [user_1] Getting messages from dialog dlg_abc123...
✅ [user_1] Found 10 messages
   💬 Last message: Hello!

📨 Starting message sending test...

📤 [user_1] Sending message #1...
✅ [user_1] Message sent! messageId: msg_xxx

📩 [user_1] Update #2: message.create
   💬 Message: Привет! Это тестовое сообщение #1...
   👤 From: user_1

📩 [user_2] Update #2: message.create
   💬 Message: Привет! Это тестовое сообщение #1...
   👤 From: user_1

📊 Test Results:
   📤 Messages sent: 3
   📩 [user_1] Updates received: 4  (1 connection + 3 messages)
   📩 [user_2] Updates received: 4  (1 connection + 3 messages)

✅ Test PASSED! Both users received updates.
```

## Создание тестового диалога

Если у вас еще нет диалога с двумя пользователями, создайте его через tenant-api:

```bash
curl -X POST http://localhost:3000/api/dialogs \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -H "X-Tenant-ID: tnt_default" \
  -d '{
    "name": "Test Dialog",
    "createdBy": "user_1",
    "members": [
      {
        "userId": "user_1",
        "type": "user",
        "name": "User 1"
      },
      {
        "userId": "user_2",
        "type": "user",
        "name": "User 2"
      }
    ]
  }'
```

Сохраните `dialogId` из ответа и используйте его в переменной окружения `DIALOG_ID`.

## Устранение неполадок

### Ошибка: "Failed to connect"
- Проверьте, что gRPC сервер запущен на порту 50051
- Проверьте значение `GRPC_SERVER_URL`

### Ошибка: "x-user-id is required"
- Убедитесь, что переменные окружения установлены правильно
- Проверьте, что API_KEY валидный

### Ошибка: "Dialog not found"
- Создайте диалог с указанным `DIALOG_ID`
- Убедитесь, что оба пользователя являются участниками диалога

### Updates не приходят
- Проверьте, что `update-worker` запущен
- Проверьте подключение к RabbitMQ
- Проверьте логи gRPC сервера на наличие ошибок
