/**
 * Модуль модальных окон для работы с диалогами
 * Отвечает за: создание диалога, отображение информации о диалоге, URL диалогов
 */
import { ref } from 'vue';
import { useConfigStore } from '@/app/stores/config';
import { useCredentialsStore } from '@/app/stores/credentials';
import { useModal } from '@/shared/lib/composables/useModal';

export function useDialogModals(
  getApiKey: () => string,
  loadDialogsWithFilter: (filter: string) => Promise<void>,
  currentFilter: { value: string | null },
  dialogsPagination: {
    currentPage: { value: number };
  },
  currentAdditionalFilter: { value: string | null },
  currentSort: { value: string },
  showModal: (title: string, content: string, url: string | null, jsonContent: any) => void,
  urlModal: ReturnType<typeof useModal>,
  urlModalTitle: { value: string },
  urlModalUrl: { value: string },
  urlCopyButtonText: { value: string },
) {
  // Конфигурация
  const configStore = useConfigStore();
  const credentialsStore = useCredentialsStore();

  // Модальное окно для создания диалога
  const createDialogModal = useModal();

  // Создание диалога
  const usersForDialog = ref<any[]>([]);
  const loadingUsers = ref(false);
  const usersError = ref<string | null>(null);
  const usersLoaded = ref(false);
  const selectedMembers = ref<string[]>([]);

  // Функции создания диалога
  function showAddDialogModal() {
    createDialogModal.open();
    usersForDialog.value = [];
    selectedMembers.value = [];
    usersLoaded.value = false;
    usersError.value = null;
  }

  async function loadUsersForDialog() {
    const key = getApiKey();
    if (!key) {
      alert('API ключ не задан');
      return;
    }

    loadingUsers.value = true;
    usersError.value = null;
    usersLoaded.value = false;

    try {
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const response = await fetch(`${baseUrl}/api/users?limit=100`, {
        headers: credentialsStore.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const users = data.data || data.users || [];

      if (users.length === 0) {
        usersForDialog.value = [];
        usersLoaded.value = true;
        return;
      }

      usersForDialog.value = users.map((user: any) => ({
        userId: user.userId || user._id,
        userName: user.meta?.name || user.userId || user._id,
        userType: user.type || 'user',
      }));

      usersLoaded.value = true;
    } catch (error) {
      console.error('Error loading users:', error);
      usersError.value = error instanceof Error ? error.message : 'Ошибка загрузки';
    } finally {
      loadingUsers.value = false;
    }
  }

  async function createDialog() {
    const key = getApiKey();
    if (!key) {
      alert('API ключ не задан');
      return;
    }

    if (selectedMembers.value.length === 0) {
      alert('Выберите хотя бы одного участника');
      return;
    }

    try {
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';

      const requestBody = {
        members: selectedMembers.value.map((userId) => ({ userId })),
      };

      const response = await fetch(`${baseUrl}/api/dialogs`, {
        method: 'POST',
        headers: {
          ...credentialsStore.getHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || errorData.error || `HTTP error! status: ${response.status}`;
        throw new Error(errorMessage);
      }

      const result = await response.json();
      const dialog = result.data || result;

      alert(`Диалог успешно создан!\nDialog ID: ${dialog.dialogId || dialog._id}`);

      createDialogModal.close();

      loadDialogsWithFilter(currentFilter.value || '');
    } catch (error) {
      console.error('Error creating dialog:', error);
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      alert(`Ошибка при создании диалога: ${errorMessage}`);
    }
  }

  // Модалки диалогов
  async function showDialogInfo(dialogId: string) {
    try {
      getApiKey(); // Проверка наличия ключа
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const url = `${baseUrl}/api/dialogs/${dialogId}`;

      const response = await fetch(url, {
        headers: credentialsStore.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const dialog = await response.json();
      const dialogData = dialog.data || dialog;

      const dialogName = dialogData.dialogId || 'Диалог';

      const formattedJson = JSON.stringify(dialog, null, 2);
      showModal(
        `Информация о диалоге: ${dialogName}`,
        `<div class="json-content">${formattedJson}</div>`,
        url,
        dialogData,
      );
    } catch (error) {
      console.error('Error loading dialog info:', error);
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const url = `${baseUrl}/api/dialogs/${dialogId}`;
      showModal('Ошибка', `Не удалось загрузить информацию о диалоге: ${error instanceof Error ? error.message : 'Unknown error'}`, url, null);
    }
  }

  function showCurrentUrl() {
    let url = `/api/dialogs`;
    const params = new URLSearchParams();

    params.append('page', dialogsPagination.currentPage.value.toString());
    params.append('limit', '10');

    if (currentFilter.value) {
      params.append('filter', currentFilter.value);
    }

    if (currentAdditionalFilter.value) {
      params.append('filter', currentAdditionalFilter.value);
    }

    if (currentSort.value) {
      params.append('sort', currentSort.value);
    }

    const fullUrl = url + (params.toString() ? '?' + params.toString() : '');
    const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
    const completeUrl = `${baseUrl}${fullUrl}`;

    urlModalTitle.value = 'Текущий URL запроса диалогов';
    urlModalUrl.value = completeUrl;
    urlCopyButtonText.value = '📋 Скопировать URL';
    urlModal.open();
  }

  return {
    // Модальные окна
    createDialogModal,
    // Создание диалога
    usersForDialog,
    loadingUsers,
    usersError,
    usersLoaded,
    selectedMembers,
    showAddDialogModal,
    loadUsersForDialog,
    createDialog,
    // Модалки диалогов
    showDialogInfo,
    showCurrentUrl,
  };
}
