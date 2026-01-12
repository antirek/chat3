# Быстрый старт миграции на Vue 3 + FSD

## Основные принципы FSD

### Слои (от низкого к высокому уровню абстракции):

1. **shared/** - Переиспользуемый код (UI компоненты, утилиты, типы)
2. **entities/** - Бизнес-сущности (tenant, user, dialog, message, member)
3. **features/** - Функциональные возможности (column, modals, forms)
4. **widgets/** - Композитные блоки (страницы с несколькими features)
5. **pages/** - Страницы приложения (роуты)

### Правила импортов:

- ✅ Можно импортировать из слоев **ниже** по иерархии
- ❌ Нельзя импортировать из слоев **выше** по иерархии
- ✅ Можно импортировать из **того же** слоя

## Структура каждого слоя

### Entity (например, `entities/tenant/`)

```
tenant/
├── ui/          # UI компоненты сущности
├── model/       # Store, типы, бизнес-логика
└── api/         # API методы для работы с сущностью
```

### Feature (например, `features/column/`)

```
column/
├── ui/          # UI компоненты фичи
└── model/       # Композиции (composables), логика
```

### Widget (например, `widgets/tenants-page/`)

```
tenants-page/
├── ui/          # Композитный компонент страницы
└── model/       # Логика страницы (если нужна)
```

## Ключевые компоненты для реализации

### 1. Column Feature (основа всех страниц)

- **Column.vue** - главный компонент
- **ColumnHeader.vue** - заголовок с кнопками
- **ColumnFilter.vue** - фильтр с примерами
- **ColumnTable.vue** - таблица с данными
- **ColumnPagination.vue** - пагинация
- **useColumn.ts** - композиция для управления состоянием

### 2. Модальные окна (Features)

- **InfoModal** - просмотр JSON
- **MetaModal** - редактирование мета-тегов
- **UrlModal** - отображение URL запроса
- **DeleteConfirmModal** - подтверждение удаления
- **FormModal** - базовая форма (для Add/Edit)

### 3. Entities

Каждая сущность должна иметь:
- **Store** (Pinia) для управления состоянием
- **API методы** для работы с бэкендом
- **UI компоненты** (таблица, форма, модальные окна)
- **Типы** TypeScript

## Порядок разработки

### Шаг 1: Shared слой
1. Базовые UI компоненты (Button, Modal, Table, Input)
2. API клиент
3. Утилиты (даты, JSON, копирование)
4. Типы

### Шаг 2: Column Feature
1. Компонент Column
2. Композиция useColumn
3. Интеграция с базовыми UI компонентами

### Шаг 3: Модальные окна (Features)
1. InfoModal
2. MetaModal
3. UrlModal
4. DeleteConfirmModal
5. FormModal

### Шаг 4: Entities
1. Tenant (как пример)
2. User
3. Dialog
4. Message
5. Member

### Шаг 5: Widgets (страницы)
1. TenantsPage (простая страница)
2. UsersPage
3. MessagesPage
4. DialogsMessagesPage (две колонки)
5. UserDialogsPage (три колонки)
6. DbExplorerPage

### Шаг 6: Pages и роутинг
1. Создание страниц-оберток
2. Настройка Vue Router

## Технологии

- **Vue 3** (Composition API)
- **TypeScript**
- **Vite** (сборка)
- **Pinia** (state management)
- **Vue Router** (роутинг)
- **Axios** (HTTP клиент)

## Команды для разработки

```bash
# Установка зависимостей
npm install

# Разработка
npm run dev

# Сборка
npm run build

# E2E тесты
npm run test:e2e
```

## Важные моменты

1. **Конфигурация** - загружается из `/config.js` endpoint (Express)
2. **API ключ** - передается через query параметр `?apiKey=...`
3. **Tenant ID** - передается через query параметр `?tenantId=...`
4. **Совместимость** - Express сервер остается для статики и config.js
5. **Тесты** - все E2E тесты должны продолжать работать

## Чек-лист миграции

- [ ] Настройка проекта (Vite, TypeScript, зависимости)
- [ ] Shared слой (UI компоненты, утилиты, API клиент)
- [ ] Column Feature
- [ ] Модальные окна (Info, Meta, URL, Delete, Form)
- [ ] Entities (Tenant, User, Dialog, Message, Member)
- [ ] Widgets (все страницы)
- [ ] Pages и роутинг
- [ ] Адаптация E2E тестов
- [ ] Тестирование всех страниц
- [ ] Финальная полировка

## Полезные ссылки

- [Feature-Sliced Design](https://feature-sliced.design/)
- [Vue 3 Documentation](https://vuejs.org/)
- [Pinia Documentation](https://pinia.vuejs.org/)
- [Vite Documentation](https://vitejs.dev/)
