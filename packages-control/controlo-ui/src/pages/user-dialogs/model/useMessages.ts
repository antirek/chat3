/**
 * Модуль управления сообщениями диалога
 * Отвечает за: загрузку сообщений, пагинацию, фильтрацию, утилиты статусов (sent/read)
 * Модалки: showMessageInfo, showCurrentMessageUrl
 */
import { ref, computed, type Ref } from 'vue';
import { useConfigStore } from '@/app/stores/config';
import { useCredentialsStore } from '@/app/stores/credentials';
import { usePagination, useFilter, useApiSort } from '@/shared/lib/composables';

export function useMessages(
  currentUserId: Ref<string | null>,
  currentDialogId: Ref<string | null>,
  showModal: (title: string, content: string, url?: string | null, jsonContent?: any) => void,
  showUrlModal: (title: string, url: string) => void
) {
  // Конфигурация
  const configStore = useConfigStore();
  const credentialsStore = useCredentialsStore();

  // Состояние сообщений
  const loadingMessages = ref(false);
  const messagesError = ref<string | null>(null);
  const messages = ref<any[]>([]);
  const isLoadingMessagesInternal = ref(false); // Флаг для предотвращения рекурсии

  // Пагинация для сообщений
  const messagesPagination = usePagination({
    initialPage: 1,
    initialLimit: 10,
    onPageChange: (page, limit) => {
      // Предотвращаем рекурсию
      if (!isLoadingMessagesInternal.value && currentDialogId.value) {
        loadDialogMessages(currentDialogId.value, page, limit);
      }
    },
  });

  // Фильтр для сообщений
  const messagesFilter = useFilter({
    initialFilter: '',
  });

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

  // Computed
  const showMessagesPagination = computed(() => {
    return messagesPagination.totalItems.value > 0 && currentDialogId.value !== null;
  });

  const visibleMessagePages = computed(() => {
    const pages: number[] = [];
    const total = messagesPagination.totalPages.value;
    const current = messagesPagination.currentPage.value;
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

  // Функции для сообщений
  async function loadDialogMessages(dialogId: string, page = 1, limit?: number) {
    // Предотвращаем рекурсию
    if (isLoadingMessagesInternal.value) {
      return;
    }

    try {
      if (!dialogId || !currentUserId.value) {
        return;
      }

      isLoadingMessagesInternal.value = true;
      loadingMessages.value = true;
      messagesError.value = null;

      const currentLimit = limit || messagesPagination.currentLimit.value;
      let url = `/api/users/${currentUserId.value}/dialogs/${dialogId}/messages?page=${page}&limit=${currentLimit}`;

      if (messagesFilter.currentFilter.value) {
        url += `&filter=${encodeURIComponent(messagesFilter.currentFilter.value)}`;
      }

      if (messagesSort.currentSort.value) {
        url += `&sort=${encodeURIComponent(messagesSort.currentSort.value)}`;
      }

      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const fullUrl = `${baseUrl}${url}`;

      const response = await fetch(fullUrl, {
        headers: credentialsStore.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      messagesPagination.setPaginationData(data.pagination?.total || 0, data.pagination?.pages || 1);
      
      // Обновляем пагинацию напрямую, без вызова onPageChange
      if (messagesPagination.currentPage.value !== page) {
        messagesPagination.currentPage.value = page;
        messagesPagination.currentPageInput.value = page;
      }

      if (data.data && data.data.length > 0) {
        messages.value = data.data;
      } else {
        messages.value = [];
      }
    } catch (err) {
      console.error('Error loading messages:', err);
      messagesError.value = err instanceof Error ? err.message : 'Ошибка загрузки';
      messages.value = [];
    } finally {
      loadingMessages.value = false;
      isLoadingMessagesInternal.value = false;
    }
  }

  function selectMessageFilterExample() {
    if (messagesFilter.selectedFilterExample.value && messagesFilter.selectedFilterExample.value !== 'custom') {
      messagesFilter.filterInput.value = messagesFilter.selectedFilterExample.value;
    } else if (messagesFilter.selectedFilterExample.value === 'custom') {
      messagesFilter.filterInput.value = '';
    }
  }

  function clearMessageFilter() {
    messagesFilter.clearFilter();
    messagesSort.clearSort();
    if (currentDialogId.value) {
      loadDialogMessages(currentDialogId.value, 1);
    }
  }

  function applyMessageFilter() {
    messagesFilter.applyFilter();
    if (currentDialogId.value) {
      loadDialogMessages(currentDialogId.value, 1);
    }
  }

  /** Устанавливает фильтр сообщений по topicId (для перехода «Сообщения» из списка топиков). */
  function setMessageFilterByTopicId(topicId: string) {
    const filterValue = `(topic.topicId,eq,${topicId})`;
    messagesFilter.filterInput.value = filterValue;
    messagesFilter.currentFilter.value = filterValue;
  }

  function changeMessagePage(page: number) {
    if (currentDialogId.value) {
      loadDialogMessages(currentDialogId.value, page);
    }
  }

  function toggleMessageSort(field: string) {
    messagesSort.toggleSort(field);
  }

  function getMessageSortIndicator(field: string) {
    return messagesSort.getSortIndicator(field);
  }

  // Утилиты для статусов сообщений
  function getMessageStatus(message: any): string | null {
    if (!message.context?.isMine) return null;
    const statusMatrix = message.statusMessageMatrix || [];
    const readStatus = statusMatrix.find(
      (item: any) => item.userType === 'user' && item.status === 'read' && item.count >= 1
    );
    return readStatus ? 'read' : 'sent';
  }

  function getStatusIcon(status: string | null): string {
    if (!status) return '?';
    const icons: Record<string, string> = {
      sent: '✓',
      delivered: '✓✓',
      read: '✓✓',
      unread: '◯',
    };
    return icons[status] || '?';
  }

  function getStatusColor(status: string | null): string {
    if (!status) return '#999';
    const colors: Record<string, string> = {
      sent: '#999',
      delivered: '#999',
      read: '#4fc3f7',
      unread: '#ccc',
    };
    return colors[status] || '#999';
  }

  // Функции для модальных окон
  async function showCurrentMessageUrl() {
    if (!currentDialogId.value || !currentUserId.value) {
      alert('Сначала выберите диалог');
      return;
    }

    let url = `/api/users/${currentUserId.value}/dialogs/${currentDialogId.value}/messages?page=${messagesPagination.currentPage.value}&limit=10`;

    if (messagesFilter.currentFilter.value) {
      url += `&filter=${encodeURIComponent(messagesFilter.currentFilter.value)}`;
    }

    if (messagesSort.currentSort.value) {
      url += `&sort=${encodeURIComponent(messagesSort.currentSort.value)}`;
    }

    const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
    const fullUrl = `${baseUrl}${url}`;
    showUrlModal('URL запроса сообщений', fullUrl);
  }

  async function showMessageInfo(messageId: string) {
    try {
      if (!currentUserId.value || !currentDialogId.value) {
        alert('Сначала выберите пользователя и диалог');
        return;
      }

      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const url = `${baseUrl}/api/users/${currentUserId.value}/dialogs/${currentDialogId.value}/messages/${messageId}`;

      const response = await fetch(url, {
        headers: credentialsStore.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const message = await response.json();
      const messageData = message.data || message;

      showModal(
        `Информация о сообщении (контекст: ${currentUserId.value})`,
        `<div class="json-content">${JSON.stringify(message, null, 2)}</div>`,
        url,
        messageData
      );
    } catch (error) {
      console.error('Error loading message info:', error);
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const url = `${baseUrl}/api/messages/${messageId}`;
      showModal('Ошибка', `Не удалось загрузить информацию о сообщении: ${error instanceof Error ? error.message : 'Unknown error'}`, url);
    }
  }

  return {
    // State
    loadingMessages,
    messagesError,
    messages,
    // Pagination
    messagesPagination,
    showMessagesPagination,
    visibleMessagePages,
    // Filter
    messagesFilter,
    // Sort
    currentMessageSort: messagesSort.currentSort,
    // Functions
    loadDialogMessages,
    selectMessageFilterExample,
    clearMessageFilter,
    applyMessageFilter,
    changeMessagePage,
    toggleMessageSort,
    getMessageSortIndicator,
    // Utils
    getMessageStatus,
    getStatusIcon,
    getStatusColor,
    // Modals
    showCurrentMessageUrl,
    showMessageInfo,
    // Programmatic filter
    setMessageFilterByTopicId,
  };
}
