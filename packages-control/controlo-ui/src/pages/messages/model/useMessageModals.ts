/**
 * Модуль модальных окон для работы с сообщениями
 * Отвечает за: отображение информации о сообщении, работа с meta-тегами, URL запросов
 */
import { ref, computed } from 'vue';
import { useConfigStore } from '@/app/stores/config';
import { useCredentialsStore } from '@/app/stores/credentials';
import { useModal } from '@/shared/lib/composables/useModal';
import { copyJsonFromModal } from '@/shared/lib/utils/clipboard';
import type { Ref } from 'vue';

export function useMessageModals(
  getApiKey: () => string,
  configStore: ReturnType<typeof useConfigStore>,
  credentialsStore: ReturnType<typeof useCredentialsStore>,
  currentPage: Ref<number>,
  currentLimit: Ref<number>,
  currentFilter: Ref<string | null>,
  currentSort: Ref<string | null>,
) {
  // Модальные окна
  const infoModal = useModal();
  const metaModal = useModal();
  const urlModal = useModal();

  // Meta теги
  const metaMessageId = ref('');
  const metaTags = ref<Record<string, any> | null>(null);
  const newMetaKeyForEdit = ref('');
  const newMetaValueForEdit = ref('');

  // Info modal
  const infoUrl = ref('');
  const jsonViewerContent = ref('');
  const currentJsonForCopy = ref('');
  const copyJsonButtonText = ref('📋 Копировать JSON');

  // URL modal
  const generatedUrl = ref('');
  const copyUrlButtonText = ref('📋 Скопировать');

  const fullUrl = computed(() => {
    const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
    return `${baseUrl}${generatedUrl.value}`;
  });

  // Info modal functions
  async function showInfoModal(messageIdParam: string) {
    try {
      getApiKey(); // Проверка наличия ключа
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const url = `${baseUrl}/api/messages/${messageIdParam}`;

      infoUrl.value = url;

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

  // Meta modal functions
  async function showMetaModal(messageIdValue: string) {
    metaMessageId.value = messageIdValue;
    await loadMetaTags(messageIdValue);
    metaModal.open();
  }

  async function loadMetaTags(messageIdValue: string) {
    try {
      getApiKey(); // Проверка наличия ключа
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';

      const response = await fetch(`${baseUrl}/api/messages/${messageIdValue}`, {
        headers: credentialsStore.getHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to load message meta');
      }

      const { data: message } = await response.json();
      metaTags.value = message.meta || {};
    } catch (err) {
      console.error('Error loading meta tags:', err);
      alert('Ошибка загрузки мета-тегов: ' + (err instanceof Error ? err.message : 'Unknown error'));
      metaTags.value = null;
    }
  }

  async function addMetaTag(keyFromModal?: string, valueFromModal?: any) {
    const key = (keyFromModal !== undefined && keyFromModal !== null ? keyFromModal : newMetaKeyForEdit.value).trim();
    const value =
      valueFromModal !== undefined && valueFromModal !== null
        ? valueFromModal
        : (() => {
            try {
              return JSON.parse(newMetaValueForEdit.value);
            } catch {
              return newMetaValueForEdit.value;
            }
          })();

    if (!metaMessageId.value || !key) {
      alert('Заполните ключ');
      return;
    }
    if (keyFromModal === undefined && !newMetaValueForEdit.value.trim()) {
      alert('Заполните значение');
      return;
    }

    try {
      getApiKey();
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const url = `${baseUrl}/api/meta/message/${metaMessageId.value}/${encodeURIComponent(key)}`;

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
      await loadMetaTags(metaMessageId.value);
    } catch (err) {
      console.error('Error adding meta tag:', err);
      alert('Ошибка добавления meta тега: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }

  async function deleteMetaTag(key: string) {
    if (!confirm(`Удалить meta тег "${key}"?`)) {
      return;
    }

    if (metaMessageId.value && key) {
      try {
        getApiKey(); // Проверка наличия ключа
        const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
        const url = `${baseUrl}/api/meta/message/${metaMessageId.value}/${key}`;

        const response = await fetch(url, {
          method: 'DELETE',
          headers: credentialsStore.getHeaders(),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to delete meta tag');
        }

        alert('Meta тег успешно удален!');
        await loadMetaTags(metaMessageId.value);
      } catch (err) {
        console.error('Error deleting meta tag:', err);
        alert('Ошибка удаления meta тега: ' + (err instanceof Error ? err.message : 'Unknown error'));
      }
    }
  }

  // URL modal functions
  function generateApiUrl() {
    const params = new URLSearchParams({
      page: currentPage.value.toString(),
      limit: currentLimit.value.toString(),
    });

    if (currentFilter.value) {
      params.append('filter', currentFilter.value);
    }

    if (currentSort.value) {
      params.append('sort', currentSort.value);
    }

    return `/api/messages?${params.toString()}`;
  }

  function showUrlModal() {
    generatedUrl.value = generateApiUrl();
    urlModal.open();
    copyUrlButtonText.value = '📋 Скопировать';
  }

  async function copyUrlToClipboard() {
    const url = fullUrl.value;
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
    infoModal,
    metaModal,
    urlModal,
    // Meta теги
    metaMessageId,
    metaTags,
    newMetaKeyForEdit,
    newMetaValueForEdit,
    // Info modal
    infoUrl,
    jsonViewerContent,
    copyJsonButtonText,
    // URL modal
    generatedUrl,
    fullUrl,
    copyUrlButtonText,
    // Functions
    showInfoModal,
    copyJsonToClipboard,
    showMetaModal,
    loadMetaTags,
    addMetaTag,
    deleteMetaTag,
    showUrlModal,
    copyUrlToClipboard,
  };
}
