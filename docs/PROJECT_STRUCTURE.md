# Структура проекта

## Обзор

Монорепозиторий для управления несколькими бекенд-процессами и фронтенд-приложениями на Node.js/JavaScript.

## Компоненты системы

### Бекенд процессы

1. **client-api** - Клиентское API
2. **admin-api** - API для админ-панели
3. **internal-api** - API для взаимодействия с другими бекендами (может быть несколько)
4. **cron-jobs** - Крон-задачи
5. **queue-workers** - Воркеры очередей

### Фронтенд приложения

1. **admin-web** - Админ-панель (зависит от admin-api)
2. **client-playground** - Playground для клиентского API

## Взаимозависимости

```
admin-web → admin-api
client-playground → client-api
```

## Workspaces - что это?

**Workspaces** - это механизм для управления несколькими пакетами/приложениями в одном репозитории (монорепозиторий).

### Зачем это нужно?

Вместо того чтобы иметь отдельные репозитории для каждого приложения, можно:
- Хранить все в одном репозитории
- Управлять зависимостями централизованно
- Использовать общие пакеты между приложениями
- Упростить разработку и деплой

### Варианты реализации

#### 1. **npm workspaces** (встроено в npm 7+)
- ✅ Встроено в npm, не нужны дополнительные инструменты
- ✅ Простая настройка
- ✅ Хорошо работает с большинством проектов
- ⚠️ Медленнее pnpm при установке зависимостей
- ⚠️ Может дублировать зависимости в разных пакетах

**Пример структуры:**
```json
// package.json (корневой)
{
  "name": "structure-apps",
  "workspaces": [
    "packages/*",
    "packages-shared/*"
  ]
}
```

#### 2. **yarn workspaces** (встроено в Yarn 1.x и 2+)
- ✅ Зрелое решение, много проектов используют
- ✅ Хорошая производительность
- ✅ Поддержка hoisting (поднятие общих зависимостей)
- ⚠️ Нужно установить Yarn отдельно
- ⚠️ Yarn 2+ (Berry) имеет другой подход к кешированию

**Пример структуры:**
```json
// package.json (корневой)
{
  "name": "structure-apps",
  "private": true,
  "workspaces": [
    "packages/*",
    "packages-shared/*"
  ]
}
```

#### 3. **pnpm workspaces** (встроено в pnpm)
- ✅ Самая быстрая установка зависимостей
- ✅ Экономит место на диске (симлинки вместо копий)
- ✅ Строгий контроль зависимостей (нет phantom dependencies)
- ⚠️ Нужно установить pnpm отдельно
- ⚠️ Может быть проблемы с некоторыми пакетами, которые не поддерживают symlinks

**Пример структуры:**
```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
  - 'packages-shared/*'
```

### Как это работает?

1. **Корневой package.json** определяет, какие директории являются workspaces
2. **Каждое приложение** имеет свой `package.json` с зависимостями
3. **Общие зависимости** устанавливаются один раз в корне
4. **Локальные пакеты** можно импортировать как обычные npm-пакеты

**Пример использования локального пакета:**
```json
// packages/admin-web/package.json
{
  "dependencies": {
    "@structure-apps/types": "workspace:*",  // ссылка на packages-shared/types
    "@structure-apps/admin-api": "workspace:*"  // ссылка на packages/admin-api
  }
}
```

### Рекомендация

Для вашего случая (несколько API, фронтенды, воркеры):
- **npm workspaces** - если хотите простое решение без дополнительных инструментов
- **pnpm workspaces** - если важна скорость и экономия места (рекомендую для больших проектов)
- **yarn workspaces** - если уже используете Yarn в проекте

## Принятые решения

1. **Менеджер пакетов**: ✅ **npm workspaces**
2. **Общие пакеты**: ⏳ Возможно в будущем (структура готова)
3. **База данных**: 
   - Может быть несколько БД
   - Определяется через конфигурацию (dotenv)
   - Миграции: см. раздел "Организация миграций" ниже
4. **Конфигурация**: ✅ **dotenv** для формирования конфигурации из env-файлов
5. **Типы/схемы**: ✅ **Да**, общие типы будут в `packages-shared/types`
6. **Тестирование**: ❌ Общей структуры тестов не требуется
7. **CI/CD**: ⏳ Пока не определено
8. **Документация**: ✅ **Да**, от общего к частному

## Финальная структура проекта

```
structure-apps/
├── packages/
│   ├── client-api/                    # Клиентское API
│   │   ├── src/
│   │   │   ├── routes/                # Маршруты API
│   │   │   ├── controllers/           # Контроллеры
│   │   │   ├── services/              # Бизнес-логика
│   │   │   ├── models/                # Модели данных
│   │   │   ├── middleware/            # Middleware
│   │   │   ├── config/                # Конфигурация (использует dotenv)
│   │   │   └── index.js               # Точка входа
│   │   ├── migrations/                # Миграции БД (если есть)
│   │   ├── package.json
│   │   └── .env.example               # Пример env-файла
│   │
│   ├── admin-api/                     # API для админ-панели
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   ├── models/
│   │   │   ├── middleware/
│   │   │   ├── config/
│   │   │   └── index.js
│   │   ├── migrations/
│   │   ├── package.json
│   │   └── .env.example
│   │
│   ├── internal-api/                  # API для взаимодействия с другими бекендами
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   ├── models/
│   │   │   ├── middleware/
│   │   │   ├── config/
│   │   │   └── index.js
│   │   ├── migrations/
│   │   ├── package.json
│   │   └── .env.example
│   │
│   ├── cron-jobs/                     # Крон-задачи
│   │   ├── src/
│   │   │   ├── jobs/                  # Задачи
│   │   │   ├── services/              # Сервисы для задач
│   │   │   ├── config/
│   │   │   └── index.js
│   │   ├── package.json
│   │   └── .env.example
│   │
│   ├── queue-workers/                 # Воркеры очередей
│   │   ├── src/
│   │   │   ├── workers/               # Воркеры
│   │   │   ├── processors/            # Обработчики задач
│   │   │   ├── services/
│   │   │   ├── config/
│   │   │   └── index.js
│   │   ├── package.json
│   │   └── .env.example
│   │
│   ├── admin-web/                     # Админ-панель (фронтенд)
│   │   ├── src/
│   │   │   ├── components/            # React/Vue компоненты
│   │   │   ├── pages/                 # Страницы
│   │   │   ├── services/              # API клиенты
│   │   │   ├── utils/
│   │   │   ├── config/
│   │   │   └── index.js
│   │   ├── public/
│   │   ├── package.json
│   │   └── .env.example
│   │
│   └── client-playground/             # Playground для клиентского API
│       ├── src/
│       │   ├── components/
│       │   ├── pages/
│       │   ├── services/
│       │   ├── utils/
│       │   ├── config/
│       │   └── index.js
│       ├── public/
│       ├── package.json
│       └── .env.example
│
├── packages-shared/                    # Общие пакеты
│   ├── types/                         # Общие TypeScript типы
│   │   ├── src/
│   │   │   ├── api/                   # Типы для API
│   │   │   ├── models/                # Типы моделей
│   │   │   ├── common/                # Общие типы
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── utils/                         # Общие утилиты (если понадобятся)
│   │   ├── src/
│   │   │   └── index.js
│   │   └── package.json
│   │
│   ├── config/                        # Общие конфигурации (если понадобятся)
│   │   ├── src/
│   │   │   └── index.js
│   │   └── package.json
│   │
│   └── schemas/                       # Общие схемы валидации (если понадобятся)
│       ├── src/
│       │   └── index.js
│       └── package.json
│
├── docs/                              # Документация
│   ├── README.md                      # Общая документация
│   ├── architecture.md                # Архитектура системы
│   ├── api/
│   │   ├── client-api.md              # Документация клиентского API
│   │   ├── admin-api.md               # Документация админ API
│   │   └── internal-api.md            # Документация внутреннего API
│   ├── frontend/
│   │   ├── admin-web.md               # Документация админ-панели
│   │   └── client-playground.md       # Документация playground
│   └── backend/
│       ├── cron-jobs.md               # Документация крон-задач
│       └── queue-workers.md           # Документация воркеров
│
├── .gitignore
├── package.json                       # Корневой package.json для npm workspaces
├── README.md                          # Главный README
└── PROJECT_STRUCTURE.md               # Этот файл
```

## Организация миграций БД

### Подход 1: Миграции в каждом приложении (рекомендуется)

Каждое приложение, которое работает с БД, имеет свою директорию `migrations/`:

```
packages/client-api/
├── migrations/
│   ├── 001_create_users_table.js
│   ├── 002_create_orders_table.js
│   └── ...
```

**Плюсы:**
- Четкая изоляция миграций по приложениям
- Каждое приложение управляет своей схемой БД
- Проще понять, какие миграции относятся к какому приложению

**Минусы:**
- Если несколько приложений используют одну БД, нужно синхронизировать миграции

### Подход 2: Общие миграции для общей БД

Если несколько приложений используют одну БД, можно создать общий пакет:

```
packages-shared/
└── db-migrations/              # Общие миграции
    ├── src/
    │   ├── migrations/
    │   │   ├── 001_initial_schema.js
    │   │   └── ...
    │   └── index.js
    └── package.json
```

**Использование:**
- Приложения, использующие общую БД, зависят от `@structure-apps/db-migrations`
- Миграции запускаются централизованно

### Рекомендация

**Используйте Подход 1** (миграции в каждом приложении), если:
- Каждое приложение работает со своей БД или схемой
- Нужна четкая изоляция

**Используйте Подход 2** (общие миграции), если:
- Несколько приложений используют одну БД
- Нужна единая схема данных

**Конфигурация БД через dotenv:**
```env
# packages/client-api/.env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=client_db
DB_USER=user
DB_PASSWORD=password

# Если несколько БД
DB_ANALYTICS_HOST=analytics-db.example.com
DB_ANALYTICS_NAME=analytics_db
```

## Примеры конфигураций

### Корневой package.json

```json
{
  "name": "structure-apps",
  "version": "1.0.0",
  "private": true,
  "workspaces": [
    "packages/*",
    "packages-shared/*"
  ],
  "scripts": {
    "install:all": "npm install",
    "dev:client-api": "npm run dev --workspace=packages/client-api",
    "dev:admin-api": "npm run dev --workspace=packages/admin-api",
    "dev:admin-web": "npm run dev --workspace=packages/admin-web",
    "build:all": "npm run build --workspaces"
  },
  "devDependencies": {
    "dotenv": "^16.0.0"
  }
}
```

### package.json для API (например, client-api)

```json
{
  "name": "@structure-apps/client-api",
  "version": "1.0.0",
  "private": true,
  "main": "src/index.js",
  "scripts": {
    "dev": "node src/index.js",
    "start": "NODE_ENV=production node src/index.js",
    "migrate": "node scripts/migrate.js"
  },
  "dependencies": {
    "@structure-apps/types": "workspace:*",
    "express": "^4.18.0",
    "dotenv": "^16.0.0"
  }
}
```

### package.json для фронтенда (например, admin-web)

```json
{
  "name": "@structure-apps/admin-web",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@structure-apps/types": "workspace:*",
    "@structure-apps/admin-api": "workspace:*",
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  },
  "devDependencies": {
    "vite": "^4.0.0",
    "@vitejs/plugin-react": "^4.0.0"
  }
}
```

### package.json для общих типов

```json
{
  "name": "@structure-apps/types",
  "version": "1.0.0",
  "private": true,
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "build": "tsc",
    "type-check": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
```

### Пример конфигурации с dotenv (client-api/src/config/index.js)

```javascript
require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  env: process.env.NODE_ENV || 'development',
  
  // База данных
  database: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    name: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  },
  
  // Если несколько БД
  analyticsDb: {
    host: process.env.DB_ANALYTICS_HOST,
    name: process.env.DB_ANALYTICS_NAME,
    user: process.env.DB_ANALYTICS_USER,
    password: process.env.DB_ANALYTICS_PASSWORD,
  },
  
  // JWT
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },
};
```

## Правила именования

### Пакеты

- **Формат**: `@structure-apps/<package-name>`
- **Примеры**:
  - `@structure-apps/client-api`
  - `@structure-apps/admin-api`
  - `@structure-apps/admin-web`
  - `@structure-apps/types`

### Директории

- **packages/** - все приложения (API, фронтенды, воркеры)
- **packages-shared/** - общие пакеты
- **docs/** - документация

### Файлы конфигурации

- `.env.example` - пример env-файла (коммитится в репозиторий)
- `.env` - реальный env-файл (в .gitignore)
- `package.json` - конфигурация пакета

## Взаимозависимости

### Граф зависимостей

```
admin-web
  └─→ admin-api
  └─→ @structure-apps/types

client-playground
  └─→ client-api
  └─→ @structure-apps/types

admin-api
  └─→ @structure-apps/types

client-api
  └─→ @structure-apps/types

internal-api
  └─→ @structure-apps/types

cron-jobs
  └─→ @structure-apps/types
  └─→ (может использовать client-api, admin-api)

queue-workers
  └─→ @structure-apps/types
  └─→ (может использовать client-api, admin-api)
```

### Указание зависимостей

В `package.json` приложения:

```json
{
  "dependencies": {
    "@structure-apps/types": "workspace:*",
    "@structure-apps/admin-api": "workspace:*"
  }
}
```

`workspace:*` означает, что используется локальная версия из workspace.

## Принципы организации

1. **Четкие границы**: Каждое приложение в отдельной директории
2. **Общие зависимости**: Вынесены в packages-shared (types, utils, schemas)
3. **Независимость**: Каждое приложение имеет свои зависимости и конфигурацию
4. **Взаимозависимости**: Явно указаны через package.json с `workspace:*`
5. **Конфигурация**: Через dotenv, каждый пакет имеет свой .env.example
6. **Миграции**: В каждом приложении или в общем пакете (в зависимости от архитектуры БД)
7. **Документация**: От общего к частному в директории docs/

## Структура документации

Документация организована от общего к частному:

```
docs/
├── README.md              # Общий обзор проекта
├── architecture.md        # Архитектура системы (общая)
├── api/                   # Документация API
│   ├── client-api.md
│   ├── admin-api.md
│   └── internal-api.md
├── frontend/              # Документация фронтенда
│   ├── admin-web.md
│   └── client-playground.md
└── backend/               # Документация бекенда
    ├── cron-jobs.md
    └── queue-workers.md
```

## Команды для работы

### Установка зависимостей

```bash
# Установить все зависимости для всех пакетов
npm install

# Установить зависимости для конкретного пакета
npm install --workspace=packages/client-api
```

### Запуск приложений

```bash
# Запуск конкретного приложения
npm run dev --workspace=packages/client-api

# Или из корня (если настроены скрипты)
npm run dev:client-api
```

### Сборка

```bash
# Сборка всех пакетов
npm run build --workspaces

# Сборка конкретного пакета
npm run build --workspace=packages/admin-web
```

## Следующие шаги

1. Создать структуру директорий
2. Инициализировать npm workspaces
3. Создать базовые package.json для каждого пакета
4. Настроить dotenv конфигурации
5. Создать структуру документации
