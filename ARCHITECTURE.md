# Архитектура проекта Chat3

## Обзор

Chat3 - это система управления диалогами и сообщениями с поддержкой мультитенантности, метаданных и гибкой фильтрации. Проект построен на Node.js с использованием Express.js и MongoDB.

## Общая архитектура системы

```mermaid
graph TB
    subgraph "Client Layer"
        UI1[Двухколоночный интерфейс]
        UI2[Трехколоночный интерфейс]
        UI3[Стартовая страница]
    end
    
    subgraph "API Layer"
        API[Express.js Server]
        AUTH[API Key Middleware]
        ROUTES[Routes]
    end
    
    subgraph "Business Logic"
        CTRL[Controllers]
        UTILS[Utils]
        MW[Middleware]
    end
    
    subgraph "Data Layer"
        MONGO[(MongoDB)]
        MODELS[Models]
    end
    
    UI1 --> API
    UI2 --> API
    UI3 --> API
    
    API --> AUTH
    AUTH --> ROUTES
    ROUTES --> CTRL
    CTRL --> UTILS
    CTRL --> MODELS
    MODELS --> MONGO
    
    MW --> CTRL
```

## Технологический стек

- **Backend**: Node.js, Express.js
- **База данных**: MongoDB с Mongoose ODM
- **Аутентификация**: API Key-based
- **Документация API**: Swagger/OpenAPI
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Тестирование**: Встроенные HTML интерфейсы для тестирования API

## Архитектурные принципы

### 1. Мультитенантность
- Каждый tenant изолирован в базе данных
- API ключи привязаны к конкретным tenant'ам
- Все операции выполняются в контексте tenant'а

### 2. Модульная структура
- Разделение на контроллеры, модели, маршруты и утилиты
- Четкое разделение ответственности между компонентами
- Переиспользуемые компоненты

### 3. Гибкая система фильтрации
- Поддержка сложных запросов с операторами сравнения
- Фильтрация по метаданным и обычным полям
- Комбинированные фильтры с логическими операторами

## Структура проекта

```mermaid
graph TD
    ROOT[Chat3 Project Root]
    
    subgraph "Source Code"
        SRC[src/]
        CONFIG[config/]
        CTRL[controllers/]
        MIDDLEWARE[middleware/]
        MODELS[models/]
        ROUTES[routes/]
        UTILS[utils/]
        PUBLIC[public/]
        SCRIPTS[scripts/]
    end
    
    subgraph "Configuration"
        CONFIG --> DB[database.js]
        CONFIG --> SWAGGER[swagger.js]
    end
    
    subgraph "Controllers"
        CTRL --> DIALOG_CTRL[dialogController.js]
        CTRL --> MSG_CTRL[messageController.js]
        CTRL --> USER_CTRL[userController.js]
        CTRL --> USER_DIALOG_CTRL[userDialogController.js]
    end
    
    subgraph "Models"
        MODELS --> DIALOG_MODEL[Dialog.js]
        MODELS --> MSG_MODEL[Message.js]
        MODELS --> USER_MODEL[User.js]
        MODELS --> META_MODEL[Meta.js]
        MODELS --> DIALOG_MEMBER_MODEL[DialogMember.js]
        MODELS --> MSG_STATUS_MODEL[MessageStatus.js]
    end
    
    subgraph "Routes"
        ROUTES --> DIALOG_ROUTES[dialogRoutes.js]
        ROUTES --> MSG_ROUTES[messageRoutes.js]
        ROUTES --> USER_ROUTES[userRoutes.js]
    end
    
    subgraph "Utils"
        UTILS --> QUERY_PARSER[queryParser.js]
        UTILS --> META_UTILS[metaUtils.js]
        UTILS --> UNREAD_UTILS[unreadCountUtils.js]
    end
    
    subgraph "Public Interface"
        PUBLIC --> DIALOGS_UI[api-test-dialogs.html]
        PUBLIC --> USER_DIALOGS_UI[api-test-user-dialogs.html]
        PUBLIC --> INDEX_UI[index.html]
    end
    
    subgraph "Scripts"
        SCRIPTS --> SEED[seed.js]
        SCRIPTS --> GEN_KEY[generateApiKey.js]
    end
    
    ROOT --> SRC
    SRC --> CONFIG
    SRC --> CTRL
    SRC --> MIDDLEWARE
    SRC --> MODELS
    SRC --> ROUTES
    SRC --> UTILS
    SRC --> PUBLIC
    SRC --> SCRIPTS
```

### Детальная структура файлов

```
src/
├── config/           # Конфигурация приложения
│   ├── database.js   # Настройки подключения к MongoDB
│   └── swagger.js    # Конфигурация Swagger документации
├── controllers/      # Бизнес-логика
│   ├── dialogController.js      # Управление диалогами
│   ├── messageController.js     # Управление сообщениями
│   ├── userController.js        # Управление пользователями
│   ├── userDialogController.js  # Диалоги конкретного пользователя
│   └── ...
├── middleware/       # Промежуточное ПО
│   └── apiAuth.js   # Аутентификация по API ключам
├── models/          # Модели данных MongoDB
│   ├── Dialog.js    # Модель диалога
│   ├── Message.js   # Модель сообщения
│   ├── User.js      # Модель пользователя
│   ├── Meta.js      # Модель метаданных
│   └── ...
├── routes/          # Маршруты API
│   ├── dialogRoutes.js
│   ├── messageRoutes.js
│   └── ...
├── utils/           # Утилиты
│   ├── queryParser.js    # Парсинг фильтров и сортировки
│   ├── metaUtils.js     # Работа с метаданными
│   └── unreadCountUtils.js # Подсчет непрочитанных сообщений
├── public/          # Статические файлы
│   ├── api-test-dialogs.html      # Двухколоночный интерфейс
│   ├── api-test-user-dialogs.html # Трехколоночный интерфейс
│   └── index.html                 # Стартовая страница
└── scripts/         # Скрипты
    ├── seed.js              # Заполнение тестовыми данными
    └── generateApiKey.js    # Генерация API ключей
```

## Ключевые компоненты

### 1. Модели данных

```mermaid
erDiagram
    TENANT {
        ObjectId _id PK
        string name
        string domain
        date createdAt
        date updatedAt
    }
    
    DIALOG {
        ObjectId _id PK
        ObjectId tenantId FK
        string name
        string createdBy
        date createdAt
        date updatedAt
    }
    
    USER {
        ObjectId _id PK
        ObjectId tenantId FK
        string userId
        string name
        string email
        date createdAt
        date updatedAt
    }
    
    DIALOG_MEMBER {
        ObjectId _id PK
        ObjectId dialogId FK
        ObjectId tenantId FK
        string userId
        number unreadCount
        date lastSeenAt
        date lastMessageAt
        boolean isActive
        date createdAt
        date updatedAt
    }
    
    MESSAGE {
        ObjectId _id PK
        ObjectId dialogId FK
        ObjectId tenantId FK
        string senderId
        string content
        string type
        date createdAt
        date updatedAt
    }
    
    MESSAGE_STATUS {
        ObjectId _id PK
        ObjectId messageId FK
        ObjectId tenantId FK
        string userId
        string status
        date readAt
        date createdAt
        date updatedAt
    }
    
    META {
        ObjectId _id PK
        ObjectId tenantId FK
        string entityType
        ObjectId entityId
        object data
        date createdAt
        date updatedAt
    }
    
    API_KEY {
        ObjectId _id PK
        ObjectId tenantId FK
        string key
        string name
        array permissions
        boolean isActive
        date expiresAt
        date lastUsedAt
        date createdAt
        date updatedAt
    }
    
    TENANT ||--o{ DIALOG : "owns"
    TENANT ||--o{ USER : "owns"
    TENANT ||--o{ DIALOG_MEMBER : "owns"
    TENANT ||--o{ MESSAGE : "owns"
    TENANT ||--o{ MESSAGE_STATUS : "owns"
    TENANT ||--o{ META : "owns"
    TENANT ||--o{ API_KEY : "owns"
    
    DIALOG ||--o{ DIALOG_MEMBER : "has"
    DIALOG ||--o{ MESSAGE : "contains"
    
    MESSAGE ||--o{ MESSAGE_STATUS : "has"
    
    USER ||--o{ DIALOG_MEMBER : "participates"
    USER ||--o{ MESSAGE : "sends"
    USER ||--o{ MESSAGE_STATUS : "receives"
```

#### Dialog (Диалог)
- Основная сущность для группировки сообщений
- Содержит метаданные (тип канала, уровень безопасности, максимальное количество участников)
- Связан с участниками через DialogMember

#### Message (Сообщение)
- Содержит текст сообщения, отправителя, тип
- Связан с диалогом и имеет метаданные
- Поддерживает статусы доставки через MessageStatus

#### DialogMember (Участник диалога)
- Связывает пользователя с диалогом
- Хранит количество непрочитанных сообщений
- Отслеживает время последнего просмотра

#### Meta (Метаданные)
- Гибкая система хранения дополнительных данных
- Привязка к любым сущностям (диалоги, сообщения, пользователи)
- Поддержка различных типов данных

### 2. API Endpoints

#### Основные эндпоинты диалогов
- `GET /api/dialogs` - Получение списка диалогов с фильтрацией и сортировкой
- `GET /api/dialogs/:id` - Получение конкретного диалога
- `GET /api/users/:userId/dialogs` - Диалоги конкретного пользователя

#### Эндпоинты сообщений
- `GET /api/dialogs/:id/messages` - Сообщения диалога
- `POST /api/dialogs/:id/messages` - Добавление нового сообщения
- `GET /api/messages/:messageId` - Получение конкретного сообщения

### 3. Система фильтрации

#### Поддерживаемые операторы
- `eq` - равенство
- `ne` - неравенство
- `in` - входит в список
- `nin` - не входит в список
- `gt`, `gte`, `lt`, `lte` - сравнения
- `regex` - регулярные выражения
- `exists` - существование поля
- `all` - все элементы из списка

#### Примеры фильтров
```
(meta.channelType,eq,whatsapp)
(member[carl].unreadCount,gte,3)
(meta.securityLevel,in,[high,medium])
(unreadCount,eq,0)&(meta.type,eq,internal)
```

### 4. Система сортировки

#### Поддерживаемые поля
- Обычные поля: `updatedAt`, `createdAt`
- Поля участников: `member[userId].unreadCount`, `member[userId].lastSeenAt`
- Поля пользователя: `unreadCount`, `lastSeenAt` (для `/api/users/:userId/dialogs`)

#### Формат сортировки
```
sort=(field,direction)
sort=(member[carl].unreadCount,desc)
sort=(updatedAt,asc)
```

## Особенности реализации

### 1. Обработка сложных запросов

#### MongoDB Aggregation Pipeline
Для сложных запросов с фильтрацией по участникам используется агрегация:
```javascript
const pipeline = [
  { $match: baseQuery },
  { $lookup: { from: 'dialogmembers', ... } },
  { $addFields: { member: { $filter: ... } } },
  { $match: memberQuery }
];
```

#### Клиентская сортировка
Для сортировки по полям участников используется JavaScript:
```javascript
dialogs.sort((a, b) => {
  const aVal = a.member[userId]?.unreadCount || 0;
  const bVal = b.member[userId]?.unreadCount || 0;
  return direction === 'desc' ? bVal - aVal : aVal - bVal;
});
```

### 2. Пагинация

#### Правильный порядок операций
1. Применение фильтров
2. Сортировка всего набора данных
3. Пагинация отсортированных результатов

```javascript
// Сортировка ДО пагинации
dialogs.sort(sortFunction);
const total = dialogs.length;
const paginatedDialogs = dialogs.slice(skip, skip + limit);
```

### 3. Метаданные

#### Гибкая система тегов
Метаданные хранятся отдельно и связываются с сущностями:
```javascript
const meta = await metaUtils.getEntityMeta(tenantId, 'dialog', dialogId);
```

#### Поддержка различных типов
- Строки, числа, булевы значения
- Массивы и объекты
- Вложенные структуры

## Тестовые интерфейсы

### 1. Двухколоночный интерфейс (`api-test-dialogs.html`)
- Колонка "Диалоги" с фильтрацией и сортировкой
- Колонка "Сообщения" с фильтрацией и сортировкой
- Использует `/api/dialogs` endpoint

### 2. Трехколоночный интерфейс (`api-test-user-dialogs.html`)
- Колонка "Пользователи" для выбора пользователя
- Колонка "Диалоги" с фильтрацией и сортировкой
- Колонка "Сообщения" с фильтрацией и сортировкой
- Использует `/api/users/:userId/dialogs` endpoint

### 3. Функциональность интерфейсов
- Модальные окна для просмотра информации
- Формы добавления сообщений
- Кнопки просмотра текущих URL запросов
- Копирование URL в буфер обмена

## Безопасность

### 1. API Key аутентификация
- Каждый запрос требует валидный API ключ
- Ключи привязаны к конкретным tenant'ам
- Поддержка различных уровней доступа (read, write, delete)

### 2. Изоляция данных
- Все операции выполняются в контексте tenant'а
- Невозможность доступа к данным других tenant'ов
- Валидация прав доступа на уровне middleware

## Производительность

### 1. Индексы MongoDB
- Составные индексы для частых запросов
- Индексы по tenantId для изоляции данных
- Индексы по полям фильтрации

### 2. Оптимизация запросов
- Использование проекций для уменьшения объема данных
- Батчевые операции для массовых вставок
- Кэширование метаданных

## Масштабируемость

### 1. Горизонтальное масштабирование
- Stateless архитектура
- Возможность запуска нескольких экземпляров
- Использование внешней MongoDB

### 2. Вертикальное масштабирование
- Оптимизация запросов к базе данных
- Кэширование часто используемых данных
- Асинхронная обработка тяжелых операций

## Мониторинг и логирование

### 1. Логирование
- Структурированные логи для отладки
- Логирование API запросов и ответов
- Отслеживание ошибок и исключений

### 2. Метрики
- Количество запросов по endpoint'ам
- Время выполнения запросов
- Использование ресурсов

## Развертывание

### 1. Переменные окружения
- `MONGODB_URI` - строка подключения к MongoDB
- `PORT` - порт для запуска сервера
- `NODE_ENV` - окружение (development/production)

### 2. Зависимости
- Все зависимости указаны в `package.json`
- Использование npm для управления пакетами
- Поддержка ES модулей

## Будущие улучшения

### 1. Планируемые функции
- WebSocket поддержка для real-time сообщений
- Система уведомлений
- Расширенная аналитика и отчеты
- API для мобильных приложений

### 2. Технические улучшения
- Redis для кэширования
- Elasticsearch для полнотекстового поиска
- Микросервисная архитектура
- Контейнеризация с Docker

## Заключение

Chat3 представляет собой хорошо структурированную систему управления диалогами с акцентом на гибкость, производительность и масштабируемость. Архитектура позволяет легко добавлять новые функции и адаптироваться к изменяющимся требованиям.
