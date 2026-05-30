# Chat3

Система управления чатами с поддержкой мультитенантности, событийно-ориентированной архитектуры и интеграции через RabbitMQ.

## 🚀 Быстрый старт

1. **Установка зависимостей:**
   ```bash
   npm install
   ```

2. **Запуск сервисов:**
   ```bash
   # Запустить MongoDB и RabbitMQ
   docker-compose up -d
   
   # Создать пользователя rmuser в RabbitMQ (один раз)
   ./docker/create-rabbitmq-user.sh
   
   # Запустить все сервисы
   npm run start:all
   
   # Или запустить по отдельности:
   npm run start:tenant-api         # Tenant API (порт 3000)
   npm run start:outbox-relay       # Outbox Relay (обязательно для счётчиков)
   npm run start:counter-worker     # Counter Worker (обязательно для счётчиков)
   npm run start:controlo-gateway  # Controlo Gateway (порт 3001)
   npm run start:update-worker      # Update Worker
   ```

3. **Генерация API ключа:**
   ```bash
   npm run generate-key
   ```

4. **Заполнение тестовыми данными (опционально):**
   ```bash
   npm run seed
   ```

5. **Доступ к сервисам:**
   - 🧪 **API Test Suite**: http://localhost:3001
   - 📊 **Swagger UI**: http://localhost:3000/api-docs
   - 💚 **Health Check**: http://localhost:3000/health

## 📚 Документация

- **[Архитектура](docs/ARCHITECTURE.md)** - Компоненты системы, потоки данных, RabbitMQ
- **[API](docs/API.md)** - Полное описание REST API с примерами
- **[События](docs/EVENTS.md)** - Система событий и их обработка
- **[Обновления](docs/UPDATES.md)** - Система персонализированных обновлений
- **[Интеграция](docs/INTEGRATION.md)** - Интеграция внешних систем через RabbitMQ
- **[Аутентификация](docs/AUTHENTICATION.md)** - API ключи и безопасность

## 📦 Установка и настройка

### Переменные окружения

Создайте файл `.env` на основе `.env.example`:

```bash
MONGODB_URI=mongodb://localhost:27017/chat3
RABBITMQ_URL=amqp://rmuser:rmpassword@localhost:5672/
RABBITMQ_EVENTS_EXCHANGE=chat3_events
RABBITMQ_UPDATES_EXCHANGE=chat3_updates
PORT=3000
NODE_ENV=development
```

### Внешние сервисы

После запуска `docker-compose up -d`:
- **MongoDB**: localhost:27017
- **RabbitMQ AMQP**: localhost:5672
  - **Пользователь**: rmuser / rmpassword
  - **Admin**: admin / admin
- **RabbitMQ Management UI**: http://localhost:15672 (admin/admin)

**Важно:** После первого запуска RabbitMQ создайте пользователя:
```bash
./docker/create-rabbitmq-user.sh
```

### Workers

Счётчики (`UserDialogStats`, `UserStats`, `MessageStatusStats`, паковые unread) обновляет **только counter-worker**.
Tenant API пишет domain-события в outbox; **outbox-relay** публикует их в RabbitMQ.

#### Outbox Relay
Читает неопубликованные записи `OutboxEvent` из MongoDB и публикует в exchange `chat3_events`.

```bash
npm run start:outbox-relay
```

#### Counter Worker
Единственный writer stats: обрабатывает counter-события из `counter_worker_queue`, пересчитывает slice и публикует counter-Updates.

```bash
npm run start:counter-worker
```

**Функции:**
- Подписывается на exchange `chat3_events` (очередь `counter_worker_queue`)
- Idempotent `processCounterEvent` + `recalculateSlice`
- Публикует Updates со счётчиками в `chat3_updates`

#### Update Worker
Обрабатывает события из RabbitMQ и создает персонализированные обновления для пользователей (без записи stats).

```bash
npm run start:update-worker
```

**Функции:**
- Подписывается на exchange `chat3_events` (routing key: `#`)
- Создает персонализированные Updates для участников диалогов
- Публикует Updates в exchange `chat3_updates`

#### Dialog Read Worker
Обрабатывает задачи массового чтения диалогов.

```bash
npm run start:dialog-read-worker
```

**Функции:**
- Обрабатывает задачи из коллекции `DialogReadTask`
- Пишет `MessageStatus` (bulk) и событие `dialog.messages.bulk_read` — счётчики обновляет counter-worker
- Работает в фоновом режиме с опросом каждые 2 секунды

**Порядок deploy / локального стенда:**
1. MongoDB
2. RabbitMQ (`./docker/create-rabbitmq-user.sh` после первого запуска)
3. Tenant API (`npm run start:tenant-api`)
4. **Outbox Relay** (`npm run start:outbox-relay`) — обязательно
5. **Counter Worker** (`npm run start:counter-worker`) — обязательно
6. Update Worker (`npm run start:update-worker`) — обязательно
7. Dialog Read Worker (`npm run start:dialog-read-worker`) — опционально
8. Controlo Gateway (`npm run start:controlo-gateway`) — опционально

**После первого deploy / seed:** в админке Init → «Полный пересчёт всех счётчиков» или `POST /api/init/full-recalculate-stats`.

**Мониторинг drift:** `GET /api/init/reconcile-counter-drift` или `npm run reconcile-counter-drift` (exit 1 при расхождении — для CI/nightly).

**CI (счётчики):** `npm run test:ci:counters` — E2E stack, slice benchmark, drift unit-тесты; при `MONGO_URI` — live drift check.

## Доступ к сервисам

После запуска сервисов:

### Tenant API (порт 3000)
- 📚 **Swagger UI**: http://localhost:3000/api-docs
- 💚 **Health Check**: http://localhost:3000/health
- 🔑 **API Endpoints**: `/api/tenants`, `/api/users`, `/api/dialogs`, `/api/messages`, `/api/meta`

### Controlo Gateway (порт 3001)
- 🧪 **API Test Suite**: http://localhost:3001 (главная страница)
- 📚 **Swagger UI**: http://localhost:3001/api-docs
- 💚 **Health Check**: http://localhost:3001/health
- 🔧 **Control API**: `/api/init`, `/api/dialogs/{id}/events`, `/api/db-explorer`

🔐 **Аутентификация**: [AUTHENTICATION.md](docs/AUTHENTICATION.md)

## Настройка через переменные окружения

Создайте файл `.env` на основе `.env.example`:

```bash
MONGODB_URI=mongodb://localhost:27017/chat3
PORT=3000
ADMIN_EMAIL=your-admin@email.com
ADMIN_PASSWORD=your-secure-password
SESSION_SECRET=your-session-secret
COOKIE_SECRET=your-cookie-secret
NODE_ENV=development
```

## 🔑 Ключевые концепции

### Мультитенантность
Все данные изолированы по `tenantId`. По умолчанию используется `tnt_default`. Tenant определяется через HTTP заголовок `X-Tenant-ID` при каждом запросе.

### События (Events)
Все изменения в системе генерируют события:
- Сохраняются в MongoDB (коллекция `Event`)
- Публикуются в RabbitMQ exchange `chat3_events`
- Routing key: `{entityType}.{action}.{tenantId}`
- Примеры: `dialog.create.tnt_default`, `message.create.tnt_default`

📖 Подробнее: [EVENTS.md](docs/EVENTS.md)

### Обновления (Updates)
На основе событий создаются персонализированные обновления для пользователей:
- Сохраняются в MongoDB (коллекция `Update`)
- Публикуются в RabbitMQ exchange `chat3_updates`
- Routing key: `update.{category}.{userType}.{userId}.{updateType}`
- Примеры: `update.dialog.user.carl.dialogupdate`, `update.user.user.carl.userstatsupdate`

📖 Подробнее: [UPDATES.md](docs/UPDATES.md)

### Мета-теги (Meta Tags)
Любая сущность может иметь мета-теги:
- Поддержка scope для персональных значений
- Приоритет scoped значений при получении
- Entity types: `dialog`, `message`, `user`, `tenant`, `system`, `dialogMember`

### Типы пользователей
Пользователи имеют поле `type`:
- `user` (по умолчанию) - обычный пользователь
- `bot` - бот
- `contact` - контакт
- `agent` - агент поддержки
- и другие (система поддерживает любые типы)

Тип используется в RabbitMQ routing keys для обновлений.

## 📊 Модели данных

### Data Models (`src/models/data/`)
- **Tenant** - Организации/тенанты
- **User** - Пользователи системы
- **Dialog** - Диалоги/чаты
- **DialogMember** - Участники диалогов
- **Message** - Сообщения
- **MessageStatus** - Статусы сообщений (доставлено, прочитано)
- **MessageReaction** - Реакции на сообщения
- **Meta** - Мета-теги для любых сущностей
- **ApiKey** - API ключи для аутентификации

### Operational Models (`src/models/operational/`)
- **Event** - События системы
- **Update** - Обновления для пользователей
- **DialogReadTask** - Задачи массового чтения диалогов

### Journal Models (`src/models/journals/`)
- **ApiJournal** - Журнал всех API запросов

## 🏗️ Структура проекта

```
chat3/
├── src/
│   ├── apps/
│   │   ├── tenant-api/       # Основной REST API сервер (порт 3000)
│   │   ├── gateway/           # Gateway сервер с Control API и тестами (порт 3001)
│   │   ├── control-api/       # Control API (инициализация, события)
│   │   ├── api-test/          # API Test Suite интерфейсы
│   │   │   └── tests/         # E2E тесты для API Test Suite
│   │   ├── update-worker/     # Worker для обработки событий и создания Updates
│   │   └── dialog-read-worker/# Worker для массового чтения диалогов
│   ├── models/
│   │   ├── data/              # Data Models (Tenant, User, Dialog, Message и т.д.)
│   │   ├── operational/      # Operational Models (Event, Update, DialogReadTask)
│   │   └── journals/          # Journal Models (ApiJournal)
│   ├── config/
│   │   └── database.js        # Подключение к MongoDB
│   ├── utils/
│   │   ├── rabbitmqUtils.js   # Утилиты для работы с RabbitMQ
│   │   ├── updateUtils.js     # Утилиты для создания Updates
│   │   └── timestampUtils.js  # Утилиты для работы с timestamps
│   └── scripts/               # Скрипты (seed, generate-key и т.д.)
├── docs/                      # Документация
├── docker-compose.yml         # Конфигурация Docker для MongoDB и RabbitMQ
├── package.json
└── README.md
```

## 🎯 Основные возможности

### REST API
- ✅ Полный CRUD для всех сущностей (tenants, users, dialogs, messages)
- ✅ Расширенная фильтрация с операторами (eq, ne, in, nin, gt, gte, lt, lte, regex, exists)
- ✅ Пагинация и сортировка
- ✅ Мета-теги для любых сущностей
- ✅ Статусы сообщений (sent, delivered, read)
- ✅ Реакции на сообщения
- ✅ Индикатор печати (typing)

### Событийно-ориентированная архитектура
- ✅ Все изменения генерируют события
- ✅ События сохраняются в MongoDB
- ✅ События публикуются в RabbitMQ
- ✅ Автоматическое создание персонализированных Updates

### Интеграция через RabbitMQ
- ✅ Подписка на события в реальном времени
- ✅ Подписка на обновления для конкретных пользователей
- ✅ Гибкая маршрутизация через routing keys
- ✅ Поддержка wildcards для фильтрации

### Мультитенантность
- ✅ Изоляция данных по tenantId
- ✅ Системные API ключи (не привязаны к tenant)
- ✅ Гибкая настройка через заголовки

## 🚀 REST API

### Документация API

- **Swagger UI**: http://localhost:3000/api-docs
- **Подробная документация**: [API.md](docs/API.md)
- **Архитектура проекта**: [ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **Правила фильтрации**: [FILTER_RULES.md](docs/FILTER_RULES.md)
- **Система событий**: [EVENTS.md](docs/EVENTS.md)
- **Система обновлений**: [UPDATES.md](docs/UPDATES.md)
- **RabbitMQ (обязательно)**: [RABBITMQ_REQUIRED.md](docs/RABBITMQ_REQUIRED.md) 🔴

### 🖥️ Тестовые интерфейсы

Проект включает **API Test Suite** - единый навигатор для всех тестовых интерфейсов:
- 🧪 **Главная страница**: http://localhost:3000 (навигатор с iframe)
- Удобное переключение между интерфейсами
- Сохранение последней открытой страницы
- Прямые ссылки на AdminJS и Swagger

**Доступные интерфейсы:**

#### 1. Трехколоночный интерфейс (Пользователи + Диалоги + Сообщения)
- **URL**: http://localhost:3000/api-test-user-dialogs.html
- **Функции**: Выбор пользователя → просмотр его диалогов → просмотр сообщений
- **API**: Использует `/api/users/{userId}/dialogs` endpoint

![Chat3 API Test Suite - Трехколоночный интерфейс](chat3-screenshot.png)

#### 2. Двухколоночный интерфейс (Диалоги + Сообщения)
- **URL**: http://localhost:3000/api-test-dialogs.html
- **Функции**: Просмотр всех диалогов → выбор диалога → просмотр сообщений
- **API**: Использует `/api/dialogs` endpoint

#### Возможности интерфейсов:
- ✅ **Фильтрация** с примерами по метаданным и участникам
- ✅ **Сортировка** по различным полям с визуальными индикаторами
- ✅ **Пагинация** с корректным подсчетом страниц
- ✅ **Модальные окна** для просмотра детальной информации
- ✅ **Добавление сообщений** через форму в модальном окне
- ✅ **Просмотр URL запросов** с возможностью копирования
- ✅ **Адаптивный дизайн** с компактным отображением данных

#### Стартовая страница
- **URL**: http://localhost:3000/index.html
- **Функции**: Выбор между интерфейсами

### Основные Endpoints

**Tenants:**
- `GET/POST/PUT/DELETE /api/tenants` - Управление организациями

**Users:**
- `GET/POST/PUT/DELETE /api/users` - Управление пользователями
- `GET /api/users/:userId/dialogs` - Диалоги пользователя с фильтрацией

**Dialogs:**
- `GET/POST/DELETE /api/dialogs` - Управление диалогами
- `GET /api/dialogs/:dialogId/members` - Участники диалога
- `POST /api/dialogs/:dialogId/members/add` - Добавить участника
- `POST /api/dialogs/:dialogId/member/:userId/typing` - Индикатор печати

**Messages:**
- `GET/POST /api/dialogs/:dialogId/messages` - Сообщения диалога
- `GET/PUT /api/messages/:messageId` - Получить/обновить сообщение
- `POST /api/users/:userId/dialogs/:dialogId/messages/:messageId/status/:status` - Обновить статус
- `GET/POST /api/users/:userId/dialogs/:dialogId/messages/:messageId/reactions` - Реакции

**Meta:**
- `GET/PUT/DELETE /api/meta/:entityType/:entityId/:key` - Мета-теги

📖 **Полная документация API**: [API.md](docs/API.md)

### Примеры использования API

**1. Создание диалога с участниками:**
```bash
curl -X POST http://localhost:3000/api/dialogs \
  -H "X-API-Key: your-key" \
  -H "X-Tenant-ID: tnt_default" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "VIP чат",
    "createdBy": "carl",
    "members": [
      {"userId": "carl", "type": "user", "name": "Carl Johnson"},
      {"userId": "bot_123", "type": "bot", "name": "Support Bot"}
    ]
  }'
```

**2. Получение диалогов пользователя с фильтрацией:**
```bash
# Все диалоги пользователя
curl -H "X-API-Key: your-key" \
     -H "X-Tenant-ID: tnt_default" \
     "http://localhost:3000/api/users/carl/dialogs"

# Только непрочитанные диалоги
curl -H "X-API-Key: your-key" \
     -H "X-Tenant-ID: tnt_default" \
     "http://localhost:3000/api/users/carl/dialogs?unreadCount=gte:1"

# Диалоги с последним сообщением
curl -H "X-API-Key: your-key" \
     -H "X-Tenant-ID: tnt_default" \
     "http://localhost:3000/api/users/carl/dialogs?includeLastMessage=true"
```

**3. Создание сообщения:**
```bash
curl -X POST http://localhost:3000/api/dialogs/{dialogId}/messages \
  -H "X-API-Key: your-key" \
  -H "X-Tenant-ID: tnt_default" \
  -H "Content-Type: application/json" \
  -d '{
    "senderId": "carl",
    "content": "Hello!",
    "type": "internal.text"
  }'
```

**4. Тестирование через Swagger UI:**
- Откройте http://localhost:3000/api-docs
- Нажмите "Authorize"
- Вставьте ваш API ключ
- Тестируйте запросы через интерфейс

### Аутентификация

Все API запросы требуют заголовок `X-API-Key`:
```bash
X-API-Key: chat3_ff4448ef59df326327b90f49b8ecd00f9f909fec3420323faff758396be23a69
X-Tenant-ID: tnt_default  # Опционально, по умолчанию tnt_default
```

**Права доступа:**
- `read` - Чтение данных
- `write` - Создание и обновление
- `delete` - Удаление данных

**Генерация ключа:**
```bash
# Полные права
npm run generate-key

# С именем и описанием
npm run generate-key "Production Key" "For production"

# С ограниченными правами
npm run generate-key "Read Only" "Read access" read
```

📖 **Подробнее**: [AUTHENTICATION.md](docs/AUTHENTICATION.md)

## 🔄 RabbitMQ

### Exchanges

1. **chat3_events** (topic)
   - Публикуются все события системы
   - Routing key: `{entityType}.{action}.{tenantId}`
   - Примеры: `dialog.create.tnt_default`, `message.create.tnt_default`

2. **chat3_updates** (topic)
   - Публикуются обновления для пользователей
   - Routing key: `update.{category}.{userType}.{userId}.{updateType}`
   - Примеры: `update.dialog.user.carl.dialogupdate`, `update.user.user.carl.userstatsupdate`

### Подписка на обновления

```javascript
import amqp from 'amqplib';

const connection = await amqp.connect('amqp://rmuser:rmpassword@localhost:5672/');
const channel = await connection.createChannel();

const queueName = `user_carl_updates`;
await channel.assertQueue(queueName, {
  durable: true,
  arguments: { 'x-message-ttl': 3600000 } // 1 час TTL
});

// Подписка на все обновления пользователя carl
await channel.bindQueue(queueName, 'chat3_updates', 'update.*.user.carl.*');

channel.consume(queueName, (msg) => {
  const update = JSON.parse(msg.content.toString());
  console.log('Update:', update.eventType);
  channel.ack(msg);
});
```

📖 **Подробнее**: [INTEGRATION.md](docs/INTEGRATION.md)

**Важно:** RabbitMQ является обязательным компонентом системы!

## 📊 Тестовые данные (Seed)

При запуске `npm run seed` создаются:
- Несколько тенантов (tnt_default, tnt_company_a, и т.д.)
- Пользователи разных типов (user, bot, contact)
- Диалоги с мета-тегами
- Сообщения и статусы
- События и обновления

## 🔍 Фильтрация и сортировка

### Операторы фильтрации
- `eq` - равно
- `ne` - не равно
- `in` - в массиве: `(type,in,[user,bot])`
- `nin` - не в массиве
- `gt`, `gte`, `lt`, `lte` - сравнение
- `regex` - регулярное выражение
- `exists` - существование поля

### Примеры фильтрации

```bash
# Фильтр по meta тегам
GET /api/dialogs?filter=(meta.channelType,eq,whatsapp)

# Комбинированные фильтры (AND логика)
GET /api/dialogs?filter=(meta.type,eq,internal)&(meta.channelType,ne,telegram)

# Фильтр по участникам
GET /api/users/carl/dialogs?filter=(meta.members,in,[john,sara])

# Фильтр по непрочитанным
GET /api/users/carl/dialogs?unreadCount=gte:1
```

### Сортировка

```bash
# Сортировка по времени
GET /api/users/carl/dialogs?sort=(lastInteractionAt,desc)

# Сортировка по непрочитанным
GET /api/users/carl/dialogs?sort=(unreadCount,desc)
```

📖 **Подробнее**: [API.md](docs/API.md)

