# Детальная структура проекта Vue 3 + FSD

## Полная структура директорий

```
packages/controlo-ui/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.html
├── src/
│   ├── app/
│   │   ├── App.vue                    # Корневой компонент
│   │   ├── main.ts                    # Точка входа
│   │   ├── router/
│   │   │   └── index.ts               # Конфигурация роутера
│   │   └── stores/
│   │       └── config.ts              # Глобальный store конфигурации
│   │
│   ├── shared/
│   │   ├── ui/                        # Базовые UI компоненты
│   │   │   ├── Button/
│   │   │   │   ├── Button.vue
│   │   │   │   ├── Button.types.ts
│   │   │   │   └── index.ts
│   │   │   ├── Modal/
│   │   │   │   ├── Modal.vue
│   │   │   │   ├── Modal.types.ts
│   │   │   │   └── index.ts
│   │   │   ├── Table/
│   │   │   │   ├── Table.vue
│   │   │   │   ├── TableHeader.vue
│   │   │   │   ├── TableRow.vue
│   │   │   │   ├── Table.types.ts
│   │   │   │   └── index.ts
│   │   │   ├── Pagination/
│   │   │   │   ├── Pagination.vue
│   │   │   │   ├── Pagination.types.ts
│   │   │   │   └── index.ts
│   │   │   ├── Filter/
│   │   │   │   ├── Filter.vue
│   │   │   │   ├── FilterExamples.vue
│   │   │   │   ├── Filter.types.ts
│   │   │   │   └── index.ts
│   │   │   ├── Input/
│   │   │   │   ├── Input.vue
│   │   │   │   └── index.ts
│   │   │   ├── Select/
│   │   │   │   ├── Select.vue
│   │   │   │   └── index.ts
│   │   │   ├── Tooltip/
│   │   │   │   ├── Tooltip.vue
│   │   │   │   └── index.ts
│   │   │   ├── Loading/
│   │   │   │   ├── Loading.vue
│   │   │   │   └── index.ts
│   │   │   └── index.ts               # Экспорт всех UI компонентов
│   │   │
│   │   ├── lib/                       # Утилиты и библиотеки
│   │   │   ├── api/
│   │   │   │   ├── client.ts          # Axios instance с interceptors
│   │   │   │   ├── endpoints.ts       # Константы endpoints
│   │   │   │   └── types.ts           # Типы для API
│   │   │   ├── utils/
│   │   │   │   ├── date.ts            # Форматирование дат
│   │   │   │   ├── json.ts            # Работа с JSON
│   │   │   │   ├── copy.ts            # Копирование в буфер
│   │   │   │   ├── validation.ts      # Валидация форм
│   │   │   │   └── url.ts             # Работа с URL
│   │   │   └── constants/
│   │   │       ├── filterExamples.ts  # Примеры фильтров для разных сущностей
│   │   │       └── pagination.ts      # Константы пагинации
│   │   │
│   │   ├── types/                     # Общие TypeScript типы
│   │   │   ├── api.ts                 # Типы API запросов/ответов
│   │   │   ├── entities.ts            # Типы сущностей
│   │   │   ├── common.ts              # Общие типы (фильтры, пагинация)
│   │   │   └── index.ts
│   │   │
│   │   └── config/                    # Конфигурация
│   │       ├── env.ts                 # Переменные окружения
│   │       └── index.ts
│   │
│   ├── entities/                      # Бизнес-сущности
│   │   ├── tenant/
│   │   │   ├── ui/
│   │   │   │   ├── TenantTable.vue
│   │   │   │   ├── TenantForm.vue
│   │   │   │   ├── TenantInfoModal.vue
│   │   │   │   └── index.ts
│   │   │   ├── model/
│   │   │   │   ├── store.ts           # Pinia store
│   │   │   │   ├── types.ts
│   │   │   │   └── index.ts
│   │   │   └── api/
│   │   │       ├── tenantApi.ts
│   │   │       └── index.ts
│   │   │
│   │   ├── user/
│   │   │   ├── ui/
│   │   │   │   ├── UserTable.vue
│   │   │   │   ├── UserForm.vue
│   │   │   │   ├── UserTypeModal.vue
│   │   │   │   └── index.ts
│   │   │   ├── model/
│   │   │   │   ├── store.ts
│   │   │   │   ├── types.ts
│   │   │   │   └── index.ts
│   │   │   └── api/
│   │   │       ├── userApi.ts
│   │   │       └── index.ts
│   │   │
│   │   ├── dialog/
│   │   │   ├── ui/
│   │   │   │   ├── DialogTable.vue
│   │   │   │   ├── DialogForm.vue
│   │   │   │   └── index.ts
│   │   │   ├── model/
│   │   │   │   ├── store.ts
│   │   │   │   ├── types.ts
│   │   │   │   └── index.ts
│   │   │   └── api/
│   │   │       ├── dialogApi.ts
│   │   │       └── index.ts
│   │   │
│   │   ├── message/
│   │   │   ├── ui/
│   │   │   │   ├── MessageTable.vue
│   │   │   │   ├── MessageForm.vue
│   │   │   │   └── index.ts
│   │   │   ├── model/
│   │   │   │   ├── store.ts
│   │   │   │   ├── types.ts
│   │   │   │   └── index.ts
│   │   │   └── api/
│   │   │       ├── messageApi.ts
│   │   │       └── index.ts
│   │   │
│   │   ├── member/
│   │   │   ├── ui/
│   │   │   │   ├── MemberTable.vue
│   │   │   │   ├── MemberForm.vue
│   │   │   │   └── index.ts
│   │   │   ├── model/
│   │   │   │   ├── store.ts
│   │   │   │   ├── types.ts
│   │   │   │   └── index.ts
│   │   │   └── api/
│   │   │       ├── memberApi.ts
│   │   │       └── index.ts
│   │   │
│   │   └── meta/                       # Общая логика мета-тегов
│   │       ├── ui/
│   │       │   └── MetaTagsEditor.vue
│   │       ├── model/
│   │       │   ├── types.ts
│   │       │   └── useMeta.ts
│   │       └── api/
│   │           └── metaApi.ts
│   │
│   ├── features/                      # Функциональные возможности
│   │   ├── column/                    # Компонент Колонка
│   │   │   ├── ui/
│   │   │   │   ├── Column.vue
│   │   │   │   ├── ColumnHeader.vue
│   │   │   │   ├── ColumnFilter.vue
│   │   │   │   ├── ColumnTable.vue
│   │   │   │   ├── ColumnPagination.vue
│   │   │   │   └── index.ts
│   │   │   └── model/
│   │   │       ├── useColumn.ts       # Композиция для управления колонкой
│   │   │       ├── types.ts
│   │   │       └── index.ts
│   │   │
│   │   ├── info-modal/                # Модальное окно Info
│   │   │   ├── ui/
│   │   │   │   ├── InfoModal.vue
│   │   │   │   └── index.ts
│   │   │   └── model/
│   │   │       ├── useInfoModal.ts
│   │   │       └── index.ts
│   │   │
│   │   ├── meta-modal/                # Модальное окно Meta
│   │   │   ├── ui/
│   │   │   │   ├── MetaModal.vue
│   │   │   │   └── index.ts
│   │   │   └── model/
│   │   │       ├── useMetaModal.ts
│   │   │       └── index.ts
│   │   │
│   │   ├── url-modal/                 # Модальное окно URL
│   │   │   ├── ui/
│   │   │   │   ├── UrlModal.vue
│   │   │   │   └── index.ts
│   │   │   └── model/
│   │   │       ├── useUrlModal.ts
│   │   │       └── index.ts
│   │   │
│   │   ├── delete-confirm/            # Подтверждение удаления
│   │   │   ├── ui/
│   │   │   │   ├── DeleteConfirmModal.vue
│   │   │   │   └── index.ts
│   │   │   └── model/
│   │   │       ├── useDeleteConfirm.ts
│   │   │       └── index.ts
│   │   │
│   │   └── form-modal/                # Базовый компонент формы
│   │       ├── ui/
│   │       │   ├── FormModal.vue
│   │       │   └── index.ts
│   │       └── model/
│   │           ├── useFormModal.ts
│   │           └── index.ts
│   │
│   ├── widgets/                       # Композитные блоки
│   │   ├── header/
│   │   │   ├── ui/
│   │   │   │   ├── AppHeader.vue
│   │   │   │   └── index.ts
│   │   │   └── model/
│   │   │       └── useHeader.ts
│   │   │
│   │   ├── tenants-page/
│   │   │   ├── ui/
│   │   │   │   ├── TenantsPage.vue
│   │   │   │   └── index.ts
│   │   │   └── model/
│   │   │       └── useTenantsPage.ts
│   │   │
│   │   ├── users-page/
│   │   │   ├── ui/
│   │   │   │   ├── UsersPage.vue
│   │   │   │   └── index.ts
│   │   │   └── model/
│   │   │       └── useUsersPage.ts
│   │   │
│   │   ├── messages-page/
│   │   │   ├── ui/
│   │   │   │   ├── MessagesPage.vue
│   │   │   │   └── index.ts
│   │   │   └── model/
│   │   │       └── useMessagesPage.ts
│   │   │
│   │   ├── dialogs-messages-page/
│   │   │   ├── ui/
│   │   │   │   ├── DialogsMessagesPage.vue
│   │   │   │   └── index.ts
│   │   │   └── model/
│   │   │       └── useDialogsMessagesPage.ts
│   │   │
│   │   ├── user-dialogs-page/
│   │   │   ├── ui/
│   │   │   │   ├── UserDialogsPage.vue
│   │   │   │   └── index.ts
│   │   │   └── model/
│   │   │       └── useUserDialogsPage.ts
│   │   │
│   │   └── db-explorer/
│   │       ├── ui/
│   │       │   ├── DbExplorerPage.vue
│   │       │   └── index.ts
│   │       └── model/
│   │           └── useDbExplorer.ts
│   │
│   └── pages/                         # Страницы приложения
│       ├── TenantsPage.vue
│       ├── UsersPage.vue
│       ├── MessagesPage.vue
│       ├── DialogsMessagesPage.vue
│       ├── UserDialogsPage.vue
│       ├── DbExplorerPage.vue
│       ├── EventsUpdatesPage.vue
│       └── InitPage.vue
│
├── public/                            # Статические файлы (если нужны)
│   └── favicon.ico
│
├── tests/                             # E2E тесты (Playwright)
│   ├── add-member-modal.spec.ts
│   ├── user-dialogs-members-modal.spec.ts
│   └── fixtures/
│       └── test-data.ts
│
└── server/                            # Express сервер (для статики и config.js)
    └── index.ts
```

## Примеры структуры файлов

### app/main.ts
```typescript
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import { loadConfig } from '@/shared/config';

// Загружаем конфигурацию перед инициализацией приложения
loadConfig().then(() => {
  const app = createApp(App);
  const pinia = createPinia();
  
  app.use(pinia);
  app.use(router);
  
  app.mount('#app');
});
```

### shared/lib/api/client.ts
```typescript
import axios from 'axios';
import type { AxiosInstance, AxiosRequestConfig } from 'axios';
import { getConfig } from '@/shared/config';

let apiClient: AxiosInstance | null = null;

export function createApiClient() {
  const config = getConfig();
  
  apiClient = axios.create({
    baseURL: config.TENANT_API_URL,
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  // Interceptor для добавления API ключа
  apiClient.interceptors.request.use((config) => {
    const apiKey = new URLSearchParams(window.location.search).get('apiKey');
    if (apiKey) {
      config.headers['X-API-Key'] = apiKey;
    }
    return config;
  });
  
  return apiClient;
}

export function getApiClient(): AxiosInstance {
  if (!apiClient) {
    return createApiClient();
  }
  return apiClient;
}
```

### features/column/model/useColumn.ts
```typescript
import { ref, computed } from 'vue';
import type { Ref } from 'vue';
import type { PaginationParams, SortParams, FilterParams } from '@/shared/types/common';

export interface UseColumnOptions<T> {
  fetchData: (params: {
    filter?: string;
    sort?: string;
    page?: number;
    limit?: number;
  }) => Promise<{ data: T[]; total: number }>;
  filterExamples?: string[];
}

export function useColumn<T>(options: UseColumnOptions<T>) {
  const data = ref<T[]>([]) as Ref<T[]>;
  const loading = ref(false);
  const error = ref<string | null>(null);
  
  const filter = ref<string>('');
  const sort = ref<SortParams | null>(null);
  const pagination = ref<PaginationParams>({
    page: 1,
    limit: 20,
    total: 0,
  });
  
  const loadData = async () => {
    loading.value = true;
    error.value = null;
    
    try {
      const params = {
        filter: filter.value || undefined,
        sort: sort.value ? `${sort.value.field}:${sort.value.order}` : undefined,
        page: pagination.value.page,
        limit: pagination.value.limit,
      };
      
      const result = await options.fetchData(params);
      data.value = result.data;
      pagination.value.total = result.total;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Ошибка загрузки данных';
    } finally {
      loading.value = false;
    }
  };
  
  const applyFilter = (newFilter: string) => {
    filter.value = newFilter;
    pagination.value.page = 1;
    loadData();
  };
  
  const clearFilter = () => {
    filter.value = '';
    pagination.value.page = 1;
    loadData();
  };
  
  const setSort = (field: string, order: 'asc' | 'desc' = 'asc') => {
    if (sort.value?.field === field && sort.value.order === order) {
      sort.value = null;
    } else {
      sort.value = { field, order };
    }
    loadData();
  };
  
  const setPage = (page: number) => {
    pagination.value.page = page;
    loadData();
  };
  
  const setLimit = (limit: number) => {
    pagination.value.limit = limit;
    pagination.value.page = 1;
    loadData();
  };
  
  return {
    data,
    loading,
    error,
    filter,
    sort,
    pagination,
    loadData,
    applyFilter,
    clearFilter,
    setSort,
    setPage,
    setLimit,
  };
}
```

### widgets/tenants-page/ui/TenantsPage.vue
```vue
<template>
  <div class="tenants-page">
    <Column
      :data="column.data.value"
      :loading="column.loading.value"
      :filter="column.filter.value"
      :sort="column.sort.value"
      :pagination="column.pagination.value"
      :filter-examples="filterExamples"
      title="Тенанты"
      :columns="tableColumns"
      show-add-button
      show-url-button
      @add="handleAdd"
      @url="handleUrl"
      @filter="column.applyFilter"
      @clear-filter="column.clearFilter"
      @sort="column.setSort"
      @page="column.setPage"
      @limit="column.setLimit"
      @action="handleAction"
    />
    
    <TenantFormModal
      v-model="showAddModal"
      @save="handleSave"
    />
    
    <InfoModal
      v-model="showInfoModal"
      :data="selectedData"
      :url="infoUrl"
    />
    
    <MetaModal
      v-model="showMetaModal"
      :entity-type="'tenant'"
      :entity-id="selectedEntityId"
      @save="column.loadData"
    />
    
    <DeleteConfirmModal
      v-model="showDeleteModal"
      :entity-name="selectedEntityId"
      @confirm="handleDelete"
    />
    
    <UrlModal
      v-model="showUrlModal"
      :url="currentUrl"
      :params="urlParams"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Column } from '@/features/column';
import { TenantFormModal } from '@/entities/tenant';
import { InfoModal } from '@/features/info-modal';
import { MetaModal } from '@/features/meta-modal';
import { DeleteConfirmModal } from '@/features/delete-confirm';
import { UrlModal } from '@/features/url-modal';
import { useColumn } from '@/features/column/model';
import { useTenantStore } from '@/entities/tenant/model';
import { filterExamples } from '@/shared/lib/constants/filterExamples';

const tenantStore = useTenantStore();

const column = useColumn({
  fetchData: tenantStore.fetchTenants,
  filterExamples: filterExamples.tenant,
});

const tableColumns = [
  { key: 'tenantId', label: 'Tenant ID', sortable: true },
  { key: 'createdAt', label: 'Дата создания', sortable: true, formatter: formatDate },
  { key: 'actions', label: 'Действия', sortable: false },
];

const showAddModal = ref(false);
const showInfoModal = ref(false);
const showMetaModal = ref(false);
const showDeleteModal = ref(false);
const showUrlModal = ref(false);
const selectedData = ref(null);
const selectedEntityId = ref<string | null>(null);
const currentUrl = ref('');
const infoUrl = ref('');

onMounted(() => {
  column.loadData();
});

function handleAdd() {
  showAddModal.value = true;
}

function handleUrl() {
  currentUrl.value = buildUrl();
  showUrlModal.value = true;
}

function handleAction(action: string, row: any) {
  selectedEntityId.value = row.tenantId;
  
  switch (action) {
    case 'info':
      selectedData.value = row;
      infoUrl.value = buildInfoUrl(row.tenantId);
      showInfoModal.value = true;
      break;
    case 'meta':
      showMetaModal.value = true;
      break;
    case 'delete':
      showDeleteModal.value = true;
      break;
  }
}

function handleSave(data: any) {
  tenantStore.createTenant(data).then(() => {
    column.loadData();
    showAddModal.value = false;
  });
}

function handleDelete() {
  if (selectedEntityId.value) {
    tenantStore.deleteTenant(selectedEntityId.value).then(() => {
      column.loadData();
      showDeleteModal.value = false;
    });
  }
}

function buildUrl(): string {
  // Построение URL с учетом фильтров, сортировки, пагинации
  return '';
}

function buildInfoUrl(tenantId: string): string {
  return `${getConfig().TENANT_API_URL}/api/tenants/${tenantId}`;
}

function formatDate(date: string): string {
  return new Date(date).toLocaleString('ru-RU');
}
</script>
```

## Правила импортов в FSD

1. **Pages** могут импортировать из:
   - `widgets/`
   - `shared/`

2. **Widgets** могут импортировать из:
   - `features/`
   - `entities/`
   - `shared/`

3. **Features** могут импортировать из:
   - `entities/`
   - `shared/`

4. **Entities** могут импортировать из:
   - `shared/`

5. **Shared** не может импортировать из других слоев

## Алиасы путей (vite.config.ts)

```typescript
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@/app': fileURLToPath(new URL('./src/app', import.meta.url)),
      '@/shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
      '@/entities': fileURLToPath(new URL('./src/entities', import.meta.url)),
      '@/features': fileURLToPath(new URL('./src/features', import.meta.url)),
      '@/widgets': fileURLToPath(new URL('./src/widgets', import.meta.url)),
      '@/pages': fileURLToPath(new URL('./src/pages', import.meta.url)),
    },
  },
});
```
