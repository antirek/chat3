# План миграции controlo-ui на Vue 3 с FSD

## Текущее состояние

- Express сервер, отдающий статические HTML файлы
- 8 HTML страниц для тестирования API
- E2E тесты на Playwright
- Спецификация UI в `src/specs/ui.spec.md`

## Цель миграции

Переписать приложение на Vue 3 с использованием Feature-Sliced Design (FSD) архитектуры, сохранив всю функциональность и E2E тесты.

## Структура FSD для Vue 3

```
src/
├── app/                    # Инициализация приложения
│   ├── App.vue
│   ├── main.ts
│   ├── router/
│   │   └── index.ts
│   └── stores/
│       └── config.ts      # Глобальная конфигурация (URLs, версия)
│
├── shared/                 # Переиспользуемые компоненты и утилиты
│   ├── ui/                 # Базовые UI компоненты
│   │   ├── Button/
│   │   ├── Modal/
│   │   ├── Table/
│   │   ├── Pagination/
│   │   ├── Filter/
│   │   ├── Input/
│   │   ├── Select/
│   │   ├── Tooltip/
│   │   └── index.ts
│   ├── lib/                # Утилиты и хелперы
│   │   ├── api/
│   │   │   ├── client.ts
│   │   │   ├── endpoints.ts
│   │   │   └── types.ts
│   │   ├── utils/
│   │   │   ├── date.ts
│   │   │   ├── json.ts
│   │   │   ├── copy.ts
│   │   │   └── validation.ts
│   │   └── constants/
│   │       └── filterExamples.ts
│   ├── types/              # Общие типы
│   │   ├── api.ts
│   │   ├── entities.ts
│   │   └── common.ts
│   └── config/             # Конфигурация
│       └── env.ts
│
├── entities/               # Бизнес-сущности
│   ├── tenant/
│   │   ├── ui/
│   │   │   ├── TenantTable.vue
│   │   │   ├── TenantForm.vue
│   │   │   └── TenantMetaModal.vue
│   │   ├── model/
│   │   │   ├── store.ts
│   │   │   └── types.ts
│   │   └── api/
│   │       └── tenantApi.ts
│   ├── user/
│   ├── dialog/
│   ├── message/
│   ├── member/
│   └── meta/               # Общая логика работы с мета-тегами
│
├── features/               # Функциональные возможности
│   ├── column/             # Компонент Колонка (Header, Filter, Table, Pagination)
│   │   ├── ui/
│   │   │   ├── Column.vue
│   │   │   ├── ColumnHeader.vue
│   │   │   ├── ColumnFilter.vue
│   │   │   └── ColumnPagination.vue
│   │   └── model/
│   │       └── useColumn.ts
│   ├── info-modal/         # Модальное окно для просмотра JSON
│   │   ├── ui/
│   │   │   └── InfoModal.vue
│   │   └── model/
│   │       └── useInfoModal.ts
│   ├── meta-modal/         # Модальное окно для работы с мета-тегами
│   │   ├── ui/
│   │   │   └── MetaModal.vue
│   │   └── model/
│   │       └── useMetaModal.ts
│   ├── url-modal/          # Модальное окно для отображения URL
│   │   ├── ui/
│   │   │   └── UrlModal.vue
│   │   └── model/
│   │       └── useUrlModal.ts
│   ├── delete-confirm/     # Подтверждение удаления
│   │   └── ui/
│   │       └── DeleteConfirmModal.vue
│   └── form-modal/         # Базовый компонент для форм в модальных окнах
│       └── ui/
│           └── FormModal.vue
│
├── widgets/                # Композитные блоки интерфейса
│   ├── header/             # Шапка приложения
│   │   └── ui/
│   │       └── AppHeader.vue
│   ├── tenants-page/       # Страница Тенанты
│   │   └── ui/
│   │       └── TenantsPage.vue
│   ├── users-page/         # Страница Пользователи
│   │   └── ui/
│   │       └── UsersPage.vue
│   ├── messages-page/      # Страница Сообщения
│   │   └── ui/
│   │       └── MessagesPage.vue
│   ├── dialogs-messages-page/  # Страница Диалоги + Сообщения
│   │   └── ui/
│   │       └── DialogsMessagesPage.vue
│   ├── user-dialogs-page/  # Страница Пользователи + Диалоги + Сообщения/Участники
│   │   └── ui/
│   │       └── UserDialogsPage.vue
│   └── db-explorer/        # DB Explorer страница
│       └── ui/
│           └── DbExplorerPage.vue
│
└── pages/                  # Страницы приложения
    ├── TenantsPage.vue
    ├── UsersPage.vue
    ├── MessagesPage.vue
    ├── DialogsMessagesPage.vue
    ├── UserDialogsPage.vue
    ├── DbExplorerPage.vue
    ├── EventsUpdatesPage.vue
    └── InitPage.vue
```

## Этапы миграции

### Этап 1: Настройка проекта (1-2 дня)

1. **Установка зависимостей**
   - Vue 3, Vue Router, Pinia
   - Vite для сборки
   - TypeScript
   - Axios для HTTP запросов
   - Библиотеки для UI (опционально: Element Plus, Vuetify или кастомные компоненты)

2. **Настройка Vite**
   - Конфигурация для разработки и продакшена
   - Прокси для API
   - Обработка переменных окружения

3. **Базовая структура FSD**
   - Создание папок по слоям FSD
   - Настройка алиасов путей (`@/shared`, `@/entities`, и т.д.)
   - Базовые конфигурационные файлы

4. **Адаптация Express сервера**
   - Оставить Express для отдачи статики и `/config.js`
   - Интеграция с Vite dev server или сборка статики

### Этап 2: Shared слой (2-3 дня)

1. **UI компоненты (shared/ui)**
   - Button
   - Modal (базовый компонент)
   - Table
   - Pagination
   - Filter (поле ввода с примерами)
   - Input, Select
   - Tooltip
   - Loading/Spinner

2. **Утилиты (shared/lib)**
   - API клиент с interceptors
   - Форматирование дат
   - Работа с JSON (форматирование, копирование)
   - Валидация форм
   - Примеры фильтров для разных сущностей

3. **Типы (shared/types)**
   - Типы для API запросов/ответов
   - Типы сущностей
   - Общие типы (фильтры, пагинация, сортировка)

4. **Конфигурация (shared/config)**
   - Загрузка конфигурации из `/config.js`
   - Типы для конфигурации

### Этап 3: Entities слой (3-4 дня)

1. **Tenant entity**
   - API методы
   - Store (Pinia)
   - UI компоненты (таблица, форма, модальное окно мета)

2. **User entity**
   - Аналогично Tenant

3. **Dialog entity**
   - API методы
   - Store
   - UI компоненты

4. **Message entity**
   - API методы
   - Store
   - UI компоненты

5. **Member entity**
   - API методы
   - Store
   - UI компоненты

6. **Meta entity (общая логика)**
   - Утилиты для работы с мета-тегами
   - Общие типы

### Этап 4: Features слой (3-4 дня)

1. **Column feature**
   - Компонент Column с Header, Filter, Table, Pagination
   - Хук useColumn для управления состоянием
   - Интеграция с entities

2. **Info Modal feature**
   - Модальное окно для просмотра JSON
   - Копирование в буфер обмена
   - Форматирование JSON

3. **Meta Modal feature**
   - Модальное окно для редактирования мета-тегов
   - Добавление/удаление/редактирование тегов

4. **URL Modal feature**
   - Отображение URL запроса
   - Копирование URL и параметров

5. **Delete Confirm feature**
   - Модальное окно подтверждения удаления

6. **Form Modal feature**
   - Базовый компонент для форм в модальных окнах
   - Валидация
   - Обработка ошибок

### Этап 5: Widgets слой (4-5 дней)

1. **AppHeader widget**
   - Шапка приложения
   - Навигация между страницами
   - Отображение конфигурации

2. **TenantsPage widget**
   - Интеграция Column feature
   - Интеграция с Tenant entity
   - Модальные окна (Info, Meta, Add, Delete)

3. **UsersPage widget**
   - Аналогично TenantsPage

4. **MessagesPage widget**
   - Аналогично, но без кнопки Добавить

5. **DialogsMessagesPage widget**
   - Две колонки (Диалоги и Сообщения)
   - Связь между колонками

6. **UserDialogsPage widget**
   - Три колонки (Пользователи, Диалоги, Сообщения/Участники)
   - Переключение между Сообщения и Участники
   - Сохранение состояния фильтров

7. **DbExplorerPage widget**
   - Панель моделей слева
   - Панель данных справа
   - Работа с MongoDB коллекциями

### Этап 6: Pages слой (1-2 дня)

1. **Создание страниц**
   - Обертка для каждого widget
   - Настройка роутинга

2. **Настройка Vue Router**
   - Маршруты для всех страниц
   - Навигация

### Этап 7: Интеграция и тестирование (2-3 дня)

1. **Адаптация E2E тестов**
   - Обновление селекторов под Vue компоненты
   - Проверка работоспособности всех тестов

2. **Интеграционное тестирование**
   - Проверка всех страниц
   - Проверка модальных окон
   - Проверка фильтров и пагинации

3. **Исправление багов**
   - Устранение найденных проблем
   - Оптимизация производительности

### Этап 8: Финальная полировка (1-2 дня)

1. **Стилизация**
   - Приведение к единому стилю
   - Адаптивность (если требуется)

2. **Документация**
   - Обновление README
   - Комментарии в коде

3. **Оптимизация**
   - Code splitting
   - Lazy loading роутов
   - Оптимизация бандла

## Технический стек

- **Vue 3** (Composition API)
- **TypeScript**
- **Vite** (сборщик)
- **Vue Router** (роутинг)
- **Pinia** (state management)
- **Axios** (HTTP клиент)
- **Playwright** (E2E тесты)
- **ESLint + Prettier** (линтинг и форматирование)

## Важные моменты

1. **Совместимость с Express сервером**
   - Сохранить `/config.js` endpoint
   - Статические файлы должны отдаваться через Express или Vite

2. **Сохранение функциональности**
   - Все требования из `ui.spec.md` должны быть реализованы
   - Все E2E тесты должны проходить

3. **FSD принципы**
   - Слои не должны импортировать из вышележащих слоев
   - Shared - переиспользуемый код
   - Entities - бизнес-логика сущностей
   - Features - функциональные возможности
   - Widgets - композитные блоки
   - Pages - страницы приложения

4. **TypeScript**
   - Строгая типизация
   - Типы для всех API запросов/ответов
   - Типы для всех сущностей

## Оценка времени

**Общее время: 18-25 дней**

- Этап 1: 1-2 дня
- Этап 2: 2-3 дня
- Этап 3: 3-4 дня
- Этап 4: 3-4 дня
- Этап 5: 4-5 дней
- Этап 6: 1-2 дня
- Этап 7: 2-3 дня
- Этап 8: 1-2 дня

## Риски и митигация

1. **Риск**: Сложность миграции E2E тестов
   - **Митигация**: Начать адаптацию тестов параллельно с разработкой

2. **Риск**: Несовместимость с существующим Express сервером
   - **Митигация**: Сохранить Express для статики и config.js, Vue приложение как SPA

3. **Риск**: Потеря функциональности при миграции
   - **Митигация**: Чек-лист на основе ui.spec.md, регулярное тестирование
