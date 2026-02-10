/**
 * Модуль управления паками пользователя
 * GET /api/users/:userId/packs — паки, в диалогах которых пользователь участвует
 */
import { ref, computed, type Ref } from 'vue';
import { useConfigStore } from '@/app/stores/config';
import { useCredentialsStore } from '@/app/stores/credentials';
import { usePagination, useFilter } from '@/shared/lib/composables';

export function usePacks(
  currentUserId: Ref<string | null>,
  showModal: (title: string, content: string, url?: string | null, jsonContent?: any) => void,
  showUrlModal: (title: string, url: string) => void
) {
  const configStore = useConfigStore();
  const credentialsStore = useCredentialsStore();

  const loadingPacks = ref(false);
  const packsError = ref<string | null>(null);
  const packs = ref<any[]>([]);
  const isLoadingPacksInternal = ref(false);

  const packsPagination = usePagination({
    initialPage: 1,
    initialLimit: 10,
    onPageChange: (page, limit) => {
      if (!isLoadingPacksInternal.value && currentUserId.value) {
        loadUserPacks(currentUserId.value, page, limit);
      }
    },
  });

  const packsFilter = useFilter({ initialFilter: '' });

  const sortField = ref<string>('createdAt');
  const sortDirection = ref<'asc' | 'desc'>('desc');

  const currentSort = computed(() =>
    sortField.value === 'unreadCount' || sortField.value === 'lastActivityAt' ? sortField.value : null
  );

  function toggleSort(field: string) {
    if (field !== 'unreadCount' && field !== 'lastActivityAt') return;
    if (sortField.value !== field) {
      sortField.value = field;
      sortDirection.value = 'desc';
    } else if (sortDirection.value === 'desc') {
      sortDirection.value = 'asc';
    } else {
      sortField.value = 'createdAt';
      sortDirection.value = 'desc';
    }
    if (currentUserId.value) {
      packsPagination.currentPage.value = 1;
      packsPagination.currentPageInput.value = 1;
      loadUserPacks(currentUserId.value, 1);
    }
  }

  function getPackSortIndicator(field: string) {
    if (sortField.value !== field) return '◄';
    return sortDirection.value === 'desc' ? '▼' : '▲';
  }

  const visiblePackPages = computed(() => {
    const pages: number[] = [];
    const total = packsPagination.totalPages.value;
    const current = packsPagination.currentPage.value;
    const maxVisible = 10;
    let start = Math.max(1, current - Math.floor(maxVisible / 2));
    let end = Math.min(total, start + maxVisible - 1);
    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  });

  async function loadUserPacks(userId: string, page = 1, limit?: number) {
    if (isLoadingPacksInternal.value || !userId) return;
    try {
      isLoadingPacksInternal.value = true;
      loadingPacks.value = true;
      packsError.value = null;
      const currentLimit = limit ?? packsPagination.currentLimit.value;
      let url = `/api/users/${userId}/packs?page=${page}&limit=${currentLimit}`;
      if (packsFilter.currentFilter.value) {
        url += `&filter=${encodeURIComponent(packsFilter.currentFilter.value)}`;
      }
      url += `&sort=${encodeURIComponent(sortField.value)}&sortDirection=${sortDirection.value}`;
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const fullUrl = `${baseUrl}${url}`;
      const response = await fetch(fullUrl, { headers: credentialsStore.getHeaders() });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }
      const data = await response.json();
      packsPagination.setPaginationData(data.pagination?.total ?? 0, data.pagination?.pages ?? 1);
      if (packsPagination.currentPage.value !== page) {
        packsPagination.currentPage.value = page;
        packsPagination.currentPageInput.value = page;
      }
      packs.value = data.data?.length ? data.data : [];
    } catch (err) {
      console.error('Error loading packs:', err);
      packsError.value = err instanceof Error ? err.message : 'Ошибка загрузки';
      packs.value = [];
    } finally {
      loadingPacks.value = false;
      isLoadingPacksInternal.value = false;
    }
  }

  function selectPacksFilterExample() {
    if (packsFilter.selectedFilterExample.value && packsFilter.selectedFilterExample.value !== 'custom') {
      packsFilter.filterInput.value = packsFilter.selectedFilterExample.value;
    } else if (packsFilter.selectedFilterExample.value === 'custom') {
      packsFilter.filterInput.value = '';
    }
  }

  function clearPacksFilter() {
    packsFilter.clearFilter();
    if (currentUserId.value) loadUserPacks(currentUserId.value, 1);
  }

  function applyPacksFilter() {
    packsFilter.applyFilter();
    if (currentUserId.value) loadUserPacks(currentUserId.value, 1);
  }

  function changePackPage(page: number) {
    if (currentUserId.value) loadUserPacks(currentUserId.value, page);
  }

  function showPacksCurrentUrl() {
    if (!currentUserId.value) {
      alert('Сначала выберите пользователя');
      return;
    }
    let url = `/api/users/${currentUserId.value}/packs`;
    const params = new URLSearchParams();
    params.append('page', packsPagination.currentPage.value.toString());
    params.append('limit', packsPagination.currentLimit.value.toString());
    if (packsFilter.currentFilter.value) params.append('filter', packsFilter.currentFilter.value);
    params.append('sort', sortField.value);
    params.append('sortDirection', sortDirection.value);
    const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
    showUrlModal('Текущий URL запроса паков', `${baseUrl}${url}?${params.toString()}`);
  }

  async function showPackInfo(packId: string) {
    const userId = currentUserId.value;
    if (!userId) {
      showModal('Ошибка', 'Сначала выберите пользователя', null);
      return;
    }
    try {
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const url = `${baseUrl}/api/users/${userId}/packs/${packId}`;
      const response = await fetch(url, { headers: credentialsStore.getHeaders() });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || `HTTP ${response.status}`);
      }
      const result = await response.json();
      const packData = result.data ?? result;
      showModal(
        `Пак в контексте пользователя: ${packId}`,
        `<div class="json-content">${JSON.stringify(result, null, 2)}</div>`,
        url,
        packData
      );
    } catch (error) {
      console.error('Error loading pack info:', error);
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      showModal(
        'Ошибка',
        `Не удалось загрузить информацию о паке: ${error instanceof Error ? error.message : 'Unknown error'}`,
        `${baseUrl}/api/users/${userId}/packs/${packId}`
      );
    }
  }

  return {
    loadingPacks,
    packsError,
    packs,
    packsPagination,
    visiblePackPages,
    packsFilter,
    sortField,
    sortDirection,
    currentSort,
    toggleSort,
    getPackSortIndicator,
    loadUserPacks,
    selectPacksFilterExample,
    clearPacksFilter,
    applyPacksFilter,
    changePackPage,
    showPacksCurrentUrl,
    showPackInfo,
  };
}
