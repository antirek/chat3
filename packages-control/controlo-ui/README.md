# Controlo UI - Vue 3 + FSD

Админ-панель для тестирования API Chat3, переписанная на Vue 3 с использованием Feature-Sliced Design архитектуры.

## Технологии

- Vue 3 (Composition API)
- TypeScript
- Vite
- Pinia (state management)
- Vue Router
- Axios
- Express (для статики и config.js)

## Структура проекта (FSD)

```
src/
├── app/          # Инициализация приложения
├── shared/       # Переиспользуемые компоненты и утилиты
├── entities/     # Бизнес-сущности
├── features/     # Функциональные возможности
├── widgets/      # Композитные блоки
└── pages/        # Страницы приложения
```

## Установка

```bash
npm install
```

## Разработка

### Режим разработки (Vite dev server)

```bash
npm run dev
```

Приложение будет доступно на `http://localhost:3003`

**Примечание:** В режиме разработки `config.js` генерируется автоматически через Vite плагин. Express сервер запускать не нужно.

### Production режим (Express сервер)

```bash
# Сначала соберите проект
npm run build

# Затем запустите сервер
npm run server
# или
npm start
```

В production режиме Express сервер отдает статику из `dist/` и генерирует `config.js` динамически.

## Переменные окружения

- `CONTROL_APP_URL` - URL контрольного приложения (по умолчанию: `http://localhost:3003`)
- `TENANT_API_URL` - URL API тенантов (по умолчанию: `http://localhost:3000`)
- `RABBITMQ_MANAGEMENT_URL` - URL RabbitMQ Management (по умолчанию: `http://localhost:15672`)
- `MMS3_PROJECT_NAME` - Имя проекта (по умолчанию: `chat3`)
- `NODE_ENV` - Режим работы (`development` или `production`)

## E2E тесты

```bash
# Все тесты
npm run test:e2e

# С UI
npm run test:e2e:ui

# Конкретные тесты
npm run test:e2e:members
npm run test:e2e:add-member
```

## Документация

- [План миграции](./VUE3_MIGRATION_PLAN.md)
- [Структура FSD](./FSD_STRUCTURE.md)
- [Быстрый старт](./QUICK_START.md)

## Статус миграции

- ✅ Этап 1: Настройка проекта
- ⏳ Этап 2: Shared слой
- ⏳ Этап 3: Entities слой
- ⏳ Этап 4: Features слой
- ⏳ Этап 5: Widgets слой
- ⏳ Этап 6: Pages слой
- ⏳ Этап 7: Интеграция и тестирование
- ⏳ Этап 8: Финальная полировка
