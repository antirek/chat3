/**
 * Список топиков по тенанту (GET /api/topics). Страница «Топики + Сообщения».
 */
import { ref } from 'vue';
import { useConfigStore } from '@/app/stores/config';
import { useCredentialsStore } from '@/app/stores/credentials';
import { usePagination, useApiSort } from '@/shared/lib/composables';

export function useTopicsList(getApiKey: () => string) {
  const configStore = useConfigStore();
  const credentialsStore = useCredentialsStore();

  const topics = ref<any[]>([]);
  const loadingTopics = ref(false);
  const topicsError = ref<string | null>(null);
  const currentFilter = ref<string | null>(null);
  const filterValue = ref('');
  const sortValue = ref('');
  const selectedFilterExample = ref('');
  const selectedSortExample = ref('');
  const applying = ref(false);
  const applyButtonText = ref('Применить');
  const showTopicsPagination = ref(false);

  const topicsSort = useApiSort({
    initialSort: '',
    onSortChange: () => {
      topicsPagination.currentPage.value = 1;
      topicsPagination.currentPageInput.value = 1;
      loadTopics(1);
    },
  });

  const topicsPagination = usePagination({
    initialPage: 1,
    initialLimit: 20,
    onPageChange: (page, limit) => {
      const _filterVal = filterValue.value.trim();
      loadTopics(page, topicsSort.currentSort.value || null, limit);
    },
  });

  async function loadTopics(page = 1, sort: string | null = null, limit?: number) {
    loadingTopics.value = true;
    topicsError.value = null;

    try {
      const key = getApiKey();
      if (!key?.trim()) {
        throw new Error('API Key не указан');
      }

      const currentLimit = limit || topicsPagination.currentLimit.value;
      let url = `/api/topics?page=${page}&limit=${currentLimit}`;
      const filterVal = filterValue.value.trim();
      if (filterVal) {
        url += `&filter=${encodeURIComponent(filterVal)}`;
      }
      const sortParam = sort ?? topicsSort.currentSort.value;
      if (sortParam) {
        url += `&sort=${encodeURIComponent(sortParam)}`;
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
        topicsPagination.setPaginationData(data.pagination?.total ?? 0, data.pagination?.pages ?? 1);
        topics.value = data.data;
        showTopicsPagination.value = (data.pagination?.total ?? 0) > 0;
      } else {
        topics.value = [];
        showTopicsPagination.value = false;
      }
    } catch (err) {
      console.error('Error loading topics:', err);
      topicsError.value = err instanceof Error ? err.message : 'Ошибка загрузки';
      topics.value = [];
      showTopicsPagination.value = false;
    } finally {
      loadingTopics.value = false;
    }
  }

  function applyCombined() {
    const sortVal = sortValue.value.trim();
    if (sortVal) {
      const match = sortVal.match(/\(([^,]+),([^)]+)\)/);
      if (match) {
        const field = match[1];
        const direction = sortVal.includes('desc') ? 'desc' : 'asc';
        topicsSort.setSort(field, direction);
      }
    } else {
      topicsSort.clearSort();
    }
    applying.value = true;
    currentFilter.value = filterValue.value.trim() || null;
    topicsPagination.currentPage.value = 1;
    topicsPagination.currentPageInput.value = 1;
    loadTopics(1).finally(() => {
      applying.value = false;
    });
  }

  function toggleSort(field: string) {
    topicsSort.toggleSort(field);
  }

  function getSortIndicator(field: string) {
    return topicsSort.getSortIndicator(field);
  }

  function buildTopicsUrl(): string {
    const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
    let url = `${baseUrl}/api/topics?page=${topicsPagination.currentPage.value}&limit=${topicsPagination.currentLimit.value}`;
    const filterVal = filterValue.value.trim();
    if (filterVal) url += `&filter=${encodeURIComponent(filterVal)}`;
    const sortParam = topicsSort.currentSort.value;
    if (sortParam) url += `&sort=${encodeURIComponent(sortParam)}`;
    return url;
  }

  return {
    topics,
    loadingTopics,
    topicsError,
    currentFilter,
    filterValue,
    sortValue,
    selectedFilterExample,
    selectedSortExample,
    applying,
    applyButtonText,
    showTopicsPagination,
    topicsPagination,
    topicsSort,
    loadTopics,
    applyCombined,
    toggleSort,
    getSortIndicator,
    buildTopicsUrl,
  };
}
