# User2User Demo Application

Демо-приложение для демонстрации переписки между двумя пользователями через gRPC интерфейс.

## Обзор

**User2User** - это демо-приложение, которое показывает работу gRPC сервера в реальном времени. Приложение состоит из двух панелей чата (для User 1 и User 2), где пользователи могут отправлять сообщения друг другу через gRPC сервер.

## Архитектура

```
┌─────────────────────────────────────────┐
│  Vue3 Frontend (user2user-frontend)     │
│  ┌──────────┐      ┌──────────┐        │
│  │ User 1   │      │ User 2   │        │
│  │ Panel    │      │ Panel    │        │
│  └────┬─────┘      └────┬─────┘        │
│       │                 │               │
│       └────────┬────────┘               │
│                │ HTTP REST              │
│                │ WebSocket              │
└────────────────┼────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│  Express Backend (user2user-backend)    │
│  - HTTP → gRPC конвертация              │
│  - WebSocket → gRPC Stream              │
│  - Статика Vue приложения               │
└────────────────┬────────────────────────┘
                 │ gRPC
┌────────────────▼────────────────────────┐
│  gRPC Server (user-grpc-server)        │
└────────────────┬────────────────────────┘
                 │
         ┌───────┴───────┐
         │               │
    tenant-api      RabbitMQ
```

## Структура проекта

```
demo-apps/user2user/
├── backend/
│   ├── src/
│   │   ├── index.ts              # Express server
│   │   ├── config/
│   │   │   └── index.ts          # Конфигурация
│   │   ├── routes/
│   │   │   ├── api.ts            # REST API routes
│   │   │   └── websocket.ts      # WebSocket handler
│   │   ├── services/
│   │   │   ├── grpcClient.ts     # gRPC client wrapper
│   │   │   └── tenantApi.ts      # Tenant API client (для получения списка пользователей)
│   │   └── utils/
│   │       └── converter.ts      # Struct/timestamp конвертация
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── main.ts               # Vue app entry
│   │   ├── App.vue               # Главный компонент
│   │   ├── components/
│   │   │   ├── TenantSelector.vue
│   │   │   ├── UserSelector.vue
│   │   │   ├── ChatPanel.vue
│   │   │   ├── MessageList.vue
│   │   │   ├── MessageInput.vue
│   │   │   └── MessageBubble.vue
│   │   ├── composables/
│   │   │   ├── useWebSocket.ts   # WebSocket логика
│   │   │   ├── useChat.ts        # Чат логика
│   │   │   └── useGrpcApi.ts     # HTTP API клиент
│   │   └── types/
│   │       └── index.ts          # TypeScript типы
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
│
├── package.json                  # Root package для workspace
└── README.md
```

## Функциональность

### Frontend (Vue3 Composition API)

**Компоненты:**
1. **TenantSelector.vue** - Выбор тенанта (хардкод: `tnt_default`)
2. **UserSelector.vue** - Выбор User 1 и User 2 (хардкод для демо)
3. **ChatPanel.vue** (x2) - Панель чата для каждого пользователя
   - **MessageList.vue** - Список сообщений
   - **MessageInput.vue** - Форма ввода
   - **MessageBubble.vue** - Отображение сообщения
4. **ApiKeyInput.vue** - Поле ввода API Key (с сохранением в localStorage)

**Состояние:**
- `apiKey` - API Key (из localStorage, можно изменить через UI)
- `tenantId` - ID тенанта (хардкод: `tnt_default`)
- `user1` - User ID первого пользователя (выбор из хардкод списка)
- `user2` - User ID второго пользователя (выбор из хардкод списка)
- `dialogId` - ID диалога между пользователями
- Массив сообщений для каждого пользователя
- WebSocket соединения (2 шт. - по одному на каждого пользователя)

**Хранилище:**
- API Key сохраняется в `localStorage` с ключом `user2user_api_key`
- При загрузке приложения API Key автоматически загружается из localStorage

**Стилизация:**
- Простой CSS (без фреймворков)
- Две панели чата side-by-side
- Сообщения: левое выравнивание для входящих, правое для исходящих

### Backend (Express + WebSocket)

**Функции:**
1. HTTP REST API → gRPC конвертация
2. WebSocket → gRPC Stream для SubscribeUpdates
3. Хостинг статики Vue приложения (production build)
4. Конфигурация через env vars

**Эндпоинты:**

```
GET  /api/config                    # Конфигурация для фронтенда
POST /api/dialogs                   # Создать/найти диалог между user1 и user2
GET  /api/dialogs/:dialogId         # Получить диалог
GET  /api/dialogs/:dialogId/messages # Получить сообщения (через gRPC)
POST /api/dialogs/:dialogId/messages # Отправить сообщение (через gRPC)
WS   /ws/updates/:userId            # WebSocket для обновлений (через gRPC stream)
```

**Примечание:** Backend работает только с gRPC сервером, не взаимодействует напрямую с tenant-api для получения списка пользователей.

**Статика:**
- Production build фронтенда отдается через Express
- Dev режим: билд фронтенда, затем запуск backend

### Backend (Express + WebSocket)

**Функции:**
1. HTTP REST API → gRPC конвертация
2. WebSocket → gRPC Stream для SubscribeUpdates
3. Хостинг статики Vue приложения (production build)
4. Конфигурация через env vars

**Эндпоинты:**

```
GET  /api/config                    # Конфигурация для фронтенда
POST /api/dialogs                   # Создать/найти диалог между user1 и user2
GET  /api/dialogs/:dialogId         # Получить диалог
GET  /api/dialogs/:dialogId/messages # Получить сообщения (через gRPC)
POST /api/dialogs/:dialogId/messages # Отправить сообщение (через gRPC)
WS   /ws/updates/:userId            # WebSocket для обновлений (через gRPC stream)
```

**Примечание:** Backend работает только с gRPC сервером, не взаимодействует напрямую с tenant-api для получения списка пользователей.

**Статика:**
- Production build фронтенда отдается через Express
- Dev режим: билд фронтенда, затем запуск backend

## Технические детали

### Конфигурация

**Backend:**
- Порт: `USER2USER_PORT` (env var, по умолчанию 4000)
- gRPC Server URL: `GRPC_SERVER_URL` (env var, по умолчанию `localhost:50051`)
- Tenant API URL: `TENANT_API_URL` (env var, по умолчанию `http://localhost:3000`)

**Frontend:**
- Backend API URL: определяется автоматически (relative paths)
- WebSocket URL: определяется автоматически (текущий host)

### Обработка данных

**Struct конвертация:**
- `google.protobuf.Struct` ↔ JSON объект
- Backend автоматически конвертирует при обмене с gRPC

**Timestamps:**
- `double` (микросекунды) ↔ JavaScript `Date` / timestamp
- Frontend конвертирует для отображения

### WebSocket формат

Сообщения WebSocket передаются в формате JSON:
```json
{
  "update_id": "...",
  "tenant_id": "tnt_default",
  "user_id": "user_1",
  "entity_id": "...",
  "event_type": "message.create",
  "data": {
    "message": {
      "message_id": "...",
      "content": "...",
      ...
    }
  },
  "created_at": 1768646940187
}
```

### Диалог между пользователями

- При первом запуске автоматически создается диалог между user1 и user2
- Если диалог уже существует, используется существующий (через gRPC GetUserDialogs)
- Диалог содержит только двух участников (user1 и user2)
- Создание диалога происходит через gRPC SendMessage (если диалог не найден)

## Установка и запуск

### Требования

1. Node.js 20+
2. Запущенный gRPC сервер (`npm run start:user-grpc-server`)
3. Запущенный tenant-api (для создания пользователей и диалогов)
4. Запущенный RabbitMQ (для обновлений в реальном времени)

### Установка зависимостей

```bash
cd demo-apps/user2user
npm install
```

### Разработка

```bash
# Запуск в dev режиме (билд фронтенда + запуск backend)
# Эта команда автоматически билдит фронтенд и запускает backend,
# который хостит билд фронтенда
npm run dev

# Или раздельно:
npm run build:frontend  # Билд фронтенда
npm run start:backend   # Запуск backend
```

### Production

```bash
npm run build          # Билд фронтенда
npm run start          # Запуск backend (хостит статику)
```

## Использование

1. Запустите приложение: `npm run dev`
2. Откройте в браузере: `http://localhost:4000`
3. Введите API Key в поле ввода вверху страницы (сохранится в localStorage)
4. Tenant будет выбран автоматически (`tnt_default`)
5. Выберите User 1 и User 2 из списка (хардкод, предопределенные пользователи)
6. При первом запуске автоматически создастся диалог между выбранными пользователями
7. Начните отправлять сообщения через обе панели чата
8. Сообщения будут отображаться в реальном времени через WebSocket для обоих пользователей

## API Key

- API Key вводится через UI (поле ввода вверху страницы)
- Сохраняется в `localStorage` с ключом `user2user_api_key`
- При следующем открытии приложения API Key автоматически загружается из localStorage
- Используется для всех gRPC запросов через метаданные (`x-api-key`)
- Можно изменить API Key в любой момент (новое значение сохранится в localStorage)

## Список пользователей (хардкод)

Для демо используются предопределенные пользователи (хардкод во фронтенде):

```typescript
const DEMO_USERS = [
  { userId: 'user_1', name: 'User 1' },
  { userId: 'user_2', name: 'User 2' },
  // Можно добавить больше для тестирования
];
```

**Примечание:** 
- Эти пользователи должны существовать в tenant-api перед использованием
- Список пользователей не загружается через API, используется только хардкод
- Для демо достаточно работы только через gRPC интерфейс


## Планы развития

- [ ] Добавить выбор из реального списка пользователей через tenant-api
- [ ] Добавить поддержку нескольких диалогов
- [ ] Добавить отображение статусов сообщений (read, delivered)
- [ ] Добавить поддержку реакций на сообщения
- [ ] Добавить индикатор печати
- [ ] Улучшить UI/UX дизайн
- [ ] Добавить темную тему

## Структура workspace

Демо-приложение размещается в `demo-apps/user2user/` для отделения от основных пакетов проекта, но с сохранением общей структуры монorepo.

**Корневой package.json workspace:**
```json
{
  "workspaces": [
    "packages/*",
    "packages-shared/*",
    "demo-apps/user2user"
  ]
}
```

**Структура workspace:**
- `demo-apps/user2user/` - один workspace
- `backend/` - Express backend (TypeScript)
- `frontend/` - Vue3 frontend (TypeScript/Vue SFC)

## Команды запуска

### Root package.json

```json
{
  "scripts": {
    "start:user2user": "npm run dev --workspace=demo-apps/user2user"
  }
}
```

### user2user/package.json

```json
{
  "scripts": {
    "dev": "npm run build:frontend && npm run start:backend",
    "build:frontend": "cd frontend && npm run build",
    "start:backend": "cd backend && npm run start",
    "build": "npm run build:frontend",
    "start": "npm run build:frontend && npm run start:backend"
  }
}
```

**Примечание:** Команда `npm run dev` автоматически:
1. Билдит фронтенд (`npm run build:frontend`)
2. Запускает backend (`npm run start:backend`)
3. Backend хостит билд фронтенда из `frontend/dist/`
