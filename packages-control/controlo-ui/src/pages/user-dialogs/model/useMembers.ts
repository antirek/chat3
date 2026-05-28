/**
 * Модуль управления участниками диалога
 * Отвечает за: загрузку участников, пагинацию, фильтрацию, удаление участников
 * Модалки: showMembersUrlModal
 */
import { ref, computed, type Ref } from 'vue';
import { useConfigStore } from '@/app/stores/config';
import { useCredentialsStore } from '@/app/stores/credentials';
import { usePagination } from '@/shared/lib/composables/usePagination';
import { useFilter } from '@/shared/lib/composables/useFilter';

export function useMembers(
  currentDialogId: Ref<string | null>,
  showUrlModal: (title: string, url: string) => void
) {
  // Конфигурация
  const configStore = useConfigStore();
  const credentialsStore = useCredentialsStore();

  // Состояние участников
  const loadingMembers = ref(false);
  const membersError = ref<string | null>(null);
  const members = ref<any[]>([]);
  const isLoadingMembersInternal = ref(false); // Флаг для предотвращения рекурсии

  // Пагинация для участников
  const membersPagination = usePagination({
    initialPage: 1,
    initialLimit: 10,
    onPageChange: (page, limit) => {
      // Предотвращаем рекурсию
      if (!isLoadingMembersInternal.value && currentDialogId.value) {
        loadDialogMembers(currentDialogId.value, page, limit);
      }
    },
  });

  // Фильтр для участников
  const membersFilter = useFilter({
    initialFilter: '',
  });

  // Computed
  const visibleMemberPages = computed(() => {
    const pages: number[] = [];
    const total = membersPagination.totalPages.value;
    const current = membersPagination.currentPage.value;
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

  // Функции для участников
  async function loadDialogMembers(dialogId: string, page = 1, limit?: number) {
    // Предотвращаем рекурсию
    if (isLoadingMembersInternal.value) {
      return;
    }

    try {
      if (!dialogId) {
        return;
      }

      isLoadingMembersInternal.value = true;
      loadingMembers.value = true;
      membersError.value = null;

      const currentLimit = limit || membersPagination.currentLimit.value;
      const params = new URLSearchParams({
        page: page.toString(),
        limit: currentLimit.toString(),
        sort: '(joinedAt,asc)',
      });

      if (membersFilter.currentFilter.value) {
        params.append('filter', membersFilter.currentFilter.value);
      }

      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const fullUrl = `${baseUrl}/api/dialogs/${dialogId}/members?${params.toString()}`;

      const response = await fetch(fullUrl, {
        headers: credentialsStore.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      membersPagination.setPaginationData(data.pagination?.total || 0, data.pagination?.pages || 1);
      
      // Обновляем пагинацию напрямую, без вызова onPageChange
      if (membersPagination.currentPage.value !== page) {
        membersPagination.currentPage.value = page;
        membersPagination.currentPageInput.value = page;
      }

      if (data.data && data.data.length > 0) {
        members.value = data.data;
      } else {
        members.value = [];
      }
    } catch (err) {
      console.error('Error loading members:', err);
      membersError.value = err instanceof Error ? err.message : 'Ошибка загрузки';
      members.value = [];
    } finally {
      loadingMembers.value = false;
      isLoadingMembersInternal.value = false;
    }
  }

  function selectMemberFilterExamplePanel() {
    if (membersFilter.selectedFilterExample.value && membersFilter.selectedFilterExample.value !== 'custom') {
      membersFilter.filterInput.value = membersFilter.selectedFilterExample.value;
    } else if (membersFilter.selectedFilterExample.value === 'custom') {
      membersFilter.filterInput.value = '';
    }
  }

  async function clearMemberFilterFieldPanel() {
    membersFilter.clearFilter();
    if (currentDialogId.value) {
      // Обновляем пагинацию напрямую, без вызова onPageChange
      membersPagination.currentPage.value = 1;
      membersPagination.currentPageInput.value = 1;
      await loadDialogMembers(currentDialogId.value, 1);
    }
  }

  async function applyMemberFilterPanel() {
    if (!currentDialogId.value) {
      alert('Сначала выберите диалог');
      return;
    }
    membersFilter.applyFilter();
    // Обновляем пагинацию напрямую, без вызова onPageChange
    membersPagination.currentPage.value = 1;
    membersPagination.currentPageInput.value = 1;
    await loadDialogMembers(currentDialogId.value, 1);
  }

  function changeMemberPage(page: number) {
    if (currentDialogId.value) {
      loadDialogMembers(currentDialogId.value, page);
    }
  }

  async function removeMemberFromPanel(dialogId: string, userId: string) {
    if (!confirm(`Удалить участника ${userId} из диалога?`)) {
      return;
    }

    try {
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const fullUrl = `${baseUrl}/api/dialogs/${dialogId}/members/${userId}/remove`;

      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: credentialsStore.getHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      alert(`Пользователь ${userId} успешно удален из диалога!`);
      
      await loadDialogMembers(dialogId, membersPagination.currentPage.value);
    } catch (error) {
      console.error('Error removing member:', error);
      alert(`Ошибка при удалении участника: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Функции для модальных окон
  function generateMembersApiUrl(dialogId: string): string {
    const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
    const params = new URLSearchParams({
      page: membersPagination.currentPage.value.toString(),
      limit: '10',
      sort: '(joinedAt,asc)'
    });
    if (membersFilter.currentFilter.value) {
      params.append('filter', membersFilter.currentFilter.value);
    }
    return `${baseUrl}/api/dialogs/${dialogId}/members?${params.toString()}`;
  }

  async function showMembersUrlModal() {
    if (!currentDialogId.value) {
      alert('Ошибка: не выбран диалог');
      return;
    }
    
    const url = generateMembersApiUrl(currentDialogId.value);
    showUrlModal('URL запроса участников', url);
  }

  return {
    // State
    loadingMembers,
    membersError,
    members,
    // Pagination
    membersPagination,
    visibleMemberPages,
    // Filter
    membersFilter,
    // Functions
    loadDialogMembers,
    selectMemberFilterExamplePanel,
    clearMemberFilterFieldPanel,
    applyMemberFilterPanel,
    changeMemberPage,
    removeMemberFromPanel,
    // Modals
    generateMembersApiUrl,
    showMembersUrlModal,
  };
}
