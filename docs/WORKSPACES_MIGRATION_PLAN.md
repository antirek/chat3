# План перехода на npm workspaces

## Цель
Реорганизовать проект chat3 в структуру npm workspaces согласно `PROJECT_STRUCTURE.md`.

## Текущая структура

```
chat3/
├── src/
│   ├── apps/              # Приложения
│   │   ├── tenant-api/
│   │   ├── gateway/
│   │   ├── control-api/
│   │   ├── api-test/
│   │   ├── update-worker/
│   │   └── dialog-read-worker/
│   ├── models/            # Модели (общие)
│   ├── utils/             # Утилиты (общие)
│   ├── config/            # Конфигурация (общая)
│   └── scripts/           # Скрипты (остаются в корне)
├── client/                # Клиентская библиотека
└── package.json
```

## Целевая структура

```
chat3/
├── packages/
│   ├── tenant-api/
│   ├── gateway/
│   ├── control-api/
│   ├── api-test/
│   ├── update-worker/
│   └── dialog-read-worker/
├── packages-shared/
│   ├── models/            # @chat3/models
│   ├── utils/             # @chat3/utils
│   └── config/            # @chat3/config
├── src/
│   └── scripts/           # Скрипты остаются здесь
├── client/                # Без изменений
├── .env                   # Общий env файл
└── package.json           # С workspaces
```

## Чеклист перехода

### Этап 1: Подготовка структуры директорий

- [ ] 1.1. Создать директории `packages/` и `packages-shared/`
- [ ] 1.2. Создать поддиректории в `packages-shared/`:
  - `packages-shared/models/`
  - `packages-shared/utils/`
  - `packages-shared/config/`
- [ ] 1.3. Создать поддиректории в `packages/`:
  - `packages/tenant-api/`
  - `packages/gateway/`
  - `packages/control-api/`
  - `packages/api-test/`
  - `packages/update-worker/`
  - `packages/dialog-read-worker/`

### Этап 2: Создание общих пакетов (packages-shared)

#### 2.1. packages-shared/models

- [ ] 2.1.1. Переместить `src/models/` → `packages-shared/models/src/`
- [ ] 2.1.2. Создать `packages-shared/models/package.json`:
  ```json
  {
    "name": "@chat3/models",
    "version": "0.0.24",
    "type": "module",
    "main": "src/index.js",
    "dependencies": {
      "mongoose": "^8.0.0"
    }
  }
  ```

#### 2.2. packages-shared/utils

- [ ] 2.2.1. Переместить `src/utils/` → `packages-shared/utils/src/`
- [ ] 2.2.2. Создать `packages-shared/utils/package.json`:
  ```json
  {
    "name": "@chat3/utils",
    "version": "0.0.24",
    "type": "module",
    "main": "src/index.js",
    "dependencies": {
      "amqplib": "^0.10.9",
      "@chat3/models": "workspace:*"
    }
  }
  ```
- [ ] 2.2.3. Создать `packages-shared/utils/src/index.js` для экспорта всех утилит

#### 2.3. packages-shared/config

- [ ] 2.3.1. Переместить `src/config/` → `packages-shared/config/src/`
- [ ] 2.3.2. Создать `packages-shared/config/package.json`:
  ```json
  {
    "name": "@chat3/config",
    "version": "0.0.24",
    "type": "module",
    "main": "src/database.js",
    "dependencies": {
      "mongoose": "^8.0.0"
    }
  }
  ```

### Этап 3: Перемещение приложений

#### 3.1. tenant-api

- [ ] 3.1.1. Переместить `src/apps/tenant-api/` → `packages/tenant-api/src/`
- [ ] 3.1.2. Создать `packages/tenant-api/package.json`
- [ ] 3.1.3. Обновить импорты в `packages/tenant-api/src/`:
  - `../../config/database.js` → `@chat3/config`
  - `../../utils/*` → `@chat3/utils`
  - `../../../models/` → `@chat3/models`

#### 3.2. gateway

- [ ] 3.2.1. Переместить `src/apps/gateway/` → `packages/gateway/src/`
- [ ] 3.2.2. Создать `packages/gateway/package.json`
- [ ] 3.2.3. Обновить импорты (аналогично tenant-api)
- [ ] 3.2.4. Обновить импорт control-api (если используется)

#### 3.3. control-api

- [ ] 3.3.1. Переместить `src/apps/control-api/` → `packages/control-api/src/`
- [ ] 3.3.2. Создать `packages/control-api/package.json`
- [ ] 3.3.3. Обновить импорты

#### 3.4. api-test

- [ ] 3.4.1. Переместить `src/apps/api-test/` → `packages/api-test/src/`
- [ ] 3.4.2. Создать `packages/api-test/package.json`
- [ ] 3.4.3. Обновить импорты

#### 3.5. update-worker

- [ ] 3.5.1. Переместить `src/apps/update-worker/` → `packages/update-worker/src/`
- [ ] 3.5.2. Создать `packages/update-worker/package.json`
- [ ] 3.5.3. Обновить импорты

#### 3.6. dialog-read-worker

- [ ] 3.6.1. Переместить `src/apps/dialog-read-worker/` → `packages/dialog-read-worker/src/`
- [ ] 3.6.2. Создать `packages/dialog-read-worker/package.json`
- [ ] 3.6.3. Обновить импорты

### Этап 4: Обновление корневого package.json

- [ ] 4.1. Добавить workspaces в корневой `package.json`:
  ```json
  {
    "workspaces": [
      "packages/*",
      "packages-shared/*"
    ]
  }
  ```
- [ ] 4.2. Обновить скрипты запуска:
  - `start:tenant-api` → `npm run start --workspace=packages/tenant-api`
  - `start:gateway` → `npm run start --workspace=packages/gateway`
  - и т.д.
- [ ] 4.3. Обновить скрипты для scripts (seed, generate-key и т.д.)

### Этап 5: Обновление скриптов запуска

- [ ] 5.1. Обновить `start-all.sh` под новую структуру
- [ ] 5.2. Обновить `start-update-worker.sh` (если есть)
- [ ] 5.3. Обновить `start-dialog-read-worker.sh` (если есть)
- [ ] 5.4. Обновить `restart.sh` (если есть)

### Этап 6: Обновление скриптов в src/scripts

- [ ] 6.1. Обновить импорты в `src/scripts/*.js`:
  - `../config/database.js` → `@chat3/config`
  - `../models/` → `@chat3/models`
  - `../utils/` → `@chat3/utils`

### Этап 7: Создание .env файла

- [ ] 7.1. Создать `.env.example` в корне (если нет)
- [ ] 7.2. Убедиться, что все приложения используют общий `.env`

### Этап 8: Обновление тестов

- [ ] 8.1. Обновить импорты в тестах каждого пакета
- [ ] 8.2. Обновить jest.config.js в каждом пакете (если нужен)
- [ ] 8.3. Обновить корневой jest.config.js для общих тестов

### Этап 9: Установка зависимостей и проверка

- [ ] 9.1. Удалить старые `node_modules/` и `package-lock.json`
- [ ] 9.2. Выполнить `npm install` в корне
- [ ] 9.3. Проверить, что все зависимости установлены правильно
- [ ] 9.4. Проверить, что workspace зависимости работают

### Этап 10: Тестирование

- [ ] 10.1. Запустить `npm run start:tenant-api` - проверить работоспособность
- [ ] 10.2. Запустить `npm run start:gateway` - проверить работоспособность
- [ ] 10.3. Запустить `npm run start:update-worker` - проверить работоспособность
- [ ] 10.4. Запустить `npm run start:dialog-read-worker` - проверить работоспособность
- [ ] 10.5. Запустить `npm run seed` - проверить скрипты
- [ ] 10.6. Запустить `npm run generate-key` - проверить скрипты
- [ ] 10.7. Запустить `npm test` - проверить тесты
- [ ] 10.8. Запустить `npm run start:all` - проверить комплексный запуск

### Этап 11: Очистка

- [ ] 11.1. Удалить пустую директорию `src/apps/` (если пуста)
- [ ] 11.2. Удалить пустую директорию `src/models/` (если пуста)
- [ ] 11.3. Удалить пустую директорию `src/utils/` (если пуста)
- [ ] 11.4. Удалить пустую директорию `src/config/` (если пуста)
- [ ] 11.5. Обновить `.gitignore` (если нужно)

### Этап 12: Документация

- [ ] 12.1. Обновить `README.md` с новой структурой
- [ ] 12.2. Обновить `docs/PROJECT_STRUCTURE.md` (если нужно)
- [ ] 12.3. Создать/обновить документацию по запуску

## Детали реализации

### Именование пакетов

Все пакеты будут использовать префикс `@chat3/`:
- `@chat3/models`
- `@chat3/utils`
- `@chat3/config`
- `@chat3/tenant-api`
- `@chat3/gateway`
- `@chat3/control-api`
- `@chat3/api-test`
- `@chat3/update-worker`
- `@chat3/dialog-read-worker`

### Зависимости между пакетами

```
tenant-api → @chat3/models, @chat3/utils, @chat3/config
gateway → @chat3/models, @chat3/utils, @chat3/config, @chat3/control-api
control-api → @chat3/models, @chat3/utils, @chat3/config
api-test → @chat3/models, @chat3/utils, @chat3/config
update-worker → @chat3/models, @chat3/utils, @chat3/config
dialog-read-worker → @chat3/models, @chat3/utils, @chat3/config
utils → @chat3/models
```

### Пример package.json для приложения

```json
{
  "name": "@chat3/tenant-api",
  "version": "0.0.24",
  "type": "module",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "dev": "node --watch src/index.js",
    "test": "node --experimental-vm-modules node_modules/jest/bin/jest.js"
  },
  "dependencies": {
    "@chat3/models": "workspace:*",
    "@chat3/utils": "workspace:*",
    "@chat3/config": "workspace:*",
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "swagger-ui-express": "^5.0.0",
    "swagger-jsdoc": "^6.2.8"
  },
  "devDependencies": {
    "jest": "^30.2.0"
  }
}
```

### Пример обновления импортов

**Было:**
```javascript
import connectDB from '../../config/database.js';
import * as rabbitmqUtils from '../../utils/rabbitmqUtils.js';
import { Dialog, Message } from '../../../models/index.js';
```

**Стало:**
```javascript
import connectDB from '@chat3/config';
import * as rabbitmqUtils from '@chat3/utils/rabbitmqUtils.js';
import { Dialog, Message } from '@chat3/models';
```

## Риски и решения

### Риск 1: Циклические зависимости
**Решение:** Строго соблюдать иерархию: models → utils → config → приложения

### Риск 2: Проблемы с путями в тестах
**Решение:** Использовать абсолютные пути или настроить jest правильно

### Риск 3: Потеря работоспособности во время миграции
**Решение:** Делать по этапам, тестировать после каждого этапа

## Порядок выполнения

Рекомендуемый порядок:
1. Сначала создать общие пакеты (packages-shared)
2. Затем переместить приложения по одному
3. После каждого приложения проверять работоспособность
4. В конце обновить скрипты и документацию

## Время выполнения

Ориентировочно: 2-4 часа (в зависимости от количества тестов и проверок)
