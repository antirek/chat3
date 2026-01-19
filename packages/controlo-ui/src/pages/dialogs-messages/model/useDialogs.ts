/**
 * Модуль управления диалогами
 * Отвечает за: загрузку списка диалогов, пагинацию, фильтрацию, сортировку
 */
import { ref, computed } from 'vue';
import { useConfigStore } from '@/app/stores/config';
import { useCredentialsStore } from '@/app/stores/credentials';
import { usePagination } from '@/shared/lib/composables/usePagination';
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
  const currentSort = ref<string>('');
  const filterValue = ref('');
  const sortValue = ref('');
  const selectedFilterExample = ref('');
  const selectedSortExample = ref('');
  const applying = ref(false);
  const applyButtonText = ref('Применить');
  const showDialogsPagination = ref(false);

  // Пагинация для диалогов
  const dialogsPagination = usePagination({
    initialPage: 1,
    initialLimit: 20,
    onPageChange: (page, limit) => {
      const filterVal = filterValue.value.trim();
      loadDialogsWithFilter(filterVal || '', page, currentSort.value, limit);
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
      const sortParam = sort || currentSort.value;
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

    await loadDialogsWithFilter(combinedFilter, page, currentSort.value);
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
    currentSort.value = '';
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
      currentSort.value = sortVal || '';
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
    let newSort: string | null = null;

    if (!currentSort.value || !currentSort.value.includes(field)) {
      newSort = `(${field},asc)`;
    } else if (currentSort.value.includes('asc')) {
      newSort = `(${field},desc)`;
    } else {
      newSort = null;
    }

    currentSort.value = newSort || '';
    dialogsPagination.currentPage.value = 1;
    dialogsPagination.currentPageInput.value = 1;
    const filterVal = filterValue.value.trim();
    loadDialogsWithFilter(filterVal || '', 1);
  }

  function getDialogSortIndicator(field: string) {
    if (!currentSort.value || !currentSort.value.includes(field)) {
      return '◄';
    } else if (currentSort.value.includes('asc')) {
      return '▲';
    } else {
      return '▼';
    }
  }

  function formatMembers(members: any[] | undefined) {
    if (!members || members.length === 0) return '-';

    return members
      .map((member) => {
        const status = member.isActive ? '🟢' : '🔴';
        return `${status} ${member.userId}`;
      })
      .join(', ');
  }

  return {
    // State
    dialogs,
    loadingDialogs,
    dialogsError,
    currentFilter,
    currentAdditionalFilter,
    currentSort,
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
    formatMembers,
  };
}
