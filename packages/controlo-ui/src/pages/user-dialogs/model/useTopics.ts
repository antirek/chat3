/**
 * Модуль управления топиками диалога
 * Отвечает за: загрузку топиков, пагинацию
 * Модалки: showTopicsUrlModal
 */
import { ref, type Ref } from 'vue';
import { useConfigStore } from '@/app/stores/config';
import { useCredentialsStore } from '@/app/stores/credentials';
import { usePagination } from '@/shared/lib/composables/usePagination';

export function useTopics(
  currentUserId: Ref<string | null>,
  currentDialogId: Ref<string | null>,
  showUrlModal: (title: string, url: string) => void
) {
  // Конфигурация
  const configStore = useConfigStore();
  const credentialsStore = useCredentialsStore();

  // Состояние топиков
  const loadingTopics = ref(false);
  const topicsError = ref<string | null>(null);
  const topics = ref<any[]>([]);
  const isLoadingTopicsInternal = ref(false); // Флаг для предотвращения рекурсии

  // Пагинация для топиков
  const topicsPagination = usePagination({
    initialPage: 1,
    initialLimit: 20,
    onPageChange: (page, limit) => {
      // Предотвращаем рекурсию
      if (!isLoadingTopicsInternal.value && currentDialogId.value) {
        loadDialogTopics(currentDialogId.value, page, limit);
      }
    },
  });

  // Функции для топиков
  async function loadDialogTopics(dialogId: string, page = 1, limit?: number) {
    // Предотвращаем рекурсию
    if (isLoadingTopicsInternal.value) {
      return;
    }

    try {
      if (!dialogId || !currentUserId.value) {
        return;
      }

      isLoadingTopicsInternal.value = true;
      loadingTopics.value = true;
      topicsError.value = null;

      const currentLimit = limit || topicsPagination.currentLimit.value;
      const url = `/api/users/${currentUserId.value}/dialogs/${dialogId}/topics?page=${page}&limit=${currentLimit}`;

      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const fullUrl = `${baseUrl}${url}`;

      const response = await fetch(fullUrl, {
        headers: credentialsStore.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      topicsPagination.setPaginationData(data.pagination?.total || 0, data.pagination?.pages || 1);
      
      // Обновляем пагинацию напрямую, без вызова onPageChange
      if (topicsPagination.currentPage.value !== page) {
        topicsPagination.currentPage.value = page;
        topicsPagination.currentPageInput.value = page;
      }

      if (data.data && data.data.length > 0) {
        topics.value = data.data;
      } else {
        topics.value = [];
      }
    } catch (err) {
      console.error('Error loading topics:', err);
      topicsError.value = err instanceof Error ? err.message : 'Ошибка загрузки';
      topics.value = [];
    } finally {
      loadingTopics.value = false;
      isLoadingTopicsInternal.value = false;
    }
  }

  // Функции для модальных окон
  async function showTopicsUrlModal() {
    if (!currentDialogId.value) {
      alert('Сначала выберите диалог');
      return;
    }
    
    if (!currentUserId.value) {
      alert('Сначала выберите пользователя');
      return;
    }
    
    const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
    const url = `${baseUrl}/api/users/${currentUserId.value}/dialogs/${currentDialogId.value}/topics?page=${topicsPagination.currentPage.value}&limit=10`;
    
    showUrlModal('URL запроса топиков', url);
  }

  return {
    // State
    loadingTopics,
    topicsError,
    topics,
    // Pagination
    topicsPagination,
    // Functions
    loadDialogTopics,
    // Modals
    showTopicsUrlModal,
  };
}
