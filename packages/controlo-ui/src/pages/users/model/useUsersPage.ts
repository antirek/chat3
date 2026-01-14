/* eslint-env browser */
/* global alert, confirm */
import { ref, onMounted, toRef } from 'vue';
import { useConfigStore } from '@/app/stores/config';
import { useCredentialsStore } from '@/app/stores/credentials';
import { usePagination } from '@/shared/lib/composables/usePagination';
import { useFilter } from '@/shared/lib/composables/useFilter';
import { useSort } from '@/shared/lib/composables/useSort';
import { useModal } from '@/shared/lib/composables/useModal';

export function useUsersPage() {
  // Конфигурация
  const configStore = useConfigStore();
  const credentialsStore = useCredentialsStore();

  // Используем credentials из store (toRef для правильной типизации)
  const apiKey = toRef(credentialsStore, 'apiKey');
  const tenantId = toRef(credentialsStore, 'tenantId');
  
  // Данные
  const users = ref<any[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Функция загрузки данных (нужна для callbacks)
  let loadUsersFn: (page: number, limit: number) => Promise<void>;

  // Используем общие composables
  const pagination = usePagination({
    initialPage: 1,
    initialLimit: 20,
    onPageChange: (page, limit) => {
      if (loadUsersFn) {
        loadUsersFn(page, limit);
      }
    },
  });

  const filter = useFilter({
    initialFilter: '',
    // onFilterChange не нужен, так как загрузка происходит в applyUserFilter
  });

  const sort = useSort({
    initialField: 'createdAt',
    initialOrder: -1,
    onSortChange: () => {
      if (loadUsersFn) {
        loadUsersFn(pagination.currentPage.value, pagination.currentLimit.value);
      }
    },
  });

  // Модальные окна
  const createModal = useModal();
  const editModal = useModal();
  const metaModal = useModal();
  const infoModal = useModal();
  const urlModal = useModal();

  // Создание пользователя
  const createUserId = ref('');
  const createType = ref('user');

  // Редактирование пользователя
  const editUserId = ref('');
  const editType = ref('user');

  // Meta теги
  const metaUserId = ref('');
  const metaTags = ref<Record<string, any> | null>(null);
  const newMetaKeyForEdit = ref('');
  const newMetaValueForEdit = ref('');

  // Info modal
  const userInfoUrl = ref('');
  const jsonViewerContent = ref('');
  const currentJsonForCopy = ref('');
  const copyJsonButtonText = ref('📋 Копировать JSON');

  // URL modal
  const generatedUrl = ref('');
  const copyUrlButtonText = ref('📋 Скопировать');

  // Функции
  function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return {
      apiKey: params.get('apiKey') || '',
      tenantId: params.get('tenantId') || 'tnt_default',
    };
  }

  function setApiKeyFromExternal(extApiKey: string, extTenantId?: string) {
    if (!extApiKey) {
      console.warn('API Key не предоставлен');
      return;
    }

    credentialsStore.setCredentials(extApiKey, extTenantId);

    console.log('API Key set from external:', apiKey.value);
    console.log('Tenant ID set from external:', tenantId.value);

    loadUsers(1);
  }

  function getApiKey() {
    return apiKey.value;
  }

  async function loadUsers(page = pagination.currentPage.value, limit = pagination.currentLimit.value) {
    try {
      const key = getApiKey();

      if (!key) {
        // Не показываем ошибку, если просто нет API Key - это нормально
        error.value = null;
        users.value = [];
        loading.value = false;
        return;
      }

      // Обновляем страницу и лимит без вызова callback, чтобы избежать бесконечного цикла
      if (pagination.currentPage.value !== page) {
        pagination.currentPage.value = page;
        pagination.currentPageInput.value = page;
      }
      pagination.currentLimit.value = limit;
      loading.value = true;
      error.value = null;

      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (filter.currentFilter.value) {
        params.append('filter', filter.currentFilter.value);
      }

      const sortObj: Record<string, number> = {};
      sortObj[sort.currentSort.value.field] = sort.currentSort.value.order;
      params.append('sort', JSON.stringify(sortObj));

      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const url = `${baseUrl}/api/users?${params.toString()}`;
      
      const response = await fetch(url, {
        headers: credentialsStore.getHeaders(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      pagination.setPaginationData(data.pagination?.total || 0, data.pagination?.pages || 1);

      if (data.data && data.data.length > 0) {
        users.value = data.data;
      } else {
        users.value = [];
      }
    } catch (err) {
      console.error('Error loading users:', err);
      if (err instanceof TypeError && err.message.includes('fetch')) {
        error.value = 'Не удалось подключиться к серверу. Проверьте, что backend сервер запущен на порту 3000.';
      } else {
        error.value = err instanceof Error ? err.message : 'Ошибка загрузки';
      }
      users.value = [];
    } finally {
      loading.value = false;
    }
  }

  // Сохраняем ссылку на функцию для callbacks
  loadUsersFn = loadUsers;

  function formatTimestamp(timestamp: string | number | undefined) {
    if (!timestamp) return '-';
    const ts = typeof timestamp === 'string' ? parseFloat(timestamp) : timestamp;
    const date = new Date(ts);
    return date.toLocaleString('ru-RU');
  }

  // Модальные окна
  function showCreateModal() {
    createModal.open();
    createUserId.value = '';
    createType.value = 'user';
  }

  async function createUser() {
    const userData = {
      userId: createUserId.value.trim().toLowerCase(),
      type: createType.value || 'user',
    };

    try {
      const key = getApiKey();
      if (!key) {
        alert('API Key не указан. Пожалуйста, введите API Key.');
        return;
      }

      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';

      const response = await fetch(`${baseUrl}/api/users`, {
        method: 'POST',
        headers: {
          ...credentialsStore.getHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create user');
      }

      alert('Пользователь успешно создан!');
      createModal.close();
      createUserId.value = '';
      createType.value = 'user';
      loadUsers(pagination.currentPage.value, pagination.currentLimit.value);
    } catch (err) {
      console.error('Error creating user:', err);
      alert('Ошибка создания пользователя: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }

  async function showEditModal(userIdParam: string) {
    try {
      getApiKey(); // Проверка наличия ключа
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';

      const response = await fetch(`${baseUrl}/api/users/${userIdParam}`, {
        headers: credentialsStore.getHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to load user');
      }

      const { data: user } = await response.json();

      editUserId.value = user.userId;
      editType.value = user.type || 'user';
      editModal.open();
    } catch (err) {
      console.error('Error loading user:', err);
      alert('Ошибка загрузки данных пользователя');
    }
  }

  async function updateUser() {
    const userData = {
      type: editType.value || 'user',
    };

    try {
      getApiKey(); // Проверка наличия ключа
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';

      const response = await fetch(`${baseUrl}/api/users/${editUserId.value}`, {
        method: 'PUT',
        headers: {
          ...credentialsStore.getHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update user');
      }

      alert('Пользователь успешно обновлен!');
      editModal.close();
      loadUsers(pagination.currentPage.value, pagination.currentLimit.value);
    } catch (err) {
      console.error('Error updating user:', err);
      alert('Ошибка обновления пользователя: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }

  async function deleteUser(userIdParam: string) {
    if (!confirm(`Вы уверены, что хотите удалить пользователя "${userIdParam}"?`)) {
      return;
    }

    try {
      getApiKey(); // Проверка наличия ключа
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';

      const response = await fetch(`${baseUrl}/api/users/${userIdParam}`, {
        method: 'DELETE',
        headers: credentialsStore.getHeaders(),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete user');
      }

      loadUsers(pagination.currentPage.value, pagination.currentLimit.value);
      alert('Пользователь успешно удален!');
    } catch (err) {
      console.error('Error deleting user:', err);
      alert('Ошибка удаления пользователя: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }

  async function showMetaModal(userIdValue: string) {
    metaUserId.value = userIdValue;
    await loadMetaTags(userIdValue);
    metaModal.open();
  }

  async function loadMetaTags(userIdValue: string) {
    try {
      getApiKey(); // Проверка наличия ключа
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';

      const response = await fetch(`${baseUrl}/api/users/${userIdValue}`, {
        headers: credentialsStore.getHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to load user meta');
      }

      const { data: user } = await response.json();
      metaTags.value = user.meta || {};
    } catch (err) {
      console.error('Error loading meta tags:', err);
      alert('Ошибка загрузки мета-тегов: ' + (err instanceof Error ? err.message : 'Unknown error'));
      metaTags.value = null;
    }
  }

  async function addMetaTag() {
    if (metaUserId.value && newMetaKeyForEdit.value && newMetaValueForEdit.value) {
      try {
        getApiKey(); // Проверка наличия ключа
        const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
        const url = `${baseUrl}/api/meta/user/${metaUserId.value}/${newMetaKeyForEdit.value}`;

        let value: any;
        try {
          value = JSON.parse(newMetaValueForEdit.value);
        } catch {
          value = newMetaValueForEdit.value;
        }

        const response = await fetch(url, {
          method: 'PUT',
          headers: {
            ...credentialsStore.getHeaders(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ value }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to set meta tag');
        }

        alert('Meta тег успешно добавлен!');
        newMetaKeyForEdit.value = '';
        newMetaValueForEdit.value = '';
        await loadMetaTags(metaUserId.value);
      } catch (err) {
        console.error('Error adding meta tag:', err);
        alert('Ошибка добавления meta тега: ' + (err instanceof Error ? err.message : 'Unknown error'));
      }
    } else {
      alert('Заполните ключ и значение');
    }
  }

  async function deleteMetaTag(key: string) {
    if (!confirm(`Удалить meta тег "${key}"?`)) {
      return;
    }

    if (metaUserId.value && key) {
      try {
        getApiKey(); // Проверка наличия ключа
        const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
        const url = `${baseUrl}/api/meta/user/${metaUserId.value}/${key}`;

        const response = await fetch(url, {
          method: 'DELETE',
          headers: credentialsStore.getHeaders(),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to delete meta tag');
        }

        alert('Meta тег успешно удален!');
        await loadMetaTags(metaUserId.value);
      } catch (err) {
        console.error('Error deleting meta tag:', err);
        alert('Ошибка удаления meta тега: ' + (err instanceof Error ? err.message : 'Unknown error'));
      }
    }
  }

  async function showInfoModal(userIdParam: string) {
    try {
      getApiKey(); // Проверка наличия ключа
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const url = `${baseUrl}/api/users/${userIdParam}`;

      userInfoUrl.value = url;

      const response = await fetch(url, {
        headers: credentialsStore.getHeaders(),
      });

      const responseData = await response.json();

      if (!response.ok) {
        const errorJson = JSON.stringify(
          {
            status: response.status,
            statusText: response.statusText,
            error: responseData,
          },
          null,
          2,
        );
        jsonViewerContent.value = errorJson;
        currentJsonForCopy.value = errorJson;
      } else {
        const jsonStr = JSON.stringify(responseData, null, 2);
        jsonViewerContent.value = jsonStr;
        currentJsonForCopy.value = jsonStr;
      }

      infoModal.open();
      copyJsonButtonText.value = '📋 Копировать JSON';
    } catch (err) {
      console.error('Error showing info modal:', err);
      const errorJson = JSON.stringify(
        {
          error: err instanceof Error ? err.message : 'Unknown error',
        },
        null,
        2,
      );
      jsonViewerContent.value = errorJson;
      currentJsonForCopy.value = errorJson;
      infoModal.open();
    }
  }

  async function copyJsonToClipboard() {
    const jsonText = jsonViewerContent.value || currentJsonForCopy.value;

    if (!jsonText) {
      alert('Нет данных для копирования');
      return;
    }

    try {
      await navigator.clipboard.writeText(jsonText);
      copyJsonButtonText.value = '✅ Скопировано!';
      setTimeout(() => {
        copyJsonButtonText.value = '📋 Копировать JSON';
      }, 2000);
    } catch (err) {
      console.error('Failed to copy JSON:', err);
      alert('Не удалось скопировать JSON');
    }
  }

  function selectUserFilterExample() {
    // selectedFilterExample уже обновлен через v-model к моменту вызова @change
    const selected = filter.selectedFilterExample.value;
    
    if (selected && selected !== 'custom') {
      filter.filterInput.value = selected;
    } else if (selected === 'custom') {
      filter.filterInput.value = '';
    }
  }

  function clearUserFilter() {
    filter.clearFilter();
    loadUsers(1, pagination.currentLimit.value);
  }

  function applyUserFilter() {
    // Устанавливаем currentFilter напрямую из filterInput (как в оригинале)
    filter.currentFilter.value = filter.filterInput.value.trim();
    // После применения фильтра нужно перезагрузить данные с первой страницы
    loadUsers(1, pagination.currentLimit.value);
  }

  function generateApiUrl() {
    const key = getApiKey();
    if (!key) {
      return 'API Key не указан';
    }

    const params = new URLSearchParams({
      page: pagination.currentPage.value.toString(),
      limit: pagination.currentLimit.value.toString(),
    });

    if (filter.currentFilter.value) {
      params.append('filter', filter.currentFilter.value);
    }

    const sortObj: Record<string, number> = {};
    sortObj[sort.currentSort.value.field] = sort.currentSort.value.order;
    params.append('sort', JSON.stringify(sortObj));

    const baseUrl = configStore.config.TENANT_API_URL || '/api';
    return `${baseUrl}/api/users?${params.toString()}`;
  }

  function showUrlModal() {
    generatedUrl.value = generateApiUrl();
    urlModal.open();
    copyUrlButtonText.value = '📋 Скопировать';
  }

  async function copyUrlToClipboard() {
    const url = generatedUrl.value;
    try {
      await navigator.clipboard.writeText(url);
      copyUrlButtonText.value = '✓ Скопировано!';
      setTimeout(() => {
        copyUrlButtonText.value = '📋 Скопировать';
      }, 2000);
    } catch (err) {
      console.error('Ошибка копирования:', err);
      alert('Не удалось скопировать URL');
    }
  }

  // Инициализация
  onMounted(() => {
    // Загружаем credentials из store (они уже загружены из localStorage при создании store)
    credentialsStore.loadFromStorage();

    // Проверяем URL параметры (для обратной совместимости с iframe)
    const params = getUrlParams();
    if (params.apiKey) {
      setApiKeyFromExternal(params.apiKey, params.tenantId);
    } else {
      // Если нет URL параметров, но есть API Key в store, загружаем пользователей
      const key = getApiKey();
      if (key) {
        loadUsers(1);
      }
    }
  });

  return {
    // State
    users,
    loading,
    error,
    // Pagination (из composable)
    currentPage: pagination.currentPage,
    currentLimit: pagination.currentLimit,
    totalPages: pagination.totalPages,
    totalUsers: pagination.totalItems,
    currentPageInput: pagination.currentPageInput,
    paginationStart: pagination.paginationStart,
    paginationEnd: pagination.paginationEnd,
    // Filter (из composable)
    filterInput: filter.filterInput,
    selectedFilterExample: filter.selectedFilterExample,
    currentFilter: filter.currentFilter,
    // Sort (из composable)
    currentSort: sort.currentSort,
    // Modals (из composable)
    showCreateModalFlag: createModal.isOpen,
    showEditModalFlag: editModal.isOpen,
    showMetaModalFlag: metaModal.isOpen,
    showInfoModalFlag: infoModal.isOpen,
    showUrlModalFlag: urlModal.isOpen,
    // Создание пользователя
    createUserId,
    createType,
    // Редактирование пользователя
    editUserId,
    editType,
    // Meta теги
    metaUserId,
    metaTags,
    newMetaKeyForEdit,
    newMetaValueForEdit,
    // Info modal
    userInfoUrl,
    jsonViewerContent,
    copyJsonButtonText,
    // URL modal
    generatedUrl,
    copyUrlButtonText,
    // Functions
    loadUsers,
    goToFirstPage: pagination.goToFirstPage,
    goToPreviousPage: pagination.goToPreviousPage,
    goToNextPage: pagination.goToNextPage,
    goToLastPage: pagination.goToLastPage,
    goToPage: pagination.goToPage,
    changeLimit: pagination.changeLimit,
    getSortIndicator: sort.getSortIndicator,
    toggleSort: sort.toggleSort,
    formatTimestamp,
    showCreateModal,
    closeCreateModal: createModal.close,
    createUser,
    showEditModal,
    closeEditModal: editModal.close,
    updateUser,
    showMetaModal,
    closeMetaModal: metaModal.close,
    addMetaTag,
    deleteMetaTag,
    showInfoModal,
    closeInfoModal: infoModal.close,
    copyJsonToClipboard,
    deleteUser,
    selectUserFilterExample,
    clearUserFilter,
    applyUserFilter,
    showUrlModal,
    closeUrlModal: urlModal.close,
    copyUrlToClipboard,
  };
}
