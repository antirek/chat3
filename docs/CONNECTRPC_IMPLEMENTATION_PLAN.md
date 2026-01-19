# План реализации ConnectRPC варианта

## Обзор

Создание параллельного варианта с ConnectRPC для сравнения с текущим gRPC решением. ConnectRPC будет реализован в отдельных пакетах и демо приложении, не затрагивая существующую gRPC инфраструктуру.

## Цели

1. Создать `user-connectrpc-server` - ConnectRPC сервер (аналог `user-grpc-server`)
2. Создать `user-connectrpc-client-ts` - TypeScript клиент (аналог `user-grpc-client-ts`)
3. Создать `user2user-connectrpc` - демо приложение (аналог `user2user`)
4. Обеспечить возможность прямых вызовов из браузера без прокси
5. Использовать JSON по умолчанию для упрощения отладки
6. Сохранить совместимость с существующим proto файлом

## Структура пакетов

```
packages/
├── user-connectrpc-server/          # ConnectRPC сервер
│   ├── src/
│   │   ├── index.ts                 # Точка входа сервера
│   │   ├── config/                  # Конфигурация
│   │   │   └── index.ts
│   │   ├── handlers/                # Обработчики RPC методов
│   │   │   ├── getUserDialogs.ts
│   │   │   ├── getDialogMessages.ts
│   │   │   ├── sendMessage.ts
│   │   │   └── subscribeUpdates.ts
│   │   ├── services/                # Сервисы
│   │   │   └── rabbitmqClient.ts    # Переиспользовать из gRPC версии
│   │   └── utils/                   # Утилиты
│   │       ├── converter.ts         # Адаптация конвертеров
│   │       ├── errorMapper.ts       # Адаптация ошибок для Connect
│   │       └── connectionId.ts      # Переиспользовать
│   ├── package.json
│   ├── tsconfig.json
│   └── README.md
│
├── user-connectrpc-client-ts/       # ConnectRPC TypeScript клиент
│   ├── src/
│   │   ├── index.ts                 # Экспорт клиента
│   │   ├── Chat3ConnectClient.ts    # Основной клиент класс
│   │   └── generated/               # Сгенерированные типы из proto (buf)
│   ├── package.json
│   ├── tsconfig.json
│   └── README.md
│
demo-apps/
└── user2user-connectrpc/            # Демо приложение с ConnectRPC
    ├── backend/
    │   ├── src/
    │   │   ├── index.ts             # Express сервер (упрощенный)
    │   │   ├── config/
    │   │   │   └── index.ts
    │   │   └── routes/
    │   │       └── api.ts            # Минимальные роуты или прямые вызовы из фронта
    │   ├── package.json
    │   └── tsconfig.json
    │
    └── frontend/
        ├── src/
        │   ├── App.vue
        │   ├── components/
        │   ├── composables/
        │   │   └── useConnectApi.ts  # Композабл для ConnectRPC вызовов
        │   └── types/
        │       └── index.ts
        ├── package.json
        └── vite.config.ts
```

## Технические детали

### 1. Зависимости

#### `user-connectrpc-server`:
- `@connectrpc/connect` - Основная библиотека ConnectRPC для Node.js
- `@connectrpc/connect-node` - Адаптеры для Node.js (Express/Fastify)
- `@connectrpc/protoc-gen-connect-es` - Генерация кода из proto
- `@bufbuild/protobuf` - Protobuf для TypeScript
- `@bufbuild/protoc-gen-es` - Генерация TypeScript типов из proto
- `@chottodev/chat3-tenant-api-client` - Клиент Tenant API (переиспользовать)
- `amqplib` - RabbitMQ (переиспользовать)

#### `user-connectrpc-client-ts`:
- `@connectrpc/connect` - ConnectRPC клиент
- `@bufbuild/protobuf` - Protobuf типы
- Генерированные типы из proto файла

#### `user2user-connectrpc/backend`:
- `express` - HTTP сервер (только для статики фронтенда)
- Опционально: минимальные роуты, если нужны
- **НЕ нужен** Express прокси для API (фронтенд вызывает ConnectRPC напрямую)
- **НЕ нужен** WebSocket (используем ConnectRPC server streaming)

#### `user2user-connectrpc/frontend`:
- `vue` - Vue.js
- `@connectrpc/connect-web` - ConnectRPC клиент для браузера
- `@bufbuild/protobuf` - Protobuf типы

### 2. Генерация кода из proto

Используем `buf` для генерации TypeScript кода:

```bash
# Установка buf (если еще не установлен)
curl -sSL "https://github.com/bufbuild/buf/releases/latest/download/buf-Linux-x86_64" -o ~/.local/bin/buf
chmod +x ~/.local/bin/buf

# buf.gen.yaml в packages/user-connectrpc-server и packages/user-connectrpc-client-ts
```

Генерация будет создавать:
- TypeScript типы для сообщений
- ConnectRPC сервисы и клиенты
- Type-safe интерфейсы

### 3. Ключевые отличия ConnectRPC от gRPC

#### Серверная часть:
- Используется `@connectrpc/connect-node` вместо `@grpc/grpc-js`
- Handlers возвращают Promise вместо callback
- Ошибки выбрасываются как обычные Error, а не через callback
- Используются сгенерированные типы из proto

#### Клиентская часть:
- Вызовы как обычные async функции
- Можно использовать напрямую из браузера
- JSON сериализация по умолчанию (опционально binary)
- Нет необходимости в metadata callback pattern

#### Streaming:
- ConnectRPC поддерживает server streaming
- Используется async iterable или Observable pattern

### 4. Особенности реализации

#### ConnectRPC сервер:
- Используем Express с `@connectrpc/connect-node/express` адаптером
- Или используем Fastify с соответствующим адаптером
- Handlers получают `ConnectRouter` вместо gRPC Server
- Методы регистрируются через router с типизированными handlers

#### ConnectRPC клиент:
- Клиент создается с base URL (HTTP endpoint)
- Headers передаются через опции вызова (не через context в клиенте)
- Вызовы методов как обычные async функции с типизированными параметрами
- Пример: `client.getUserDialogs(request, { headers: { 'x-api-key': '...' } })`

#### Прямые вызовы из браузера:
- Фронтенд вызывает ConnectRPC напрямую через `@connectrpc/connect-web`
- **Нет необходимости** в Express прокси для HTTP запросов (ключевое преимущество!)
- Используем ConnectRPC server streaming для updates (не WebSocket)
- CORS настроен на ConnectRPC сервере для разрешения браузерных запросов

## Пошаговый план реализации

### Этап 1: Настройка buf и генерация кода

1. Установить `buf` CLI
2. Создать `buf.gen.yaml` в `packages-shared/proto/`
3. Настроить генерацию TypeScript типов и ConnectRPC сервисов
4. Сгенерировать код для сервера и клиента

### Этап 2: Создание `user-connectrpc-server`

1. Создать структуру пакета
2. Скопировать и адаптировать:
   - `config/index.ts` - конфигурация (адаптировать для HTTP порта)
   - `services/rabbitmqClient.ts` - переиспользовать как есть
   - `utils/connectionId.ts` - переиспользовать как есть
   - `utils/converter.ts` - адаптировать для Connect типов
   - `utils/errorMapper.ts` - адаптировать для Connect ошибок
3. Создать handlers:
   - Адаптировать каждый handler для ConnectRPC API
   - Изменить сигнатуру (Promise вместо callback)
   - Использовать сгенерированные типы
4. Создать `src/index.ts`:
   - Инициализировать Express сервер
   - Настроить CORS middleware для браузерных запросов
   - Подключить ConnectRPC router через `@connectrpc/connect-node/express`
   - Зарегистрировать handlers
   - Запустить HTTP сервер на порту 8080
5. Настроить `package.json` и `tsconfig.json`
6. Создать `start-user-connectrpc-server.sh` скрипт

### Этап 3: Создание `user-connectrpc-client-ts`

1. Создать структуру пакета
2. Создать `Chat3ConnectClient.ts`:
   - Использовать сгенерированные типы
   - Создать клиент через `createPromiseClient` (для Node.js) или `createPromiseClient` + `createConnectTransport` (для браузера)
   - Реализовать методы: `getUserDialogs`, `getDialogMessages`, `sendMessage`, `subscribeUpdates`
   - Использовать типизированные параметры
   - Передавать headers (apiKey, tenantId, userId) через опции вызова
   - Для streaming: использовать async iterable pattern
3. Экспортировать клиент и типы
4. Настроить `package.json` и `tsconfig.json`
5. Создать README с примерами использования

### Этап 4: Создание `user2user-connectrpc` демо приложения

#### Backend (минимальный):
1. Создать структуру
2. Создать упрощенный Express сервер:
   - Только для статической раздачи фронтенда
   - **НЕ нужны** API роуты (фронтенд вызывает ConnectRPC напрямую)
   - Опционально: минимальные роуты для конфигурации (например, `/api/config`)
3. Настроить статическую раздачу фронтенда из `frontend/dist`
4. **НЕ используем** WebSocket (используем ConnectRPC server streaming)

#### Frontend:
1. Скопировать структуру из `user2user/frontend`
2. Создать `composables/useConnectApi.ts`:
   - Использовать `@connectrpc/connect-web` для браузерного клиента
   - Создать клиент с base URL на ConnectRPC сервер (http://localhost:8080)
   - Прямые вызовы из браузера (без Express прокси)
   - Реализовать методы: `getUserDialogs`, `getDialogMessages`, `sendMessage`
   - Реализовать `subscribeUpdates` через ConnectRPC server streaming (async iterable)
   - Передавать headers (apiKey, tenantId, userId) при каждом вызове
3. Обновить `App.vue`:
   - Использовать новый композабл `useConnectApi`
   - Убрать зависимость от Express API роутов (полностью прямые вызовы)
   - Адаптировать streaming для обновлений (ConnectRPC streaming вместо WebSocket)
4. Обновить компоненты (если нужно)
5. **Ключевое отличие**: Этот фронтенд будет отдельным приложением для архитектурного сравнения с `user2user` (gRPC вариант)

### Этап 5: Тестирование и документация

1. Протестировать все методы:
   - GetUserDialogs
   - GetDialogMessages
   - SendMessage
   - SubscribeUpdates (streaming)
2. Проверить работу из браузера (прямые вызовы)
3. Проверить JSON формат (по умолчанию)
4. Проверить CORS (браузерные запросы работают)
5. **Архитектурное сравнение**:
   - Запустить оба фронтенда параллельно (`user2user` и `user2user-connectrpc`)
   - Сравнить код и подходы:
     - Простота API вызовов
     - Обработка streaming
     - Обработка ошибок
     - Отладка (JSON в DevTools)
     - Зависимости (Express прокси vs прямые вызовы)
6. Обновить README файлы с примерами
7. Создать документ сравнения в `docs/`

## Принятые решения

### 1. Порт сервера
✅ **Решение: HTTP порт 8080**
- ConnectRPC работает поверх HTTP/1.1 или HTTP/2
- Используем Express для сервера
- Порт: 8080 (отдельно от gRPC сервера на 50051)

### 2. Streaming обновления
✅ **Решение: ConnectRPC server streaming**
- Используем нативный ConnectRPC server streaming для `SubscribeUpdates`
- HTTP/2 или HTTP/1.1 с chunked transfer encoding
- Позволит напрямую сравнивать с gRPC streaming подходом

### 3. Фронтенд архитектура
✅ **Решение: Прямые вызовы из браузера**
- Фронтенд вызывает ConnectRPC напрямую через `@connectrpc/connect-web`
- Нет необходимости в Express прокси для API запросов
- Backend используется только для статики (если нужно)
- Это ключевое архитектурное преимущество ConnectRPC для сравнения

### 4. CORS
✅ **Решение: Настроить CORS**
- Настроить CORS на ConnectRPC сервере для браузерных запросов
- Разрешить origin фронтенда
- Разрешить необходимые headers (x-api-key, x-tenant-id, x-user-id)

### 5. Аутентификация
✅ **Решение: Через HTTP headers**
- Передавать `apiKey`, `tenantId`, `userId` через HTTP headers:
  - `x-api-key`
  - `x-tenant-id`
  - `x-user-id`
- Аналогично gRPC metadata, но через стандартные HTTP headers

#### Что такое context в ConnectRPC?

**Context** в ConnectRPC — это объект (обычно типа `ContextValues` или расширенный через interceptors), который передается через цепочку вызовов и содержит:
- **HTTP headers** запроса (read-only)
- **Метаданные**, которые можно установить в interceptors/middleware
- **Значения**, которые можно передавать между слоями приложения (interceptors → handlers)

**Отличия от gRPC metadata:**
- В gRPC: `metadata` — это отдельный объект, передается явно через callback
- В ConnectRPC: `context` — это неявный параметр, автоматически передается через вызовы

**Пример использования:**

```typescript
// В ConnectRPC interceptor (middleware)
function authInterceptor(next: NextFn) {
  return (req: ConnectRouter) => {
    const apiKey = req.header.get('x-api-key'); // Читаем из headers
    // Можем добавить в context для использования в handler
    req.context.set('apiKey', apiKey);
    return next(req);
  };
}

// В handler
async function getUserDialogs(req: GetUserDialogsRequest, context: ConnectRouter) {
  const apiKey = context.context.get('apiKey'); // Читаем из context
  // или напрямую из headers
  const userId = context.header.get('x-user-id');
}
```

**Почему используем headers, а не context:**
- Headers — стандартный HTTP механизм, понятен для фронтенда
- Проще отлаживать в DevTools (видим headers в Network tab)
- Совместимо с существующим gRPC подходом (metadata → headers)
- Context больше подходит для внутренней передачи данных между слоями сервера

### 6. Сравнительные тесты
✅ **Решение: Архитектурное сравнение вместо производительности**
- **Не нужны** сравнительные тесты производительности на данном этапе
- Фокус на **архитектурных различиях**:
  - Простота кода и API
  - Удобство отладки (JSON vs Binary)
  - Интеграция с браузером (прямые вызовы)
  - Различие в обработке streaming
  - Различие в обработке ошибок
- Создадим **два отдельных фронтенд приложения**:
  - `demo-apps/user2user` — с gRPC (через Express прокси)
  - `demo-apps/user2user-connectrpc` — с ConnectRPC (прямые вызовы)
- Это позволит наглядно сравнить архитектурные подходы

## Зависимости и инструменты

### Необходимые npm пакеты:

```json
{
  "@connectrpc/connect": "^1.x.x",
  "@connectrpc/connect-node": "^1.x.x",
  "@connectrpc/connect-web": "^1.x.x",
  "@connectrpc/protoc-gen-connect-es": "^1.x.x",
  "@bufbuild/protobuf": "^1.x.x",
  "@bufbuild/protoc-gen-es": "^1.x.x",
  "buf": "^1.x.x"
}
```

### Команды для генерации:

```bash
# В packages/user-connectrpc-server
buf generate ../../../packages-shared/proto

# В packages/user-connectrpc-client-ts
buf generate ../../../packages-shared/proto
```

## Ожидаемые результаты

После реализации:

1. **Работающий ConnectRPC сервер** на HTTP порту 8080 (Express + CORS)
2. **TypeScript клиент** (`user-connectrpc-client-ts`) с типизированным API
3. **Демо приложение** (`user2user-connectrpc`) с прямыми вызовами из браузера
4. **Архитектурное сравнение** двух подходов:
   - **gRPC вариант** (`user2user`): gRPC → Express прокси → фронтенд
   - **ConnectRPC вариант** (`user2user-connectrpc`): прямые HTTP вызовы из браузера
5. **Сравнение архитектурных аспектов**:
   - Простота кода (handlers, клиент, фронтенд)
   - Отладка (JSON в DevTools vs binary в прокси)
   - Интеграция с браузером (прямые вызовы vs прокси)
   - Streaming подход (ConnectRPC streaming vs WebSocket)
   - Обработка ошибок (HTTP статусы vs gRPC статусы)
6. **Два отдельных фронтенд приложения** для наглядного сравнения

## Дополнительные ресурсы

- [ConnectRPC документация](https://connectrpc.com/docs)
- [Buf документация](https://buf.build/docs)
- [Примеры ConnectRPC](https://github.com/connectrpc/examples)

## Примечания

- ConnectRPC совместим с gRPC и gRPC-Web, используем тот же `chat3_user.proto` файл
- Можно запускать оба сервера параллельно:
  - gRPC сервер на порту 50051 (для `user2user`)
  - ConnectRPC сервер на порту 8080 (для `user2user-connectrpc`)
- Два отдельных фронтенд приложения для наглядного архитектурного сравнения:
  - `demo-apps/user2user` — gRPC подход
  - `demo-apps/user2user-connectrpc` — ConnectRPC подход
- Фокус на архитектурных различиях, а не на производительности