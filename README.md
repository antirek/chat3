# chat3

Node.js проект с AdminJS панелью для управления чат-системой

## Установка

```bash
npm install
```

## Запуск

```bash
# Убедитесь что MongoDB запущен
# mongod

# Установите зависимости
npm install

# (Опционально) Заполните БД тестовыми данными
npm run seed

# Запустить сервер
npm start

# Для разработки с автоперезагрузкой
npm run dev
```

## Доступ к админ-панели

После запуска сервера:
- API: http://localhost:3000
- Админ-панель: http://localhost:3000/admin (без авторизации)

📚 **Руководство по админке**: [ADMIN_GUIDE.md](ADMIN_GUIDE.md)

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

## Модели данных

### Tenant
Организации/арендаторы в системе
- name, domain, isActive, settings
- **System Tenant** - системная организация для ботов и служебных операций

### User
Пользователи системы
- username, email, password, role (admin/user/moderator)
- Привязка к Tenant
- **System Bot** - автоматически создаваемый системный бот

### Dialog
Диалоги/чаты (приватные, групповые, каналы)
- name, type (private/group/channel), description
- Участники хранятся в отдельной модели DialogParticipant

### DialogParticipant
Участники диалогов
- dialogId, userId (ObjectId или произвольная строка), role
- joinedAt, leftAt, isActive

### Message
Сообщения в диалогах
- content, type (text/image/video/audio/file/system)
- attachments, replyTo, readBy

### Meta
Метаданные для любых сущностей
- key-value хранилище с типизацией
- Используется для хранения участников диалогов и метаданных ботов

### ApiKey
API ключи для доступа к REST API
- Права доступа: read, write, delete
- Привязка к Tenant

## Структура проекта

```
chat3/
├── src/
│   ├── admin/
│   │   └── config.js          # Конфигурация AdminJS
│   ├── config/
│   │   └── database.js        # Подключение к MongoDB
│   ├── models/
│   │   ├── Tenant.js
│   │   ├── User.js
│   │   ├── Dialog.js
│   │   ├── Message.js
│   │   ├── Meta.js
│   │   └── index.js
│   └── index.js               # Точка входа
├── package.json
├── .gitignore
└── README.md
```

## Возможности админ-панели

✅ Полный CRUD для всех моделей  
✅ Фильтрация и поиск  
✅ Связи между моделями (references)  
✅ Русский интерфейс  
✅ Аутентификация  
✅ Responsive дизайн

## 🚀 REST API

### Документация API

- **Swagger UI**: http://localhost:3000/api-docs
- **Подробная документация**: [API.md](API.md)

### Endpoints

- `GET/POST/PUT/DELETE /api/tenants` - Управление организациями
- `GET/POST/PUT/DELETE /api/users` - Управление пользователями

### Быстрый старт с API

1. **Сгенерируйте API ключ**:
   ```bash
   npm run generate-api-key
   ```

2. **Скопируйте ключ** из вывода команды (начинается с `chat3_`)

3. **Используйте ключ в запросах**:
   ```bash
   curl -H "X-API-Key: chat3_ваш_ключ" http://localhost:3000/api/users
   ```

4. **Или тестируйте через Swagger UI**:
   - Откройте http://localhost:3000/api-docs
   - Нажмите "Authorize"
   - Вставьте ваш API ключ
   - Тестируйте запросы через интерфейс

### Аутентификация

Все API запросы требуют заголовок `X-API-Key` с валидным ключом:
```
X-API-Key: chat3_ff4448ef59df326327b90f49b8ecd00f9f909fec3420323faff758396be23a69
```

### Права доступа

API ключи поддерживают гранулярные права:
- `read` - Чтение данных
- `write` - Создание и обновление
- `delete` - Удаление данных

Создать ключ с ограниченными правами:
```bash
npm run generate-api-key <tenant-id> "Read Only" read
```

## 🤖 Системный бот

При запуске `npm run seed` автоматически создается:
- **System Tenant** - системная организация
- **System Bot** - пользователь-бот для автоматических операций

### Возможности бота:
- Отправка системных уведомлений
- Автоматические сообщения
- Обработка команд

📚 Подробнее: [SYSTEM_BOT.md](SYSTEM_BOT.md)

## 📊 Тестовые данные (Seed)

При запуске `npm run seed` создаются:

### Организации (Tenants)
- 1 системная организация (System)
- 1 демо организация (Demo Company)

### Пользователи
- 1 системный бот (system_bot)
- 3 демо пользователя (admin, user1, user2)

### Диалоги - **100 штук!**
- **70 internal** (внутренние) + **30 external** (внешние)
- **50 WhatsApp** + **50 Telegram** (по каналам)
- Разные типы: private, group, channel

### Метаданные
- **600+ записей** для диалогов
- Каждый диалог имеет 6 meta полей:
  - `type` - internal/external
  - `channelType` - **whatsapp/telegram**
  - `welcomeMessage` - приветствие
  - `maxParticipants` - максимум участников
  - `features` - доступные функции
  - `securityLevel` - уровень безопасности

### 🔍 Примеры фильтрации:

```bash
# Все WhatsApp диалоги (50 штук)
GET /api/dialogs?filter={"meta":{"channelType":"whatsapp"}}

# Все Telegram диалоги (50 штук)
GET /api/dialogs?filter={"meta":{"channelType":"telegram"}}

# Внутренние WhatsApp диалоги (35 штук)
GET /api/dialogs?filter={"meta":{"type":"internal","channelType":"whatsapp"}}

# Внешние Telegram диалоги (15 штук)
GET /api/dialogs?filter={"meta":{"type":"external","channelType":"telegram"}}
```

