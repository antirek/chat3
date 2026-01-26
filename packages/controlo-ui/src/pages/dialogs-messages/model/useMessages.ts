/**
 * Модуль управления сообщениями диалога
 * Отвечает за: загрузку сообщений выбранного диалога, пагинацию, фильтрацию, сортировку
 */
import { ref, computed } from 'vue';
import { useConfigStore } from '@/app/stores/config';
import { useCredentialsStore } from '@/app/stores/credentials';
import { usePagination, useApiSort } from '@/shared/lib/composables';
import { formatTimestamp } from '@/shared/lib/utils/date';

export function useMessages(getApiKey: () => string) {
  // Конфигурация
  const configStore = useConfigStore();
  const credentialsStore = useCredentialsStore();

  // Состояние сообщений
  const messages = ref<any[]>([]);
  const loadingMessages = ref(false);
  const messagesError = ref<string | null>(null);
  const currentDialogId = ref<string | null>(null);
  const currentMessageFilter = ref<string | null>(null);
  const messageFilterValue = ref('');
  const selectedMessageFilterExample = ref('');
  const showMessagesPagination = ref(false);

  // Сортировка для сообщений
  const messagesSort = useApiSort({
    initialSort: null,
    onSortChange: () => {
      // При изменении сортировки перезагружаем данные
      if (currentDialogId.value) {
        messagesPagination.currentPage.value = 1;
        messagesPagination.currentPageInput.value = 1;
        loadDialogMessages(currentDialogId.value, 1);
      }
    },
  });

  // Пагинация для сообщений
  const messagesPagination = usePagination({
    initialPage: 1,
    initialLimit: 20,
    onPageChange: (page, limit) => {
      if (currentDialogId.value) {
        loadDialogMessages(currentDialogId.value, page, limit);
      }
    },
  });

  // Computed
  const visibleMessagePages = computed(() => {
    const pages: number[] = [];
    const maxPages = Math.min(5, messagesPagination.totalPages.value);
    for (let i = 1; i <= maxPages; i++) {
      pages.push(i);
    }
    return pages;
  });

  // Функции для сообщений
  async function loadDialogMessages(dialogId: string, page = 1, limit?: number) {
    loadingMessages.value = true;
    messagesError.value = null;

    try {
      const key = getApiKey();
      if (!key) {
        throw new Error('API Key не указан');
      }

      const currentLimit = limit || messagesPagination.currentLimit.value;
      let url = `/api/dialogs/${dialogId}/messages?page=${page}&limit=${currentLimit}`;
      if (messagesSort.currentSort.value) {
        url += `&sort=${encodeURIComponent(messagesSort.currentSort.value)}`;
      }
      if (currentMessageFilter.value) {
        url += `&filter=${encodeURIComponent(currentMessageFilter.value)}`;
      }

      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const response = await fetch(`${baseUrl}${url}`, {
        headers: credentialsStore.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.data && data.data.length > 0) {
        messagesPagination.setPaginationData(data.pagination?.total || 0, data.pagination?.pages || 1);
        messages.value = data.data;
        showMessagesPagination.value = true;
      } else {
        messages.value = [];
        showMessagesPagination.value = false;
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      messagesError.value = error instanceof Error ? error.message : 'Ошибка загрузки';
      messages.value = [];
      showMessagesPagination.value = false;
    } finally {
      loadingMessages.value = false;
    }
  }

  async function changeMessagePage(page: number) {
    if (page < 1 || page === messagesPagination.currentPage.value || !currentDialogId.value) return;

    messagesPagination.currentPage.value = page;
    messagesPagination.currentPageInput.value = page;
    loadDialogMessages(currentDialogId.value, page);
  }

  function updateMessageFilterInput() {
    if (selectedMessageFilterExample.value === 'custom') {
      messageFilterValue.value = '';
    } else if (selectedMessageFilterExample.value) {
      messageFilterValue.value = selectedMessageFilterExample.value;
    }
  }

  function applyMessageFilter() {
    const filterVal = messageFilterValue.value.trim();
    currentMessageFilter.value = filterVal || null;
    messagesPagination.currentPage.value = 1;
    messagesPagination.currentPageInput.value = 1;
    if (currentDialogId.value) {
      loadDialogMessages(currentDialogId.value, 1);
    }
  }

  function clearMessageFilter() {
    messageFilterValue.value = '';
    selectedMessageFilterExample.value = '';
    currentMessageFilter.value = null;
    messagesSort.clearSort();
    messagesPagination.currentPage.value = 1;
    messagesPagination.currentPageInput.value = 1;

    if (currentDialogId.value) {
      loadDialogMessages(currentDialogId.value, 1);
    }
  }

  function toggleMessageSort(field: string) {
    messagesSort.toggleSort(field);
  }

  function getMessageSortIndicator(field: string) {
    return messagesSort.getSortIndicator(field);
  }

  return {
    // State
    messages,
    loadingMessages,
    messagesError,
    currentDialogId,
    currentMessageFilter,
    currentMessageSort: messagesSort.currentSort,
    messageFilterValue,
    selectedMessageFilterExample,
    showMessagesPagination,
    // Pagination
    messagesPagination,
    visibleMessagePages,
    // Functions
    loadDialogMessages,
    changeMessagePage,
    updateMessageFilterInput,
    applyMessageFilter,
    clearMessageFilter,
    toggleMessageSort,
    getMessageSortIndicator,
    // Utils
    formatTimestamp,
  };
}
