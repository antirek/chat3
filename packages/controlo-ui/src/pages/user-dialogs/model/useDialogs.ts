/**
 * Модуль управления диалогами пользователя
 * Отвечает за: загрузку списка диалогов, пагинацию, фильтрацию
 * Модалки: showDialogInfo, showCurrentUrl
 */
import { ref, computed, type Ref } from 'vue';
import { useConfigStore } from '@/app/stores/config';
import { useCredentialsStore } from '@/app/stores/credentials';
import { usePagination } from '@/shared/lib/composables/usePagination';
import { useFilter } from '@/shared/lib/composables/useFilter';

export function useDialogs(
  currentUserId: Ref<string | null>,
  showModal: (title: string, content: string, url?: string | null, jsonContent?: any) => void,
  showUrlModal: (title: string, url: string) => void
) {
  // Конфигурация
  const configStore = useConfigStore();
  const credentialsStore = useCredentialsStore();

  // Состояние диалогов
  const loadingDialogs = ref(false);
  const dialogsError = ref<string | null>(null);
  const dialogs = ref<any[]>([]);
  const isLoadingDialogsInternal = ref(false); // Флаг для предотвращения рекурсии

  // Пагинация для диалогов
  const dialogsPagination = usePagination({
    initialPage: 1,
    initialLimit: 10,
    onPageChange: (page, limit) => {
      // Предотвращаем рекурсию
      if (!isLoadingDialogsInternal.value && currentUserId.value) {
        loadUserDialogs(currentUserId.value, page, limit);
      }
    },
  });

  // Фильтр для диалогов
  const dialogsFilter = useFilter({
    initialFilter: '',
  });

  // Computed
  const visibleDialogPages = computed(() => {
    const pages: number[] = [];
    const total = dialogsPagination.totalPages.value;
    const current = dialogsPagination.currentPage.value;
    const maxVisible = 10;

    let start = Math.max(1, current - Math.floor(maxVisible / 2));
    let end = Math.min(total, start + maxVisible - 1);

    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  });

  // Функции для диалогов
  async function loadUserDialogs(userId: string, page = 1, limit?: number) {
    // Предотвращаем рекурсию
    if (isLoadingDialogsInternal.value) {
      return;
    }

    try {
      if (!userId) {
        return;
      }

      isLoadingDialogsInternal.value = true;
      loadingDialogs.value = true;
      dialogsError.value = null;

      const currentLimit = limit || dialogsPagination.currentLimit.value;
      let url = `/api/users/${userId}/dialogs?page=${page}&limit=${currentLimit}`;

      if (dialogsFilter.currentFilter.value) {
        url += `&filter=${encodeURIComponent(dialogsFilter.currentFilter.value)}`;
      }

      const response = await fetch(url, {
        headers: credentialsStore.getHeaders(),
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        } else {
          const errorText = await response.text();
          throw new Error(`Сервер вернул не JSON. Status: ${response.status}. Ответ: ${errorText.substring(0, 200)}`);
        }
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Сервер вернул не JSON. Status: ${response.status}. Content-Type: ${contentType}. Ответ: ${text.substring(0, 200)}`);
      }

      const data = await response.json();
      dialogsPagination.setPaginationData(data.pagination?.total || 0, data.pagination?.pages || 1);
      
      // Обновляем пагинацию напрямую, без вызова onPageChange
      if (dialogsPagination.currentPage.value !== page) {
        dialogsPagination.currentPage.value = page;
        dialogsPagination.currentPageInput.value = page;
      }

      if (data.data && data.data.length > 0) {
        dialogs.value = data.data;
      } else {
        dialogs.value = [];
      }
    } catch (err) {
      console.error('Error loading dialogs:', err);
      dialogsError.value = err instanceof Error ? err.message : 'Ошибка загрузки';
      dialogs.value = [];
    } finally {
      loadingDialogs.value = false;
      isLoadingDialogsInternal.value = false;
    }
  }

  function selectFilterExample() {
    if (dialogsFilter.selectedFilterExample.value && dialogsFilter.selectedFilterExample.value !== 'custom') {
      dialogsFilter.filterInput.value = dialogsFilter.selectedFilterExample.value;
    } else if (dialogsFilter.selectedFilterExample.value === 'custom') {
      dialogsFilter.filterInput.value = '';
    }
  }

  function clearFilter() {
    dialogsFilter.clearFilter();
    if (currentUserId.value) {
      loadUserDialogs(currentUserId.value, 1);
    }
  }

  function applyFilter() {
    dialogsFilter.applyFilter();
    if (currentUserId.value) {
      loadUserDialogs(currentUserId.value, 1);
    }
  }

  function changeDialogPage(page: number) {
    if (currentUserId.value) {
      loadUserDialogs(currentUserId.value, page);
    }
  }

  // Функции для модальных окон
  async function showCurrentUrl() {
    if (!currentUserId.value) {
      alert('Сначала выберите пользователя');
      return;
    }

    let url = `/api/users/${currentUserId.value}/dialogs`;
    const params = new URLSearchParams();
    
    params.append('page', dialogsPagination.currentPage.value.toString());
    params.append('limit', '10');
    
    if (dialogsFilter.currentFilter.value) {
      params.append('filter', dialogsFilter.currentFilter.value);
    }
    
    const fullUrl = url + (params.toString() ? '?' + params.toString() : '');
    const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
    const fullUrlWithOrigin = `${baseUrl}${fullUrl}`;
    
    showUrlModal('Текущий URL запроса диалогов', fullUrlWithOrigin);
  }

  async function showDialogInfo(dialogId: string) {
    try {
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const url = `${baseUrl}/api/dialogs/${dialogId}`;

      const response = await fetch(url, {
        headers: credentialsStore.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const dialog = await response.json();
      const dialogData = dialog.data || dialog;

      showModal(
        'Информация о диалоге',
        `<div class="json-content">${JSON.stringify(dialog, null, 2)}</div>`,
        url,
        dialogData
      );
    } catch (error) {
      console.error('Error loading dialog info:', error);
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const url = `${baseUrl}/api/dialogs/${dialogId}`;
      showModal('Ошибка', `Не удалось загрузить информацию о диалоге: ${error instanceof Error ? error.message : 'Unknown error'}`, url);
    }
  }

  return {
    // State
    loadingDialogs,
    dialogsError,
    dialogs,
    // Pagination
    dialogsPagination,
    visibleDialogPages,
    // Filter
    dialogsFilter,
    // Functions
    loadUserDialogs,
    selectFilterExample,
    clearFilter,
    applyFilter,
    changeDialogPage,
    // Modals
    showCurrentUrl,
    showDialogInfo,
  };
}
