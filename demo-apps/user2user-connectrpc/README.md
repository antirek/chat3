# User2User ConnectRPC Demo

Демо приложение для сравнения архитектурных решений ConnectRPC vs gRPC.

## Особенности

- **Прямые вызовы из браузера**: Фронтенд вызывает ConnectRPC напрямую, без Express прокси
- **ConnectRPC Server Streaming**: Используется ConnectRPC streaming для real-time обновлений вместо WebSocket
- **Минимальный backend**: Backend только для статической раздачи фронтенда

## Запуск

1. Запустить ConnectRPC сервер:
   ```bash
   ./start-user-connectrpc-server.sh
   ```

2. Запустить backend для статической раздачи:
   ```bash
   cd demo-apps/user2user-connectrpc/backend
   npm install
   npm run build
   npm start
   ```

3. Запустить frontend:
   ```bash
   cd demo-apps/user2user-connectrpc/frontend
   npm install
   npm run dev
   ```

Или использовать скрипт запуска (если создан):
```bash
./start-demo-user2user-connectrpc.sh
```

## Структура

- `backend/` - Минимальный Express сервер для статической раздачи фронтенда
- `frontend/` - Vue.js фронтенд с прямыми вызовами ConnectRPC из браузера

## Отличия от gRPC версии

1. **Прямые вызовы**: Фронтенд вызывает ConnectRPC напрямую, без Express прокси
2. **ConnectRPC Streaming**: Вместо WebSocket используется ConnectRPC server streaming
3. **CORS**: ConnectRPC сервер настроен на CORS для браузерных запросов
4. **Минимальный backend**: Backend только для статической раздачи, не для проксирования API
