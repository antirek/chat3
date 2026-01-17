# Быстрый старт тестирования gRPC

## 1. Запуск необходимых сервисов

```bash
# В корне проекта
./start-all.sh
# Или
npm run start:all
```

Это запустит:
- tenant-api (порт 3000)
- update-worker (для обработки событий)
- RabbitMQ (порт 5672)

## 2. Запуск gRPC сервера

```bash
# В корне проекта
npm run start:user-grpc-server

# Или в директории сервера
cd packages/user-grpc-server
npm run build
npm start
```

gRPC сервер запустится на порту 50051.

## 3. Подготовка данных

### Получить API ключ

```bash
npm run generate-key  # в корне проекта
```

### Создать тестовый диалог

```bash
curl -X POST http://localhost:3000/api/dialogs \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "X-Tenant-ID: tnt_default" \
  -d '{
    "name": "Test Dialog",
    "createdBy": "user_1",
    "members": [
      {"userId": "user_1", "type": "user", "name": "User 1"},
      {"userId": "user_2", "type": "user", "name": "User 2"}
    ]
  }'
```

Сохраните `dialogId` из ответа.

## 4. Запуск теста

```bash
cd packages/user-grpc-client-ts

# Установить переменные окружения
export API_KEY="your-api-key"
export DIALOG_ID="dlg_xxxxxxxxxxxxxxxxxxxx"

# Запустить тест
npm test

# Или через скрипт
./test-grpc.sh
```

## 5. Что должно произойти

1. ✅ Оба пользователя подключились к gRPC серверу
2. ✅ Оба получили connection ID
3. ✅ Оба подписались на updates
4. ✅ User 1 отправил 3 сообщения
5. ✅ Оба пользователя получили updates о каждом сообщении
6. ✅ Тест завершился успешно

## Полный пример запуска

```bash
# Терминал 1: Запуск всех сервисов
cd /home/sergey/Projects/tmp3/chat3
./start-all.sh

# Терминал 2: Запуск gRPC сервера
cd /home/sergey/Projects/tmp3/chat3
npm run start:user-grpc-server

# Терминал 3: Запуск теста
cd /home/sergey/Projects/tmp3/chat3/packages/user-grpc-client-ts
export API_KEY="your-api-key"
export DIALOG_ID="dlg_xxxxxxxxxxxxxxxxxxxx"
npm test
```

## Ожидаемый вывод

```
🚀 Starting gRPC test...
📡 gRPC Server: localhost:50051
👤 User 1: user_1
👤 User 2: user_2
💬 Dialog ID: dlg_abc123

📡 [user_1] Subscribing to updates...
📡 [user_2] Subscribing to updates...
✅ [user_1] Connected! connId: conn_abc12
✅ [user_2] Connected! connId: conn_xyz34

✅ Both users connected!

📤 [user_1] Sending message #1...
✅ [user_1] Message sent! messageId: msg_xxx

📩 [user_1] Update #2: message.create
   💬 Message: Привет! Это тестовое сообщение #1...
   👤 From: user_1

📩 [user_2] Update #2: message.create
   💬 Message: Привет! Это тестовое сообщение #1...
   👤 From: user_1

✅ Test PASSED! Both users received updates.
```
