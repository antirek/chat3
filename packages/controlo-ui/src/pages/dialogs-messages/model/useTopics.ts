/**
 * Модуль управления топиками диалога (dialogs-messages, без userId).
 * Загрузка только при открытии таба «Топики» (ленивая загрузка).
 */
import { ref } from 'vue';
import { useConfigStore } from '@/app/stores/config';
import { useCredentialsStore } from '@/app/stores/credentials';
import { usePagination } from '@/shared/lib/composables';

export function useTopics(getApiKey: () => string) {
  const configStore = useConfigStore();
  const credentialsStore = useCredentialsStore();

  const topics = ref<any[]>([]);
  const loadingTopics = ref(false);
  const topicsError = ref<string | null>(null);

  const topicsPagination = usePagination({
    initialPage: 1,
    initialLimit: 10,
    onPageChange: () => {},
  });

  async function loadDialogTopics(dialogId: string, page = 1, limit?: number) {
    loadingTopics.value = true;
    topicsError.value = null;

    try {
      const key = getApiKey();
      if (!key) {
        throw new Error('API Key не указан');
      }

      const currentLimit = limit || topicsPagination.currentLimit.value;
      const url = `/api/dialogs/${dialogId}/topics?page=${page}&limit=${currentLimit}`;
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const response = await fetch(`${baseUrl}${url}`, {
        headers: credentialsStore.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      topicsPagination.setPaginationData(data.pagination?.total ?? 0, data.pagination?.pages ?? 1);
      if (topicsPagination.currentPage.value !== page) {
        topicsPagination.currentPage.value = page;
        topicsPagination.currentPageInput.value = page;
      }
      topics.value = data.data ?? [];
    } catch (err) {
      console.error('Error loading topics:', err);
      topicsError.value = err instanceof Error ? err.message : 'Ошибка загрузки';
      topics.value = [];
    } finally {
      loadingTopics.value = false;
    }
  }

  function clearTopics() {
    topics.value = [];
    topicsError.value = null;
    topicsPagination.currentPage.value = 1;
    topicsPagination.currentPageInput.value = 1;
    topicsPagination.setPaginationData(0, 1);
  }

  return {
    topics,
    loadingTopics,
    topicsError,
    topicsPagination,
    loadDialogTopics,
    clearTopics,
  };
}
