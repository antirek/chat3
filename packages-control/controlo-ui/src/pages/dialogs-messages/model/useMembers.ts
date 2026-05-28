/**
 * Модуль управления участниками диалога (dialogs-messages, без userId).
 * Загрузка только при открытии таба «Участники» (ленивая загрузка).
 */
import { ref } from 'vue';
import { useConfigStore } from '@/app/stores/config';
import { useCredentialsStore } from '@/app/stores/credentials';
import { usePagination } from '@/shared/lib/composables';

export function useMembers(getApiKey: () => string) {
  const configStore = useConfigStore();
  const credentialsStore = useCredentialsStore();

  const members = ref<any[]>([]);
  const loadingMembers = ref(false);
  const membersError = ref<string | null>(null);

  const membersPagination = usePagination({
    initialPage: 1,
    initialLimit: 10,
    onPageChange: (_page, _limit) => {
      // Вызывается при смене страницы; dialogId для загрузки передаёт страница
    },
  });

  async function loadDialogMembers(dialogId: string, page = 1, limit?: number) {
    loadingMembers.value = true;
    membersError.value = null;

    try {
      const key = getApiKey();
      if (!key) {
        throw new Error('API Key не указан');
      }

      const currentLimit = limit || membersPagination.currentLimit.value;
      const url = `/api/dialogs/${dialogId}/members?page=${page}&limit=${currentLimit}`;
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const response = await fetch(`${baseUrl}${url}`, {
        headers: credentialsStore.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      membersPagination.setPaginationData(data.pagination?.total ?? 0, data.pagination?.pages ?? 1);
      if (membersPagination.currentPage.value !== page) {
        membersPagination.currentPage.value = page;
        membersPagination.currentPageInput.value = page;
      }
      members.value = data.data ?? [];
    } catch (err) {
      console.error('Error loading members:', err);
      membersError.value = err instanceof Error ? err.message : 'Ошибка загрузки';
      members.value = [];
    } finally {
      loadingMembers.value = false;
    }
  }

  function clearMembers() {
    members.value = [];
    membersError.value = null;
    membersPagination.currentPage.value = 1;
    membersPagination.currentPageInput.value = 1;
    membersPagination.setPaginationData(0, 1);
  }

  return {
    members,
    loadingMembers,
    membersError,
    membersPagination,
    loadDialogMembers,
    clearMembers,
  };
}
