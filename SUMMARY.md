# Chat3 - Полный обзор системы

## 📋 Краткое описание

Chat3 - это современная мультитенантная система управления диалогами и сообщениями с event-driven архитектурой, поддержкой RabbitMQ и MongoDB, готовая к контейнеризации через Docker.

## 🏗️ Архитектура

### Основные компоненты

```
┌─────────────────────────────────────────────────────┐
│                   Client Layer                      │
│  (Browser, Mobile App, Desktop Client)              │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP REST API
┌──────────────────────▼──────────────────────────────┐
│              API Server (Node.js + Express)         │
│  - AdminJS Panel                                     │
│  - REST API Endpoints                                │
│  - Swagger Documentation                             │
└───┬────────────────────────────┬────────────────────┘
    │                            │
    │ MongoDB                    │ RabbitMQ
    │                            │
┌───▼────────────────────┐  ┌───▼─────────────────────┐
│  MongoDB Database      │  │  RabbitMQ              │
│  - Dialogs             │  │  - chat3_events        │
│  - Messages            │  │  - chat3_updates       │
│  - Users               │  └────────┬───────────────┘
│  - Events              │           │
│  - Updates             │           │
│  - Tenants             │           │
└────────────────────────┘           │
                                     │
                       ┌─────────────▼─────────────┐
                       │   Update Worker           │
                       │  (Background Process)     │
                       │  - Обработка событий      │
                       │  - Создание updates       │
                       └───────────────────────────┘
```

### Event-Driven Flow

```
1. Client → API: POST /api/dialogs/:id/messages
2. API → MongoDB: Сохранить сообщение + создать событие
3. API → RabbitMQ: Опубликовать событие в chat3_events
4. API → Client: 201 Created
5. RabbitMQ → Worker: Доставить событие
6. Worker → MongoDB: Получить участников диалога
7. Worker → MongoDB: Создать updates для участников
8. Worker → RabbitMQ: Опубликовать updates в chat3_updates
9. RabbitMQ → Clients: Доставить персонализированные updates
```

## 📦 Структура проекта

```
chat3/
├── src/
│   ├── admin/              # AdminJS конфигурация
│   ├── config/             # Конфигурация (DB, Swagger)
│   ├── controllers/        # Бизнес-логика
│   │   ├── dialogController.js
│   │   ├── messageController.js
│   │   ├── dialogMemberController.js
│   │   ├── messageStatusController.js
│   │   ├── messageReactionController.js
│   │   ├── metaController.js
│   │   ├── tenantController.js
│   │   └── userDialogController.js
│   ├── models/             # MongoDB модели
│   │   ├── Tenant.js
│   │   ├── Dialog.js
│   │   ├── Message.js
│   │   ├── DialogMember.js
│   │   ├── MessageStatus.js
│   │   ├── MessageReaction.js
│   │   ├── Meta.js
│   │   ├── ApiKey.js
│   │   ├── Event.js
│   │   └── Update.js
│   ├── routes/             # API маршруты
│   ├── middleware/         # API Auth & Permissions
│   ├── utils/              # Утилиты
│   │   ├── eventUtils.js
│   │   ├── updateUtils.js
│   │   ├── rabbitmqUtils.js
│   │   ├── metaUtils.js
│   │   ├── queryParser.js
│   │   ├── unreadCountUtils.js
│   │   └── reactionUtils.js
│   ├── workers/            # Фоновые процессы
│   │   └── updateWorker.js
│   ├── scripts/            # Вспомогательные скрипты
│   │   ├── seed.js
│   │   ├── generateApiKey.js
│   │   └── generateDemoApiKey.js
│   ├── public/             # Тестовые интерфейсы
│   └── index.js            # Точка входа API сервера
│
├── Dockerfile              # Docker образ
├── docker-compose.yml      # Оркестрация контейнеров
├── .dockerignore           # Игнорируемые файлы
├── docker-build.sh         # Скрипт сборки
│
├── start.sh                # Запуск API сервера
├── start-worker.sh         # Запуск воркера
│
├── package.json            # NPM зависимости
├── README.md               # Основная документация
├── ARCHITECTURE.md         # Архитектура системы
├── DOCKER.md               # Docker deployment
├── WORKERS.md              # Документация по воркерам
├── EVENTS.md               # Система событий
├── FILTER_RULES.md         # Правила фильтрации
└── API.md                  # API документация
```

## 🚀 Основные возможности

### 1. Мультитенантность
- Изоляция данных по tenant'ам
- API Key аутентификация с permissions (read/write/delete)
- Поддержка множества организаций в одной БД

### 2. Диалоги и сообщения
- Приватные, групповые диалоги и каналы
- Текстовые сообщения, медиа-файлы
- Реакции на сообщения (эмодзи)
- Статусы доставки (unread/delivered/read)
- Счетчики непрочитанных сообщений

### 3. Гибкая система метаданных
- Произвольные key-value теги
- Поддержка для любых сущностей (dialogs, messages, users)
- Различные типы данных (string, number, boolean, array, object)

### 4. Event-Driven архитектура
- Аудит всех действий в системе (Events)
- Асинхронная обработка через RabbitMQ
- Персонализированные обновления (Updates)
- Масштабируемость через воркеры

### 5. Фильтрация и сортировка
- Сложные фильтры с операторами (eq, ne, in, gt, regex, exists)
- Фильтрация по метаданным
- Сортировка по полям участников диалога
- Пагинация

### 6. Docker готовность
- Multi-stage Dockerfile для оптимизации размера
- Docker Compose для оркестрации
- Healthcheck и автоматический перезапуск
- Поддержка внешних MongoDB и RabbitMQ

## 🔑 API Endpoints (ключевые)

### Tenants
- `GET/POST/PUT/DELETE /api/tenants`

### Dialogs
- `GET /api/dialogs` - Список диалогов с фильтрацией
- `POST /api/dialogs` - Создать диалог
- `GET /api/dialogs/:id` - Получить диалог
- `DELETE /api/dialogs/:id` - Удалить диалог

### Messages
- `GET /api/dialogs/:id/messages` - Сообщения диалога
- `POST /api/dialogs/:id/messages` - Отправить сообщение
- `GET /api/messages` - Глобальный список сообщений

### Dialog Members
- `POST /api/dialogs/:id/members/:userId/add` - Добавить участника
- `POST /api/dialogs/:id/members/:userId/remove` - Удалить участника

### Message Status
- `POST /api/messages/:id/status/:userId/:status` - Обновить статус

### Message Reactions
- `GET /api/messages/:id/reactions` - Получить реакции
- `POST /api/messages/:id/reactions` - Добавить реакцию
- `DELETE /api/messages/:id/reactions/:reactionId` - Удалить реакцию

### User Dialogs
- `GET /api/users/:userId/dialogs` - Диалоги пользователя
- Query param: `?includeLastMessage=true` - с последним сообщением

### Meta Tags (Universal)
- `GET /api/meta/:entityType/:entityId` - Все мета теги
- `GET /api/meta/:entityType/:entityId/:key` - Конкретный тег
- `PUT /api/meta/:entityType/:entityId/:key` - Установить тег
- `DELETE /api/meta/:entityType/:entityId/:key` - Удалить тег

## 🛠️ Технологический стек

- **Backend**: Node.js 18, Express.js 4
- **Database**: MongoDB 6+ с Mongoose ODM
- **Message Queue**: RabbitMQ 3+
- **Admin Panel**: AdminJS
- **API Docs**: Swagger/OpenAPI
- **Containerization**: Docker, Docker Compose
- **Auth**: API Key-based с permissions

## 📊 Модели данных

### Core Models
- **Tenant** - Организации/арендаторы
- **Dialog** - Диалоги (приватные/групповые/каналы)
- **Message** - Сообщения с поддержкой медиа
- **DialogMember** - Участники диалогов с unread счетчиками
- **MessageStatus** - Статусы доставки сообщений
- **MessageReaction** - Реакции на сообщения

### System Models
- **ApiKey** - API ключи с permissions
- **Event** - Аудит действий (внутренние)
- **Update** - Персонализированные обновления (внутренние)
- **Meta** - Гибкие метаданные для любых сущностей

## 🚀 Запуск

### Локально

```bash
# 1. Убедитесь что MongoDB и RabbitMQ запущены
mongosh mongodb://localhost:27017/chat3
rabbitmqctl status

# 2. Установите зависимости
npm install

# 3. Заполните БД (опционально)
npm run seed

# 4. Запустите API сервер
./start.sh

# 5. Запустите Update Worker
./start-worker.sh
```

### С Docker

```bash
# 1. Настройте переменные окружения
cp .env.docker.example .env.docker
nano .env.docker

# 2. Соберите образы
./docker-build.sh

# 3. Запустите контейнеры
docker-compose --env-file .env.docker up -d

# 4. Проверьте логи
docker-compose logs -f
```

## 📚 Документация

| Файл | Описание |
|------|----------|
| [README.md](README.md) | Основная документация, быстрый старт |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Подробная архитектура системы |
| [DOCKER.md](DOCKER.md) | Docker deployment guide |
| [QUICKSTART_DOCKER.md](QUICKSTART_DOCKER.md) | Быстрый старт с Docker |
| [DOCKER_FILES.md](DOCKER_FILES.md) | Обзор Docker файлов |
| [WORKERS.md](WORKERS.md) | Документация по фоновым воркерам |
| [EVENTS.md](EVENTS.md) | Система событий и аудита |
| [FILTER_RULES.md](FILTER_RULES.md) | Правила фильтрации и сортировки |
| [API.md](API.md) | API endpoints и примеры |

## 🔐 Безопасность

- ✅ API Key аутентификация
- ✅ Permissions система (read/write/delete)
- ✅ Изоляция данных по tenant'ам
- ✅ Валидация входных данных
- ✅ Непривилегированный пользователь в Docker
- ✅ Secrets не в образе

## ⚡ Производительность

- ✅ MongoDB индексы на часто используемые поля
- ✅ Асинхронная обработка событий
- ✅ Пагинация на всех списках
- ✅ Lean queries для оптимизации
- ✅ Projection для уменьшения объема данных

## 📈 Масштабирование

### Горизонтальное
- Запуск нескольких API серверов (за load balancer)
- Запуск нескольких воркеров (RabbitMQ балансирует нагрузку)
- MongoDB replica set для HA
- RabbitMQ кластер для отказоустойчивости

### Вертикальное
- Оптимизация запросов к БД
- Индексы для частых операций
- Кэширование (Redis в будущем)

## 🔧 Полезные команды

### Локальная разработка
```bash
npm start                    # API сервер
npm run dev                  # С hot-reload
./start-worker.sh            # Воркер
npm run seed                 # Заполнить БД
npm run generate-key         # Создать API ключ
```

### Docker
```bash
./docker-build.sh            # Собрать образ
docker-compose up -d         # Запустить
docker-compose logs -f       # Логи
docker-compose restart       # Перезапуск
docker-compose down          # Остановить
docker-compose ps            # Статус
```

### Отладка
```bash
# Логи API
docker-compose logs -f chat3-api

# Логи Worker
docker-compose logs -f chat3-worker

# Shell в контейнер
docker-compose exec chat3-api sh

# MongoDB shell
mongosh mongodb://localhost:27017/chat3

# RabbitMQ Management
# http://localhost:15672 (admin/admin)
```

## 🎯 Примеры использования

### 1. Создать диалог
```bash
curl -X POST http://localhost:3000/api/dialogs \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Dialog",
    "createdBy": "alice",
    "meta": {
      "type": "group",
      "topic": "Development"
    }
  }'
```

### 2. Отправить сообщение
```bash
curl -X POST http://localhost:3000/api/dialogs/DIALOG_ID/messages \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Hello, World!",
    "senderId": "alice",
    "type": "text"
  }'
```

### 3. Получить диалоги пользователя
```bash
curl http://localhost:3000/api/users/alice/dialogs?includeLastMessage=true \
  -H "X-API-Key: YOUR_API_KEY"
```

### 4. Добавить реакцию
```bash
curl -X POST http://localhost:3000/api/messages/MESSAGE_ID/reactions \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "bob",
    "reaction": "👍"
  }'
```

## 🌟 Лучшие практики

### API использование
1. Всегда включайте `X-API-Key` заголовок
2. Используйте пагинацию (`page`, `limit`)
3. Применяйте фильтры для оптимизации
4. Проверяйте коды ответов (200, 201, 400, 401, 403, 500)

### Разработка
1. Используйте seed.js для тестовых данных
2. Проверяйте Swagger docs для API спецификации
3. Следите за логами воркера для отладки events
4. Используйте AdminJS для просмотра данных

### Production
1. Используйте strong API keys
2. Настройте ограничения ресурсов в Docker
3. Мониторьте размер очередей RabbitMQ
4. Регулярно делайте backup MongoDB
5. Настройте логирование и алертинг

## 🐛 Troubleshooting

### API не стартует
- Проверьте подключение к MongoDB
- Проверьте подключение к RabbitMQ
- Проверьте порт 3000 (не занят)

### Worker не обрабатывает события
- Проверьте RabbitMQ binding (Management UI)
- Проверьте логи воркера: `docker-compose logs -f chat3-worker`
- Убедитесь что очередь `update_worker_queue` существует

### Высокая нагрузка
- Масштабируйте воркеры: `docker-compose up -d --scale chat3-worker=3`
- Добавьте индексы в MongoDB
- Проверьте размер очереди в RabbitMQ

## 📞 Доступ

После запуска доступны:

- **API**: http://localhost:3000
- **Admin Panel**: http://localhost:3000/admin
- **Swagger Docs**: http://localhost:3000/api-docs
- **Quick Links**: http://localhost:3000/admin-links
- **RabbitMQ Management**: http://localhost:15672 (admin/admin)

## 🎉 Заключение

Chat3 - это production-ready система с современной архитектурой, готовая к масштабированию и развертыванию в контейнерах. Система поддерживает event-driven подход, обеспечивает изоляцию данных и предоставляет гибкий API для интеграции.

**Статус:** ✅ Готово к использованию
**Версия:** 1.0.0
**Лицензия:** MIT
**Поддержка:** Node.js 18+, MongoDB 6+, RabbitMQ 3+

