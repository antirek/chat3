/**
 * Модуль управления диалогами
 * Отвечает за: загрузку списка диалогов, пагинацию, фильтрацию, сортировку
 */
import { ref, computed } from 'vue';
import { useConfigStore } from '@/app/stores/config';
import { useCredentialsStore } from '@/app/stores/credentials';
import { usePagination, useApiSort } from '@/shared/lib/composables';
import { formatTimestamp } from '@/shared/lib/utils/date';

export function useDialogs(getApiKey: () => string) {
  // Конфигурация
  const configStore = useConfigStore();
  const credentialsStore = useCredentialsStore();

  // Состояние диалогов
  const dialogs = ref<any[]>([]);
  const loadingDialogs = ref(false);
  const dialogsError = ref<string | null>(null);
  const currentFilter = ref<string | null>(null);
  const currentAdditionalFilter = ref<string | null>(null);
  const filterValue = ref('');
  const sortValue = ref('');
  const selectedFilterExample = ref('');
  const selectedSortExample = ref('');
  const applying = ref(false);
  const applyButtonText = ref('Применить');
  const showDialogsPagination = ref(false);

  // Сортировка для диалогов
  const dialogsSort = useApiSort({
    initialSort: '',
    onSortChange: () => {
      // При изменении сортировки перезагружаем данные
      const filterVal = filterValue.value.trim();
      dialogsPagination.currentPage.value = 1;
      dialogsPagination.currentPageInput.value = 1;
      loadDialogsWithFilter(filterVal || '', 1);
    },
  });

  // Пагинация для диалогов
  const dialogsPagination = usePagination({
    initialPage: 1,
    initialLimit: 20,
    onPageChange: (page, limit) => {
      const filterVal = filterValue.value.trim();
      loadDialogsWithFilter(filterVal || '', page, dialogsSort.currentSort.value || null, limit);
    },
  });

  // Computed
  const visibleDialogPages = computed(() => {
    const pages: number[] = [];
    const maxPages = Math.min(5, dialogsPagination.totalPages.value);
    for (let i = 1; i <= maxPages; i++) {
      pages.push(i);
    }
    return pages;
  });

  // Функции для диалогов
  async function loadDialogsWithFilter(filter: string, page = 1, sort: string | null = null, limit?: number) {
    loadingDialogs.value = true;
    dialogsError.value = null;

    try {
      const key = getApiKey();
      if (!key || !key.trim()) {
        throw new Error('API Key не указан');
      }

      const currentLimit = limit || dialogsPagination.currentLimit.value;
      let url = `/api/dialogs?filter=${encodeURIComponent(filter)}&page=${page}&limit=${currentLimit}`;
      const sortParam = sort || dialogsSort.currentSort.value;
      if (sortParam) {
        url += `&sort=${encodeURIComponent(sortParam)}`;
      }

      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';

      let headers;
      try {
        headers = credentialsStore.getHeaders();
      } catch {
        throw new Error('API Key не указан');
      }

      const response = await fetch(`${baseUrl}${url}`, {
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.data && data.data.length > 0) {
        dialogsPagination.setPaginationData(data.pagination?.total || 0, data.pagination?.pages || 1);
        dialogs.value = data.data;
        showDialogsPagination.value = true;
      } else {
        dialogs.value = [];
        showDialogsPagination.value = false;
      }
    } catch (error) {
      console.error('Error loading dialogs:', error);
      dialogsError.value = error instanceof Error ? error.message : 'Ошибка загрузки';
      dialogs.value = [];
      showDialogsPagination.value = false;
    } finally {
      loadingDialogs.value = false;
    }
  }

  async function changePage(page: number) {
    if (page < 1 || page > dialogsPagination.totalPages.value || page === dialogsPagination.currentPage.value) return;

    dialogsPagination.currentPage.value = page;
    dialogsPagination.currentPageInput.value = page;

    const filterVal = filterValue.value.trim();
    const combinedFilter = filterVal || '';

    await loadDialogsWithFilter(combinedFilter, page, dialogsSort.currentSort.value || null);
  }

  function updateFilterInput() {
    if (selectedFilterExample.value === 'custom') {
      filterValue.value = '';
    } else if (selectedFilterExample.value) {
      filterValue.value = selectedFilterExample.value;
    }
  }

  function updateSortInput() {
    if (selectedSortExample.value === 'custom') {
      sortValue.value = '';
    } else if (selectedSortExample.value) {
      sortValue.value = selectedSortExample.value;
    }
  }

  function clearAll() {
    filterValue.value = '';
    sortValue.value = '';
    selectedFilterExample.value = '';
    selectedSortExample.value = '';
    currentFilter.value = null;
    currentAdditionalFilter.value = null;
    dialogsSort.clearSort();
    dialogsPagination.currentPage.value = 1;
    dialogsPagination.currentPageInput.value = 1;
    loadDialogsWithFilter('');
  }

  async function applyCombined() {
    const filterVal = filterValue.value.trim();
    const sortVal = sortValue.value.trim();

    if (filterVal && (!filterVal.startsWith('(') || !filterVal.endsWith(')'))) {
      alert('Фильтр должен быть в формате (field,operator,value)');
      return;
    }

    if (sortVal && (!sortVal.startsWith('(') || !sortVal.endsWith(')'))) {
      alert('Сортировка должна быть в формате (field,direction)');
      return;
    }

    applying.value = true;
    applyButtonText.value = 'Применяется...';

    try {
      currentAdditionalFilter.value = filterVal || null;
      if (sortVal) {
        dialogsSort.setSort(sortVal.match(/\(([^,]+),([^)]+)\)/)?.[1] || 'createdAt', sortVal.includes('desc') ? 'desc' : 'asc');
      } else {
        dialogsSort.clearSort();
      }
      dialogsPagination.currentPage.value = 1;
      dialogsPagination.currentPageInput.value = 1;

      const combinedFilter = filterVal || '';
      await loadDialogsWithFilter(combinedFilter, 1);

      applyButtonText.value = '✓ Применено';
      setTimeout(() => {
        applyButtonText.value = 'Применить';
      }, 2000);
    } catch {
      applyButtonText.value = '✗ Ошибка';
      setTimeout(() => {
        applyButtonText.value = 'Применить';
      }, 2000);
    } finally {
      applying.value = false;
    }
  }

  function toggleSort(field: string) {
    dialogsSort.toggleSort(field);
  }

  function getDialogSortIndicator(field: string) {
    return dialogsSort.getSortIndicator(field);
  }

  return {
    // State
    dialogs,
    loadingDialogs,
    dialogsError,
    currentFilter,
    currentAdditionalFilter,
    currentSort: dialogsSort.currentSort,
    filterValue,
    sortValue,
    selectedFilterExample,
    selectedSortExample,
    applying,
    applyButtonText,
    showDialogsPagination,
    // Pagination
    dialogsPagination,
    visibleDialogPages,
    // Functions
    loadDialogsWithFilter,
    changePage,
    updateFilterInput,
    updateSortInput,
    clearAll,
    applyCombined,
    toggleSort,
    getDialogSortIndicator,
    // Utils
    formatTimestamp,
  };
}
