/**
 * Модуль модальных окон для работы с пользователями
 * Отвечает за: создание, редактирование, удаление пользователей, работа с meta-тегами, отображение информации, URL запросов
 */
import { ref } from 'vue';
import { useConfigStore } from '@/app/stores/config';
import { useCredentialsStore } from '@/app/stores/credentials';
import { useModal } from '@/shared/lib/composables/useModal';
import { copyJsonFromModal } from '@/shared/lib/utils/clipboard';
import type { Ref } from 'vue';

export function useUserModals(
  getApiKey: () => string,
  configStore: ReturnType<typeof useConfigStore>,
  credentialsStore: ReturnType<typeof useCredentialsStore>,
  currentPage: Ref<number>,
  currentLimit: Ref<number>,
  currentFilter: Ref<string | null>,
  currentSort: { value: { field: string; order: number } },
  loadUsers: (page?: number, limit?: number) => Promise<void>,
) {
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

  // Create modal functions
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
      loadUsers(currentPage.value, currentLimit.value);
    } catch (err) {
      console.error('Error creating user:', err);
      alert('Ошибка создания пользователя: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }

  // Edit modal functions
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
      loadUsers(currentPage.value, currentLimit.value);
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

      loadUsers(currentPage.value, currentLimit.value);
      alert('Пользователь успешно удален!');
    } catch (err) {
      console.error('Error deleting user:', err);
      alert('Ошибка удаления пользователя: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }

  // Meta modal functions
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

  // Info modal functions
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

  async function copyJsonToClipboard(button?: HTMLElement) {
    const jsonText = jsonViewerContent.value || currentJsonForCopy.value;
    copyJsonFromModal(jsonText, button || null);
  }

  // URL modal functions
  function generateApiUrl() {
    const key = getApiKey();
    if (!key) {
      return 'API Key не указан';
    }

    const params = new URLSearchParams({
      page: currentPage.value.toString(),
      limit: currentLimit.value.toString(),
    });

    if (currentFilter.value) {
      params.append('filter', currentFilter.value);
    }

    const sortObj: Record<string, number> = {};
    sortObj[currentSort.value.field] = currentSort.value.order;
    params.append('sort', JSON.stringify(sortObj));

    const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
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

  return {
    // Modals
    createModal,
    editModal,
    metaModal,
    infoModal,
    urlModal,
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
    showCreateModal,
    createUser,
    showEditModal,
    updateUser,
    deleteUser,
    showMetaModal,
    loadMetaTags,
    addMetaTag,
    deleteMetaTag,
    showInfoModal,
    copyJsonToClipboard,
    showUrlModal,
    copyUrlToClipboard,
  };
}
