/**
 * Сообщения выбранного топика (GET /api/dialogs/:dialogId/messages?filter=(topicId,eq,TOPIC_ID)).
 */
import { ref, watch } from 'vue';
import { useConfigStore } from '@/app/stores/config';
import { useCredentialsStore } from '@/app/stores/credentials';
import { usePagination, useApiSort } from '@/shared/lib/composables';
import { formatTimestamp } from '@/shared/lib/utils/date';

export function useMessagesByTopic(
  getApiKey: () => string,
  dialogId: ref<string | null>,
  topicId: ref<string | null>
) {
  const configStore = useConfigStore();
  const credentialsStore = useCredentialsStore();

  const messages = ref<any[]>([]);
  const loadingMessages = ref(false);
  const messagesError = ref<string | null>(null);
  const messageFilterValue = ref('');
  const selectedMessageFilterExample = ref('');
  const currentMessageFilter = ref<string | null>(null);
  const showMessagesPagination = ref(false);

  const messagesSort = useApiSort({
    initialSort: null,
    onSortChange: () => {
      if (dialogId.value && topicId.value) {
        messagesPagination.currentPage.value = 1;
        messagesPagination.currentPageInput.value = 1;
        loadMessages(1);
      }
    },
  });

  const messagesPagination = usePagination({
    initialPage: 1,
    initialLimit: 20,
    onPageChange: (page, limit) => {
      if (dialogId.value && topicId.value) {
        loadMessages(page, limit);
      }
    },
  });

  async function loadMessages(page = 1, limit?: number) {
    const d = dialogId.value;
    const t = topicId.value;
    if (!d || !t) {
      messages.value = [];
      showMessagesPagination.value = false;
      return;
    }

    loadingMessages.value = true;
    messagesError.value = null;

    try {
      const key = getApiKey();
      if (!key) {
        throw new Error('API Key не указан');
      }

      const currentLimit = limit || messagesPagination.currentLimit.value;
      const topicFilter = `(topicId,eq,${t})`;
      const combinedFilter = currentMessageFilter.value
        ? `${topicFilter}&${currentMessageFilter.value}`
        : topicFilter;
      let url = `/api/dialogs/${d}/messages?page=${page}&limit=${currentLimit}&filter=${encodeURIComponent(combinedFilter)}`;
      if (messagesSort.currentSort.value) {
        url += `&sort=${encodeURIComponent(messagesSort.currentSort.value)}`;
      }

      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const response = await fetch(`${baseUrl}${url}`, {
        headers: credentialsStore.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.data && Array.isArray(data.data)) {
        messagesPagination.setPaginationData(data.pagination?.total ?? 0, data.pagination?.pages ?? 1);
        messages.value = data.data;
        showMessagesPagination.value = (data.pagination?.total ?? 0) > 0;
      } else {
        messages.value = [];
        showMessagesPagination.value = false;
      }
    } catch (err) {
      console.error('Error loading messages by topic:', err);
      messagesError.value = err instanceof Error ? err.message : 'Ошибка загрузки';
      messages.value = [];
      showMessagesPagination.value = false;
    } finally {
      loadingMessages.value = false;
    }
  }

  function applyMessageFilter() {
    const filterVal = messageFilterValue.value.trim();
    currentMessageFilter.value = filterVal || null;
    messagesPagination.currentPage.value = 1;
    messagesPagination.currentPageInput.value = 1;
    if (dialogId.value && topicId.value) {
      loadMessages(1);
    }
  }

  function clearMessageFilter() {
    messageFilterValue.value = '';
    selectedMessageFilterExample.value = '';
    currentMessageFilter.value = null;
    messagesSort.clearSort?.();
    messagesPagination.currentPage.value = 1;
    messagesPagination.currentPageInput.value = 1;
    if (dialogId.value && topicId.value) {
      loadMessages(1);
    }
  }

  function toggleMessageSort(field: string) {
    messagesSort.toggleSort(field);
  }

  function getMessageSortIndicator(field: string) {
    return messagesSort.getSortIndicator(field);
  }

  function buildMessagesUrl(): string {
    const d = dialogId.value;
    const t = topicId.value;
    if (!d || !t) return '';
    const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
    const topicFilter = `(topicId,eq,${t})`;
    const combined = currentMessageFilter.value ? `(topicId,eq,${t})&${currentMessageFilter.value}` : topicFilter;
    let url = `${baseUrl}/api/dialogs/${d}/messages?page=${messagesPagination.currentPage.value}&limit=${messagesPagination.currentLimit.value}&filter=${encodeURIComponent(combined)}`;
    if (messagesSort.currentSort.value) {
      url += `&sort=${encodeURIComponent(messagesSort.currentSort.value)}`;
    }
    return url;
  }

  watch(
    () => [dialogId.value, topicId.value],
    ([d, t]) => {
      if (d && t) {
        messagesPagination.currentPage.value = 1;
        messagesPagination.currentPageInput.value = 1;
        loadMessages(1);
      } else {
        messages.value = [];
        showMessagesPagination.value = false;
      }
    }
  );

  return {
    messages,
    loadingMessages,
    messagesError,
    messageFilterValue,
    selectedMessageFilterExample,
    currentMessageSort: messagesSort.currentSort,
    showMessagesPagination,
    messagesPagination,
    loadMessages,
    applyMessageFilter,
    clearMessageFilter,
    toggleMessageSort,
    getMessageSortIndicator,
    formatTimestamp,
    buildMessagesUrl,
  };
}
