/**
 * Модуль модальных окон для паков
 * Создание (POST /api/packs), инфо (GET /api/packs/:packId), meta, удаление, URL
 */
import { ref, computed } from 'vue';
import { useConfigStore } from '@/app/stores/config';
import { useCredentialsStore } from '@/app/stores/credentials';
import { useModal } from '@/shared/lib/composables/useModal';
import { copyJsonFromModal } from '@/shared/lib/utils/clipboard';
import type { Ref } from 'vue';

export function usePackModals(
  getApiKey: () => string,
  configStore: ReturnType<typeof useConfigStore>,
  credentialsStore: ReturnType<typeof useCredentialsStore>,
  currentPage: Ref<number>,
  currentLimit: Ref<number>,
  currentFilter: Ref<string | null>,
  currentSort: { value: { field: string; order: number } },
  loadPacks: (page?: number, limit?: number) => Promise<void>,
) {
  const createModal = useModal();
  const addDialogModal = useModal();
  const metaModal = useModal();
  const infoModal = useModal();
  const dialogInfoModal = useModal();
  const urlModal = useModal();

  const addDialogPackId = ref('');
  const addDialogDialogId = ref('');
  const metaPackId = ref('');
  const metaTags = ref<Record<string, any> | null>(null);
  const newMetaKeyForEdit = ref('');
  const newMetaValueForEdit = ref('');
  const infoUrl = ref('');
  const jsonViewerContent = ref('');
  const currentJsonForCopy = ref('');
  const copyJsonButtonText = ref('📋 Копировать JSON');
  const generatedUrl = ref('');
  const copyUrlButtonText = ref('📋 Скопировать');
  const dialogInfoUrl = ref('');
  const dialogInfoJsonContent = ref('');
  const dialogInfoJsonForCopy = ref('');
  const dialogInfoCopyButtonText = ref('📋 Копировать JSON');

  function showCreateModal() {
    createModal.open();
  }

  function showAddDialogModal(packId: string) {
    addDialogPackId.value = packId;
    addDialogDialogId.value = '';
    addDialogModal.open();
  }

  function closeAddDialogModal() {
    addDialogModal.close();
    addDialogDialogId.value = '';
  }

  async function addDialogToPack() {
    const packId = addDialogPackId.value;
    const dialogId = addDialogDialogId.value.trim().toLowerCase();
    if (!dialogId) {
      alert('Введите Dialog ID');
      return;
    }
    if (!/^dlg_[a-z0-9]{20}$/.test(dialogId)) {
      alert('Dialog ID должен быть в формате dlg_ и 20 символов (a-z, 0-9)');
      return;
    }
    try {
      getApiKey();
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const response = await fetch(`${baseUrl}/api/packs/${packId}/dialogs`, {
        method: 'POST',
        headers: {
          ...credentialsStore.getHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dialogId }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to add dialog to pack');
      }
      closeAddDialogModal();
      loadPacks(currentPage.value, currentLimit.value);
      alert('Диалог добавлен в пак');
    } catch (err) {
      console.error('Error adding dialog to pack:', err);
      alert('Ошибка: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }

  async function createPack() {
    try {
      getApiKey();
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';

      const response = await fetch(`${baseUrl}/api/packs`, {
        method: 'POST',
        headers: {
          ...credentialsStore.getHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create pack');
      }

      createModal.close();
      loadPacks(1, currentLimit.value);
      alert('Пак успешно создан!');
    } catch (err) {
      console.error('Error creating pack:', err);
      alert('Ошибка создания пака: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }

  async function showMetaModal(packId: string) {
    metaPackId.value = packId;
    metaModal.open();
    await loadMetaTags(packId);
  }

  function closeMetaModal() {
    metaModal.close();
    metaTags.value = null;
    newMetaKeyForEdit.value = '';
    newMetaValueForEdit.value = '';
  }

  async function loadMetaTags(packId: string) {
    try {
      getApiKey();
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';

      const response = await fetch(`${baseUrl}/api/meta/pack/${packId}`, {
        headers: credentialsStore.getHeaders(),
      });

      if (!response.ok) throw new Error('Failed to load pack meta');

      const { data: meta } = await response.json();
      metaTags.value = meta || {};
    } catch (err) {
      console.error('Error loading pack meta:', err);
      metaTags.value = null;
    }
  }

  async function addMetaTag() {
    const packId = metaPackId.value;
    const key = newMetaKeyForEdit.value.trim();
    const valueStr = newMetaValueForEdit.value.trim();

    if (!key || !valueStr) {
      alert('Заполните ключ и значение');
      return;
    }

    let value: any;
    try {
      value = JSON.parse(valueStr);
    } catch {
      value = valueStr;
    }

    try {
      getApiKey();
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';

      const response = await fetch(`${baseUrl}/api/meta/pack/${packId}/${key}`, {
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

      newMetaKeyForEdit.value = '';
      newMetaValueForEdit.value = '';
      await loadMetaTags(packId);
      alert('Meta тег успешно добавлен!');
    } catch (err) {
      console.error('Error adding meta tag:', err);
      alert('Ошибка добавления meta тега: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }

  async function deleteMetaTag(key: string) {
    if (!confirm(`Удалить meta тег "${key}"?`)) return;

    try {
      getApiKey();
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';

      const response = await fetch(`${baseUrl}/api/meta/pack/${metaPackId.value}/${key}`, {
        method: 'DELETE',
        headers: credentialsStore.getHeaders(),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete meta tag');
      }

      await loadMetaTags(metaPackId.value);
      alert('Meta тег успешно удален!');
    } catch (err) {
      console.error('Error deleting meta tag:', err);
      alert('Ошибка удаления meta тега: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }

  async function showInfoModal(packId: string) {
    try {
      getApiKey();
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const url = `${baseUrl}/api/packs/${packId}`;
      infoUrl.value = url;

      const packResponse = await fetch(url, { headers: credentialsStore.getHeaders() });
      const responseData = await packResponse.json();

      if (!packResponse.ok) {
        const errorJson = JSON.stringify(
          { status: packResponse.status, statusText: packResponse.statusText, error: responseData },
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
      console.error('Error loading pack info:', err);
      const errorJson = JSON.stringify(
        { error: err instanceof Error ? err.message : 'Unknown error' },
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

  async function showDialogInfoModal(dialogId: string) {
    try {
      getApiKey();
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const url = `${baseUrl}/api/dialogs/${dialogId}`;
      dialogInfoUrl.value = url;

      const response = await fetch(url, { headers: credentialsStore.getHeaders() });
      const responseData = await response.json();

      if (!response.ok) {
        const errorJson = JSON.stringify(
          { status: response.status, statusText: response.statusText, error: responseData },
          null,
          2,
        );
        dialogInfoJsonContent.value = errorJson;
        dialogInfoJsonForCopy.value = errorJson;
      } else {
        const jsonStr = JSON.stringify(responseData, null, 2);
        dialogInfoJsonContent.value = jsonStr;
        dialogInfoJsonForCopy.value = jsonStr;
      }

      dialogInfoModal.open();
      dialogInfoCopyButtonText.value = '📋 Копировать JSON';
    } catch (err) {
      console.error('Error loading dialog info:', err);
      const errorJson = JSON.stringify(
        { error: err instanceof Error ? err.message : 'Unknown error' },
        null,
        2,
      );
      dialogInfoJsonContent.value = errorJson;
      dialogInfoJsonForCopy.value = errorJson;
      dialogInfoModal.open();
    }
  }

  function closeDialogInfoModal() {
    dialogInfoModal.close();
  }

  async function copyDialogJsonToClipboard(button?: HTMLElement) {
    const jsonText = dialogInfoJsonContent.value || dialogInfoJsonForCopy.value;
    copyJsonFromModal(jsonText, button || null);
  }

  async function deletePack(packId: string) {
    if (!confirm(`Удалить пак "${packId}"?`)) return;

    try {
      getApiKey();
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';

      const response = await fetch(`${baseUrl}/api/packs/${packId}`, {
        method: 'DELETE',
        headers: credentialsStore.getHeaders(),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete pack');
      }

      loadPacks(currentPage.value, currentLimit.value);
      alert('Пак успешно удален!');
    } catch (err) {
      console.error('Error deleting pack:', err);
      alert('Ошибка удаления пака: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }

  function generateApiUrl() {
    const key = getApiKey();
    if (!key) return 'Укажите API Key';

    const params = new URLSearchParams({
      page: currentPage.value.toString(),
      limit: currentLimit.value.toString(),
      sort: currentSort.value.field || 'createdAt',
      sortDirection: currentSort.value.order === 1 ? 'asc' : 'desc',
    });
    if (currentFilter.value) params.append('filter', currentFilter.value);

    const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
    return `${baseUrl}/api/packs?${params.toString()}`;
  }

  const fullUrl = computed(() => generateApiUrl());

  function showUrlModal() {
    generatedUrl.value = generateApiUrl();
    urlModal.open();
    copyUrlButtonText.value = '📋 Скопировать';
  }

  async function copyUrlToClipboard() {
    const url = generateApiUrl();
    try {
      await navigator.clipboard.writeText(url);
      copyUrlButtonText.value = '✓ Скопировано!';
      setTimeout(() => { copyUrlButtonText.value = '📋 Скопировать'; }, 2000);
    } catch (err) {
      console.error('Ошибка копирования:', err);
      alert('Не удалось скопировать URL');
    }
  }

  return {
    createModal,
    addDialogModal,
    addDialogPackId,
    addDialogDialogId,
    metaPackId,
    showAddDialogModal,
    closeAddDialogModal,
    addDialogToPack,
    metaModal,
    infoModal,
    dialogInfoModal,
    urlModal,
    metaTags,
    newMetaKeyForEdit,
    newMetaValueForEdit,
    infoUrl,
    jsonViewerContent,
    copyJsonButtonText,
    dialogInfoUrl,
    dialogInfoJsonContent,
    dialogInfoCopyButtonText,
    generatedUrl,
    copyUrlButtonText,
    showCreateModal,
    createPack,
    showMetaModal,
    closeMetaModal,
    addMetaTag,
    deleteMetaTag,
    showInfoModal,
    copyJsonToClipboard,
    showDialogInfoModal,
    closeDialogInfoModal,
    copyDialogJsonToClipboard,
    deletePack,
    showUrlModal,
    copyUrlToClipboard,
  };
}
