# План рефакторинга страниц

## Цель
Реорганизовать монолитные страницы в структуру FSD, вынося переиспользуемые части в shared, features и entities.

## Что такое `model/` в FSD?

В FSD архитектуре папка `model/` содержит **всю бизнес-логику**, которая не является UI компонентами.

### Что хранится в `model/`:

1. **Composables** (`useXxx.ts`) - функции с логикой, которые можно переиспользовать
   - Управление состоянием (ref, reactive)
   - Функции обработки данных
   - API вызовы
   - Обработчики событий

2. **Stores** (`store.ts`) - Pinia stores для глобального состояния (если нужен)

3. **Types** (`types.ts`) - TypeScript типы и интерфейсы

4. **Логика** - все функции, вычисления, обработчики из `<script setup>`

### Пример для `pages/tenants/model/`:

В `useTenantsPage.ts` будет вся логика, которая сейчас находится в `<script setup>` компонента:

```typescript
// pages/tenants/model/useTenantsPage.ts

import { ref, computed } from 'vue';
import { useConfigStore, useCredentialsStore } from '@/app/stores';

export function useTenantsPage() {
  // Состояние (refs)
  const tenants = ref([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const currentPage = ref(1);
  const currentLimit = ref(20);
  const totalTenants = ref(0);
  const totalPages = ref(1);
  
  // Computed свойства
  const paginationStart = computed(() => {
    return (currentPage.value - 1) * currentLimit.value + 1;
  });
  
  // Функции
  async function loadTenants() {
    // логика загрузки
  }
  
  function toggleSort(field: string) {
    // логика сортировки
  }
  
  // Возвращаем всё, что нужно в компоненте
  return {
    tenants,
    loading,
    error,
    currentPage,
    currentLimit,
    totalTenants,
    totalPages,
    paginationStart,
    loadTenants,
    toggleSort,
    // ... остальное
  };
}
```

А в компоненте останется только:

```vue
<script setup lang="ts">
import { useTenantsPage } from '../model/useTenantsPage';

const {
  tenants,
  loading,
  loadTenants,
  // ... остальное
} = useTenantsPage();
</script>
```

## Этап 1: Создание структуры папок для страниц

### Подход: Постепенная миграция

Начнем с создания папок для каждой страницы, куда перенесем логику из монолитных компонентов.

```
src/pages/
├── tenants/
│   ├── ui/
│   │   └── TenantsPage.vue          # Основной компонент страницы (только template + минимальный script)
│   ├── model/
│   │   ├── useTenantsPage.ts        # Composable с логикой страницы (все refs, функции, computed)
│   │   ├── useTenantsTable.ts       # Логика таблицы (если выносим отдельно)
│   │   ├── useTenantsFilters.ts     # Логика фильтров (если выносим отдельно)
│   │   └── useTenantsModals.ts      # Логика модальных окон (если выносим отдельно)
│   └── index.ts                     # Экспорт
│
├── users/
│   ├── ui/
│   │   └── UsersPage.vue
│   ├── model/
│   │   ├── useUsersPage.ts
│   │   └── ...
│   └── index.ts
│
├── messages/
│   ├── ui/
│   │   └── MessagesPage.vue
│   ├── model/
│   │   └── ...
│   └── index.ts
│
└── ... (остальные страницы)
```

## Этап 2: Вынесение общих частей в shared

### 2.1. Shared UI компоненты

```
src/shared/ui/
├── Button/
│   ├── Button.vue                   # Базовый компонент кнопки
│   └── index.ts
│
├── Modal/
│   ├── Modal.vue                    # Базовый модальный компонент
│   ├── ModalHeader.vue
│   ├── ModalBody.vue
│   ├── ModalFooter.vue
│   └── index.ts
│
├── Table/
│   ├── Table.vue                    # Базовая таблица
│   ├── TableHeader.vue
│   ├── TableRow.vue
│   └── index.ts
│
├── Pagination/
│   ├── Pagination.vue               # Компонент пагинации
│   └── index.ts
│
├── Filter/
│   ├── FilterInput.vue              # Поле ввода фильтра
│   ├── FilterExamples.vue           # Выпадающий список примеров
│   └── index.ts
│
├── JsonViewer/
│   ├── JsonViewer.vue               # Отображение JSON
│   └── index.ts
│
├── UrlModal/
│   ├── UrlModal.vue                 # Модальное окно с URL
│   └── index.ts
│
└── MetaEditor/
    ├── MetaEditor.vue               # Редактор мета-тегов
    └── index.ts
```

### 2.2. Shared утилиты

```
src/shared/lib/
├── api/
│   ├── client.ts                    # Axios instance
│   ├── endpoints.ts                 # Константы endpoints
│   └── types.ts
│
├── utils/
│   ├── date.ts                      # formatTimestamp и др.
│   ├── json.ts                      # JSON форматирование
│   ├── copy.ts                      # Копирование в буфер
│   ├── url.ts                       # getTenantApiUrl, getControlApiUrl
│   └── validation.ts
│
└── composables/
    ├── usePagination.ts             # Логика пагинации
    ├── useFilter.ts                 # Логика фильтров
    ├── useSort.ts                   # Логика сортировки
    ├── useModal.ts                  # Управление модальными окнами
    └── useApi.ts                    # Базовые API вызовы
```

## Этап 3: Создание Features

### 3.1. Feature: Pagination

```
src/features/pagination/
├── ui/
│   └── PaginationControls.vue       # Полный компонент пагинации
└── model/
    └── usePagination.ts             # Composable (переместить из shared)
```

### 3.2. Feature: Filter

```
src/features/filter/
├── ui/
│   ├── FilterPanel.vue              # Панель фильтров
│   └── FilterExamples.vue
└── model/
    └── useFilter.ts                 # Composable (переместить из shared)
```

### 3.3. Feature: Table

```
src/features/table/
├── ui/
│   ├── DataTable.vue                # Таблица с сортировкой
│   └── TableActions.vue            # Кнопки действий
└── model/
    └── useTable.ts                  # Composable для таблицы
```

### 3.4. Feature: Meta

```
src/features/meta/
├── ui/
│   ├── MetaEditor.vue               # Редактор мета-тегов
│   └── MetaViewer.vue               # Просмотр мета-тегов
└── model/
    └── useMeta.ts                   # Логика работы с мета-тегами
```

## Этап 4: Создание Entities

### 4.1. Entity: Tenant

```
src/entities/tenant/
├── ui/
│   ├── TenantTable.vue              # Таблица тенантов
│   ├── TenantForm.vue               # Форма создания/редактирования
│   ├── TenantInfoModal.vue          # Модальное окно с информацией
│   └── TenantMetaModal.vue          # Модальное окно мета-тегов
├── model/
│   ├── store.ts                     # Pinia store (если нужен)
│   ├── types.ts                     # TypeScript типы
│   └── useTenant.ts                 # Composable для работы с тенантом
└── api/
    ├── tenantApi.ts                 # API методы для тенантов
    └── types.ts                     # Типы API запросов/ответов
```

### 4.2. Entity: User

```
src/entities/user/
├── ui/
│   ├── UserTable.vue
│   ├── UserForm.vue
│   └── ...
├── model/
│   └── ...
└── api/
    └── userApi.ts
```

### 4.3. Entity: Message, Dialog и т.д.

Аналогично для остальных сущностей.

## Этап 5: Создание Widgets

После вынесения логики, страницы станут тонкими обертками:

```
src/widgets/tenants-page/
├── ui/
│   └── TenantsPage.vue              # Композитный компонент
└── index.ts
```

А в `pages/tenants/` будет просто:

```vue
<template>
  <TenantsPageWidget />
</template>

<script setup lang="ts">
import { TenantsPageWidget } from '@/widgets/tenants-page';
</script>
```

## Порядок выполнения

### Шаг 1: Создать структуру папок для одной страницы (TenantsPage)

1. Создать `pages/tenants/ui/TenantsPage.vue`
2. Перенести компонент из `pages/TenantsPage.vue`
3. Создать `pages/tenants/model/useTenantsPage.ts` и вынести логику
4. Обновить роутер

### Шаг 2: Вынести общие утилиты

1. Создать `shared/lib/utils/date.ts` → `formatTimestamp`
2. Создать `shared/lib/utils/url.ts` → `getTenantApiUrl`, `getControlApiUrl`
3. Создать `shared/lib/utils/copy.ts` → функция копирования
4. Создать `shared/lib/utils/json.ts` → форматирование JSON

### Шаг 3: Вынести общие composables

1. Создать `shared/lib/composables/usePagination.ts`
2. Создать `shared/lib/composables/useFilter.ts`
3. Создать `shared/lib/composables/useSort.ts`
4. Создать `shared/lib/composables/useModal.ts`

### Шаг 4: Создать базовые UI компоненты

1. `shared/ui/Modal/Modal.vue` - базовый модальный компонент
2. `shared/ui/Pagination/Pagination.vue` - компонент пагинации
3. `shared/ui/Filter/FilterInput.vue` - поле фильтра
4. `shared/ui/JsonViewer/JsonViewer.vue` - просмотр JSON
5. `shared/ui/UrlModal/UrlModal.vue` - модальное окно с URL

### Шаг 5: Создать Features

1. `features/pagination/` - полный компонент пагинации
2. `features/filter/` - панель фильтров
3. `features/table/` - таблица с сортировкой
4. `features/meta/` - работа с мета-тегами

### Шаг 6: Создать Entities

1. `entities/tenant/` - вся логика работы с тенантами
2. `entities/user/` - вся логика работы с пользователями
3. И так далее для остальных сущностей

### Шаг 7: Рефакторинг остальных страниц

Применить ту же структуру к остальным страницам, используя уже созданные shared компоненты и features.

## Пример миграции TenantsPage

### До (монолитный компонент):
```vue
<!-- pages/TenantsPage.vue - 1487 строк -->
```

### После (рефакторинг):

#### pages/tenants/ui/TenantsPage.vue
```vue
<template>
  <div class="tenants-page">
    <PageHeader 
      title="🏢 Тенанты"
      :actions="headerActions"
    />
    
    <FilterPanel
      v-model="filterInput"
      :examples="filterExamples"
      @apply="applyFilter"
      @clear="clearFilter"
    />
    
    <PaginationControls
      v-model:page="currentPage"
      v-model:limit="currentLimit"
      :total="totalTenants"
      :total-pages="totalPages"
    />
    
    <TenantTable
      :tenants="tenants"
      :loading="loading"
      :error="error"
      :sort="currentSort"
      @sort="toggleSort"
      @info="showInfoModal"
      @edit="showEditModal"
      @meta="showMetaModal"
    />
    
    <!-- Модальные окна -->
    <TenantInfoModal
      v-model="showInfoModalFlag"
      :tenant-id="selectedTenantId"
    />
    
    <TenantCreateModal
      v-model="showCreateModalFlag"
      @created="handleTenantCreated"
    />
    
    <TenantMetaModal
      v-model="showMetaModalFlag"
      :tenant-id="selectedTenantId"
    />
    
    <UrlModal
      v-model="showUrlModalFlag"
      :url="generatedUrl"
    />
  </div>
</template>

<script setup lang="ts">
import { useTenantsPage } from '../model/useTenantsPage';
import { PageHeader } from '@/shared/ui';
import { FilterPanel } from '@/features/filter';
import { PaginationControls } from '@/features/pagination';
import { TenantTable, TenantInfoModal, TenantCreateModal, TenantMetaModal } from '@/entities/tenant';
import { UrlModal } from '@/shared/ui';

const {
  tenants,
  loading,
  error,
  currentPage,
  currentLimit,
  totalTenants,
  totalPages,
  filterInput,
  currentSort,
  showInfoModalFlag,
  showCreateModalFlag,
  showMetaModalFlag,
  showUrlModalFlag,
  selectedTenantId,
  generatedUrl,
  applyFilter,
  clearFilter,
  toggleSort,
  showInfoModal,
  showEditModal,
  showMetaModal,
  handleTenantCreated,
} = useTenantsPage();

const headerActions = [
  { label: '➕ Создать тенант', action: () => showCreateModalFlag.value = true },
  { label: 'URL', action: () => showUrlModalFlag.value = true },
];
</script>
```

#### pages/tenants/model/useTenantsPage.ts
```typescript
import { ref, computed } from 'vue';
import { usePagination } from '@/shared/lib/composables/usePagination';
import { useFilter } from '@/shared/lib/composables/useFilter';
import { useSort } from '@/shared/lib/composables/useSort';
import { useModal } from '@/shared/lib/composables/useModal';
import { tenantApi } from '@/entities/tenant/api';

export function useTenantsPage() {
  const { currentPage, currentLimit, totalPages, ...pagination } = usePagination();
  const { filterInput, currentFilter, applyFilter, clearFilter } = useFilter();
  const { currentSort, toggleSort } = useSort('createdAt', -1);
  const { showModal: showInfoModalFlag, ...modals } = useModal();
  
  const tenants = ref([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const totalTenants = ref(0);
  
  async function loadTenants() {
    loading.value = true;
    error.value = null;
    try {
      const response = await tenantApi.getTenants({
        page: currentPage.value,
        limit: currentLimit.value,
        filter: currentFilter.value,
        sort: currentSort.value,
      });
      tenants.value = response.items;
      totalTenants.value = response.total;
    } catch (err) {
      error.value = err.message;
    } finally {
      loading.value = false;
    }
  }
  
  // ... остальная логика
  
  return {
    tenants,
    loading,
    error,
    currentPage,
    currentLimit,
    totalPages,
    totalTenants,
    filterInput,
    currentSort,
    applyFilter,
    clearFilter,
    toggleSort,
    loadTenants,
    ...modals,
  };
}
```

## Преимущества такого подхода

1. **Постепенная миграция** - можно делать по одной странице
2. **Переиспользование** - общие части выносятся один раз
3. **Тестируемость** - логика изолирована в composables
4. **Читаемость** - страницы становятся тонкими и понятными
5. **Масштабируемость** - легко добавлять новые страницы

## Рекомендации

1. **Начать с TenantsPage** - самая простая страница
2. **Вынести утилиты сразу** - они используются везде
3. **Создавать компоненты по мере необходимости** - не делать все сразу
4. **Тестировать после каждого шага** - убедиться, что ничего не сломалось
