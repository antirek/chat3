/**
 * Модуль загрузки списка паков тенанта
 * GET /api/packs — page, limit, filter, sort, sortDirection
 */
import { ref } from 'vue';
import { usePagination } from '@/shared/lib/composables/usePagination';
import { useFilter } from '@/shared/lib/composables/useFilter';
import { useSort } from '@/shared/lib/composables/useSort';
import { formatTimestamp } from '@/shared/lib/utils/date';

export function usePacks(
  getApiKey: () => string,
  configStore: any,
  credentialsStore: any,
) {
  const packs = ref<any[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  let loadPacksFn: (page: number, limit: number) => Promise<void>;

  const pagination = usePagination({
    initialPage: 1,
    initialLimit: 20,
    onPageChange: (page, limit) => {
      if (loadPacksFn) loadPacksFn(page, limit);
    },
  });

  const filter = useFilter({
    initialFilter: '',
  });

  const sort = useSort({
    initialField: 'createdAt',
    initialOrder: -1,
    allowReset: true,
    showIdleIndicator: true,
    onSortChange: () => {
      if (loadPacksFn) loadPacksFn(pagination.currentPage.value, pagination.currentLimit.value);
    },
  });

  async function loadPacks(page = pagination.currentPage.value, limit = pagination.currentLimit.value) {
    try {
      const key = getApiKey();

      if (!key) {
        error.value = null;
        packs.value = [];
        loading.value = false;
        return;
      }

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
        sort: sort.currentSort.value.field || 'createdAt',
        sortDirection: sort.currentSort.value.order === 1 ? 'asc' : 'desc',
      });

      if (filter.currentFilter.value) {
        params.append('filter', filter.currentFilter.value);
      }

      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const url = `${baseUrl}/api/packs?${params.toString()}`;

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
        packs.value = data.data;
      } else {
        packs.value = [];
      }
    } catch (err) {
      console.error('Error loading packs:', err);
      if (err instanceof TypeError && err.message.includes('fetch')) {
        error.value = 'Не удалось подключиться к серверу.';
      } else {
        error.value = err instanceof Error ? err.message : 'Ошибка загрузки';
      }
      packs.value = [];
    } finally {
      loading.value = false;
    }
  }

  loadPacksFn = loadPacks;

  function selectPackFilterExample() {
    const selected = filter.selectedFilterExample.value;
    if (selected && selected !== 'custom') {
      filter.filterInput.value = selected;
    } else if (selected === 'custom') {
      filter.filterInput.value = '';
    }
  }

  function clearPackFilter() {
    filter.clearFilter();
    loadPacks(1, pagination.currentLimit.value);
  }

  function applyPackFilter() {
    filter.currentFilter.value = filter.filterInput.value.trim();
    loadPacks(1, pagination.currentLimit.value);
  }

  function getSortIndicator(field: string) {
    return sort.getSortIndicator(field);
  }

  function toggleSort(field: string) {
    sort.toggleSort(field);
  }

  return {
    packs,
    loading,
    error,
    pagination,
    currentPage: pagination.currentPage,
    currentLimit: pagination.currentLimit,
    totalPages: pagination.totalPages,
    totalPacks: pagination.totalItems,
    currentPageInput: pagination.currentPageInput,
    paginationStart: pagination.paginationStart,
    paginationEnd: pagination.paginationEnd,
    filter,
    filterInput: filter.filterInput,
    selectedFilterExample: filter.selectedFilterExample,
    currentFilter: filter.currentFilter,
    sort,
    currentSort: sort.currentSort,
    loadPacks,
    formatTimestamp,
    getSortIndicator,
    toggleSort,
    selectPackFilterExample,
    clearPackFilter,
    applyPackFilter,
  };
}
