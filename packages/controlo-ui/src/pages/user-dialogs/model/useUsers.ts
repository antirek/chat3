/**
 * Модуль управления пользователями
 * Отвечает за: загрузку списка пользователей, пагинацию, фильтрацию
 * Модалки: showUserInfoModal, showUsersUrl
 */
import { ref, computed, toRef } from 'vue';
import { useConfigStore } from '@/app/stores/config';
import { useCredentialsStore } from '@/app/stores/credentials';
import { usePagination } from '@/shared/lib/composables/usePagination';
import { useFilter } from '@/shared/lib/composables/useFilter';
import { escapeHtml } from './useUtils';

export function useUsers(
  showModal: (title: string, content: string, url?: string | null, jsonContent?: any) => void,
  showUrlModal: (title: string, url: string) => void
) {
  // Конфигурация
  const configStore = useConfigStore();
  const credentialsStore = useCredentialsStore();

  // Используем credentials из store
  const apiKey = toRef(credentialsStore, 'apiKey');

  // Состояние пользователей
  const loadingUsers = ref(false);
  const usersError = ref<string | null>(null);
  const users = ref<any[]>([]);
  const isLoadingUsersInternal = ref(false); // Флаг для предотвращения рекурсии

  // Пагинация для пользователей
  const usersPagination = usePagination({
    initialPage: 1,
    initialLimit: 100,
    onPageChange: (page, limit) => {
      // Предотвращаем рекурсию
      if (!isLoadingUsersInternal.value) {
        loadUsers(page, limit);
      }
    },
  });

  // Фильтр для пользователей
  const usersFilter = useFilter({
    initialFilter: '',
  });

  // Computed
  const userPaginationStart = computed(() => {
    return usersPagination.paginationStart.value;
  });

  const userPaginationEnd = computed(() => {
    return usersPagination.paginationEnd.value;
  });

  // Функции для пользователей
  async function loadUsers(page = usersPagination.currentPage.value, limit = usersPagination.currentLimit.value) {
    // Предотвращаем рекурсию
    if (isLoadingUsersInternal.value) {
      return;
    }

    try {
      const key = apiKey.value;
      if (!key) {
        throw new Error('API Key не указан');
      }

      isLoadingUsersInternal.value = true;
      
      // Обновляем пагинацию напрямую, без вызова onPageChange
      // чтобы избежать рекурсии
      if (usersPagination.currentPage.value !== page) {
        usersPagination.currentPage.value = page;
        usersPagination.currentPageInput.value = page;
      }
      if (usersPagination.currentLimit.value !== limit) {
        usersPagination.currentLimit.value = limit;
        // Если изменился лимит, сбрасываем на первую страницу
        if (usersPagination.currentPage.value !== 1) {
          usersPagination.currentPage.value = 1;
          usersPagination.currentPageInput.value = 1;
        }
      }
      
      loadingUsers.value = true;
      usersError.value = null;

      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (usersFilter.currentFilter.value) {
        params.append('filter', usersFilter.currentFilter.value);
      }

      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const response = await fetch(`${baseUrl}/api/users?${params.toString()}`, {
        headers: credentialsStore.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      usersPagination.setPaginationData(data.pagination?.total || 0, data.pagination?.pages || 1);

      if (data.data && data.data.length > 0) {
        const usersData = data.data.map((user: any) => ({
          ...user,
          displayName: user.displayName || user.userId,
          dialogCount: Number.isFinite(user.dialogCount) ? user.dialogCount : 0
        }));
        
        users.value = usersData.sort((a: any, b: any) => {
          // Сначала по dialogCount (по убыванию)
          if (b.dialogCount !== a.dialogCount) {
            return b.dialogCount - a.dialogCount;
          }
          // Затем по displayName (по алфавиту)
          const nameA = (a.displayName || '').toLowerCase();
          const nameB = (b.displayName || '').toLowerCase();
          if (nameA === nameB) {
            // Если displayName одинаковые, то по userId
            return a.userId.localeCompare(b.userId);
          }
          return nameA.localeCompare(nameB);
        });
      } else {
        users.value = [];
      }
    } catch (err) {
      console.error('Error loading users:', err);
      usersError.value = err instanceof Error ? err.message : 'Ошибка загрузки';
      users.value = [];
    } finally {
      loadingUsers.value = false;
      isLoadingUsersInternal.value = false;
    }
  }

  function selectUserFilterExample() {
    // selectedFilterExample уже обновлен через v-model
    if (usersFilter.selectedFilterExample.value && usersFilter.selectedFilterExample.value !== 'custom') {
      usersFilter.filterInput.value = usersFilter.selectedFilterExample.value;
    } else if (usersFilter.selectedFilterExample.value === 'custom') {
      usersFilter.filterInput.value = '';
    }
  }

  function clearUserFilter() {
    usersFilter.clearFilter();
    loadUsers(1, usersPagination.currentLimit.value);
  }

  function applyUserFilter() {
    usersFilter.applyFilter();
    loadUsers(1, usersPagination.currentLimit.value);
  }

  // Функции для модальных окон
  async function showUserInfoModal(userId: string) {
    const url = `/api/users/${userId}`;
    showModal('JSON пользователя', '<div class="loading">Загрузка данных пользователя...</div>', url);
    
    try {
      const response = await fetch(url, {
        headers: credentialsStore.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.data) {
        const jsonStr = JSON.stringify(data.data, null, 2);
        showModal(`JSON пользователя: ${escapeHtml(userId)}`, 
          `<div style="max-height: 500px; overflow: auto;">
            <pre class="json-content">${escapeHtml(jsonStr)}</pre>
          </div>`,
          url,
          data.data
        );
      } else {
        showModal('Ошибка', 'Данные пользователя не найдены', url);
      }
    } catch (error) {
      console.error('Error loading user JSON:', error);
      showModal('Ошибка', `Ошибка загрузки: ${escapeHtml(error instanceof Error ? error.message : 'Unknown error')}`, url);
    }
  }

  async function showUsersUrl() {
    const key = apiKey.value;
    if (!key) {
      alert('API Key не указан');
      return;
    }

    const params = new URLSearchParams({
      page: usersPagination.currentPage.value.toString(),
      limit: usersPagination.currentLimit.value.toString(),
    });

    if (usersFilter.currentFilter.value) {
      params.append('filter', usersFilter.currentFilter.value);
    }

    const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
    const url = `${baseUrl}/api/users?${params.toString()}`;
    showUrlModal('URL запроса пользователей', url);
  }

  return {
    // State
    loadingUsers,
    usersError,
    users,
    // Pagination
    usersPagination,
    userPaginationStart,
    userPaginationEnd,
    // Filter
    usersFilter,
    // Functions
    loadUsers,
    selectUserFilterExample,
    clearUserFilter,
    applyUserFilter,
    // Modals
    showUserInfoModal,
    showUsersUrl,
  };
}
