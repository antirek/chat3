/**
 * Модуль загрузки и управления сообщениями
 * Отвечает за: загрузку сообщений, пагинацию, фильтры, сортировку
 */
import { ref, computed } from 'vue';
import { usePagination, useFilter, useApiSort } from '@/shared/lib/composables';
import { formatTimestamp } from '@/shared/lib/utils/date';

export function useMessages(
  getApiKey: () => string,
  configStore: any,
  credentialsStore: any,
) {
  // Данные
  const messages = ref<any[]>([]);
  const dialogs = ref<any[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Функция загрузки данных (нужна для callbacks)
  let loadMessagesFn: (page: number) => Promise<void>;

  // Используем общие composables
  const pagination = usePagination({
    initialPage: 1,
    initialLimit: 20,
    onPageChange: (page, _limit) => {
      if (loadMessagesFn) {
        loadMessagesFn(page);
      }
    },
  });

  const filter = useFilter({
    initialFilter: '',
    // onFilterChange не нужен, так как загрузка происходит в applyMessageFilter
  });

  // Сортировка для сообщений
  const messagesSort = useApiSort({
    initialSort: null,
    onSortChange: () => {
      // При изменении сортировки перезагружаем данные
      pagination.currentPage.value = 1;
      pagination.currentPageInput.value = 1;
      if (loadMessagesFn) {
        loadMessagesFn(1);
      }
    },
  });

  // Computed для пагинации (видимые страницы)
  const visiblePages = computed(() => {
    const startPage = Math.max(1, pagination.currentPage.value - 2);
    const endPage = Math.min(pagination.totalPages.value, pagination.currentPage.value + 2);
    const pages: number[] = [];
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  });

  // Функции
  async function loadDialogs() {
    try {
      const key = getApiKey();
      if (!key) {
        return;
      }

      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const response = await fetch(`${baseUrl}/api/dialogs?limit=100`, {
        headers: credentialsStore.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      dialogs.value = data.data || [];
    } catch (err) {
      console.error('Error loading dialogs:', err);
    }
  }

  async function loadMessages(page = pagination.currentPage.value) {
    try {
      const key = getApiKey();

      if (!key) {
        // Не показываем ошибку, если просто нет API Key - это нормально
        error.value = null;
        messages.value = [];
        loading.value = false;
        return;
      }

      // Обновляем страницу без вызова callback, чтобы избежать бесконечного цикла
      if (pagination.currentPage.value !== page) {
        pagination.currentPage.value = page;
        pagination.currentPageInput.value = page;
      }
      loading.value = true;
      error.value = null;

      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.currentLimit.value.toString(),
      });

      if (filter.currentFilter.value) {
        params.append('filter', filter.currentFilter.value);
      }

      if (messagesSort.currentSort.value) {
        params.append('sort', messagesSort.currentSort.value);
      }

      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const url = `${baseUrl}/api/messages?${params.toString()}`;
      
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
        messages.value = data.data;
      } else {
        messages.value = [];
      }
    } catch (err) {
      console.error('Error loading messages:', err);
      if (err instanceof TypeError && err.message.includes('fetch')) {
        error.value = 'Не удалось подключиться к серверу. Проверьте, что backend сервер запущен на порту 3000.';
      } else {
        error.value = err instanceof Error ? err.message : 'Ошибка загрузки';
      }
      messages.value = [];
    } finally {
      loading.value = false;
    }
  }

  // Сохраняем ссылку на функцию для callbacks
  loadMessagesFn = loadMessages;

  function getDialogName(dialogId: string) {
    const dialog = dialogs.value.find((d) => d.dialogId === dialogId);
    return dialog ? dialog.dialogId : dialogId;
  }

  function getSortIndicator(field: string) {
    return messagesSort.getSortIndicator(field);
  }

  function toggleSort(field: string) {
    messagesSort.toggleSort(field);
  }

  function selectMessageFilterExample() {
    // selectedFilterExample уже обновлен через v-model к моменту вызова @change
    const selected = filter.selectedFilterExample.value;
    
    if (selected && selected !== 'custom') {
      filter.filterInput.value = selected;
    } else if (selected === 'custom') {
      filter.filterInput.value = '';
    }
  }

  function clearMessageFilter() {
    filter.clearFilter();
    messagesSort.clearSort();
    loadMessages(1);
  }

  function applyMessageFilter() {
    const filterValue = filter.filterInput.value.trim();

    if (!filterValue) {
      alert('Введите фильтр сообщений');
      return;
    }

    // Устанавливаем currentFilter напрямую из filterInput
    filter.currentFilter.value = filterValue;
    pagination.currentPage.value = 1;
    pagination.currentPageInput.value = 1;
    loadMessages(1);
  }

  // Pagination функции
  function goToPreviousPage() {
    if (pagination.currentPage.value > 1) {
      loadMessages(pagination.currentPage.value - 1);
    }
  }

  function goToNextPage() {
    if (pagination.currentPage.value < pagination.totalPages.value) {
      loadMessages(pagination.currentPage.value + 1);
    }
  }

  function goToPage(page: number) {
    if (page >= 1 && page <= pagination.totalPages.value) {
      loadMessages(page);
    }
  }

  function changeLimit(newLimit: number) {
    pagination.currentLimit.value = newLimit;
    pagination.setPage(1);
    loadMessages(1);
  }

  return {
    // State
    messages,
    dialogs,
    loading,
    error,
    // Pagination
    pagination,
    currentPage: pagination.currentPage,
    currentLimit: pagination.currentLimit,
    totalPages: pagination.totalPages,
    totalMessages: pagination.totalItems,
    currentPageInput: pagination.currentPageInput,
    visiblePages,
    // Filter
    filter,
    filterInput: filter.filterInput,
    selectedFilterExample: filter.selectedFilterExample,
    currentFilter: filter.currentFilter,
    // Sort
    currentSort: messagesSort.currentSort,
    // Functions
    loadDialogs,
    loadMessages,
    getDialogName,
    formatTimestamp,
    getSortIndicator,
    toggleSort,
    selectMessageFilterExample,
    clearMessageFilter,
    applyMessageFilter,
    goToPreviousPage,
    goToNextPage,
    goToPage,
    changeLimit,
  };
}
