/**
 * Модуль загрузки и управления тенантами
 * Отвечает за: загрузку тенантов, пагинацию, фильтры, сортировку
 */
import { ref } from 'vue';
import { usePagination } from '@/shared/lib/composables/usePagination';
import { useFilter } from '@/shared/lib/composables/useFilter';
import { useSort } from '@/shared/lib/composables/useSort';
import { formatTimestamp } from '@/shared/lib/utils/date';

export function useTenants(
  getApiKey: () => string,
  configStore: any,
  credentialsStore: any,
) {
  // Данные
  const tenants = ref<any[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Функция загрузки данных (нужна для callbacks)
  let loadTenantsFn: (page: number, limit: number) => Promise<void>;

  // Используем общие composables
  const pagination = usePagination({
    initialPage: 1,
    initialLimit: 20,
    onPageChange: (page, limit) => {
      if (loadTenantsFn) {
        loadTenantsFn(page, limit);
      }
    },
  });

  const filter = useFilter({
    initialFilter: '',
    // onFilterChange не нужен, так как загрузка происходит в applyTenantFilter
  });

  const sort = useSort({
    initialField: 'createdAt',
    initialOrder: -1,
    onSortChange: () => {
      if (loadTenantsFn) {
        loadTenantsFn(pagination.currentPage.value, pagination.currentLimit.value);
      }
    },
  });

  // Функции
  async function loadTenants(page = pagination.currentPage.value, limit = pagination.currentLimit.value) {
    try {
      const key = getApiKey();

      if (!key) {
        // Не показываем ошибку, если просто нет API Key - это нормально
        error.value = null;
        tenants.value = [];
        loading.value = false;
        return;
      }

      // Обновляем страницу и лимит без вызова callback, чтобы избежать бесконечного цикла
      if (pagination.currentPage.value !== page) {
        pagination.currentPage.value = page;
        pagination.currentPageInput.value = page;
      }
      pagination.currentLimit.value = limit;
      loading.value = true;
      error.value = null;

      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (filter.currentFilter.value) {
        params.append('filter', filter.currentFilter.value);
      }

      const sortObj: Record<string, number> = {};
      sortObj[sort.currentSort.value.field] = sort.currentSort.value.order;
      params.append('sort', JSON.stringify(sortObj));

      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const url = `${baseUrl}/api/tenants?${params.toString()}`;
      
      const response = await fetch(url, {
        headers: credentialsStore.getHeaders(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      pagination.setPaginationData(data.pagination?.total || 0, data.pagination?.pages || 1);

      if (data.data && data.data.length > 0) {
        tenants.value = data.data;
      } else {
        tenants.value = [];
      }
    } catch (err) {
      console.error('Error loading tenants:', err);
      if (err instanceof TypeError && err.message.includes('fetch')) {
        error.value = 'Не удалось подключиться к серверу. Проверьте, что backend сервер запущен на порту 3000.';
      } else {
        error.value = err instanceof Error ? err.message : 'Ошибка загрузки';
      }
      tenants.value = [];
    } finally {
      loading.value = false;
    }
  }

  // Сохраняем ссылку на функцию для callbacks
  loadTenantsFn = loadTenants;

  function selectTenantFilterExample() {
    // selectedFilterExample уже обновлен через v-model к моменту вызова @change
    const selected = filter.selectedFilterExample.value;
    
    if (selected && selected !== 'custom') {
      filter.filterInput.value = selected;
    } else if (selected === 'custom') {
      filter.filterInput.value = '';
    }
  }

  function clearTenantFilter() {
    filter.clearFilter();
    loadTenants(1, pagination.currentLimit.value);
  }

  function applyTenantFilter() {
    // Устанавливаем currentFilter напрямую из filterInput (как в оригинале)
    filter.currentFilter.value = filter.filterInput.value.trim();
    // После применения фильтра нужно перезагрузить данные с первой страницы
    loadTenants(1, pagination.currentLimit.value);
  }

  return {
    // State
    tenants,
    loading,
    error,
    // Pagination
    pagination,
    currentPage: pagination.currentPage,
    currentLimit: pagination.currentLimit,
    totalPages: pagination.totalPages,
    totalTenants: pagination.totalItems,
    currentPageInput: pagination.currentPageInput,
    paginationStart: pagination.paginationStart,
    paginationEnd: pagination.paginationEnd,
    // Filter
    filter,
    filterInput: filter.filterInput,
    selectedFilterExample: filter.selectedFilterExample,
    currentFilter: filter.currentFilter,
    // Sort
    sort,
    currentSort: sort.currentSort,
    // Functions
    loadTenants,
    formatTimestamp,
    selectTenantFilterExample,
    clearTenantFilter,
    applyTenantFilter,
  };
}
