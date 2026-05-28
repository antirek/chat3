/**
 * Модальное окно мета-тегов топика для страницы «Топики + Сообщения».
 * Переиспользует API: GET /api/dialogs/:dialogId/topics/:topicId, PUT/DELETE /api/meta/topic/:topicId/:key
 */
import { ref } from 'vue';
import { useConfigStore } from '@/app/stores/config';
import { useCredentialsStore } from '@/app/stores/credentials';
import { useModal } from '@/shared/lib/composables/useModal';

export function useTopicMetaModal(
  getApiKey: () => string,
  loadTopics: (page?: number) => Promise<void>
) {
  const configStore = useConfigStore();
  const credentialsStore = useCredentialsStore();

  const topicMetaModal = useModal();
  const topicMetaDialogId = ref('');
  const topicMetaTopicId = ref('');
  const topicMetaTags = ref<Record<string, unknown>>({});
  const loadingTopicMeta = ref(false);
  const newTopicMetaKey = ref('');
  const newTopicMetaValue = ref('');

  async function showTopicMetaModal(dialogId: string, topicId: string) {
    topicMetaDialogId.value = dialogId;
    topicMetaTopicId.value = topicId;
    topicMetaModal.open();
    await loadTopicMetaTags(dialogId, topicId);
  }

  function closeTopicMetaModal() {
    topicMetaModal.close();
    topicMetaDialogId.value = '';
    topicMetaTopicId.value = '';
    topicMetaTags.value = {};
    newTopicMetaKey.value = '';
    newTopicMetaValue.value = '';
  }

  async function loadTopicMetaTags(dialogId: string, topicId: string) {
    try {
      loadingTopicMeta.value = true;
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const fullUrl = `${baseUrl}/api/dialogs/${dialogId}/topics/${topicId}`;
      const response = await fetch(fullUrl, {
        headers: credentialsStore.getHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to load topic meta');
      }

      const { data: topic } = await response.json();
      topicMetaTags.value = (topic?.meta && typeof topic.meta === 'object') ? { ...topic.meta } : {};
    } catch (error) {
      console.error('Error loading topic meta tags:', error);
      topicMetaTags.value = {};
    } finally {
      loadingTopicMeta.value = false;
    }
  }

  async function addTopicMetaTag(keyOrEmpty?: string, valueFromModal?: unknown) {
    const dialogId = topicMetaDialogId.value;
    const topicId = topicMetaTopicId.value;
    const key = (keyOrEmpty !== undefined && keyOrEmpty !== null ? keyOrEmpty : newTopicMetaKey.value).trim();
    let value: unknown;
    if (valueFromModal !== undefined && valueFromModal !== null) {
      value = valueFromModal;
    } else {
      const valueStr = newTopicMetaValue.value.trim();
      if (!valueStr) {
        alert('Заполните значение');
        return;
      }
      try {
        value = JSON.parse(valueStr);
      } catch {
        value = valueStr;
      }
    }

    if (!key) {
      alert('Заполните ключ');
      return;
    }

    try {
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const fullUrl = `${baseUrl}/api/meta/topic/${topicId}/${encodeURIComponent(key)}`;
      const response = await fetch(fullUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...credentialsStore.getHeaders(),
        },
        body: JSON.stringify({ value }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error((errBody as any).message || 'Failed to set meta tag');
      }

      newTopicMetaKey.value = '';
      newTopicMetaValue.value = '';
      await loadTopicMetaTags(dialogId, topicId);
      await loadTopics(1);
      alert('Meta тег успешно добавлен!');
    } catch (error) {
      console.error('Error adding topic meta tag:', error);
      alert(`Ошибка добавления meta тега: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async function deleteTopicMetaTag(key: string) {
    if (!confirm(`Удалить meta тег "${key}"?`)) {
      return;
    }

    const dialogId = topicMetaDialogId.value;
    const topicId = topicMetaTopicId.value;
    try {
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const fullUrl = `${baseUrl}/api/meta/topic/${topicId}/${encodeURIComponent(key)}`;
      const response = await fetch(fullUrl, {
        method: 'DELETE',
        headers: credentialsStore.getHeaders(),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error((errBody as any).message || 'Failed to delete meta tag');
      }

      await loadTopicMetaTags(dialogId, topicId);
      await loadTopics(1);
      alert('Meta тег успешно удален!');
    } catch (error) {
      console.error('Error deleting topic meta tag:', error);
      alert(`Ошибка удаления meta тега: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return {
    topicMetaModal,
    topicMetaDialogId,
    topicMetaTopicId,
    topicMetaTags,
    loadingTopicMeta,
    showTopicMetaModal,
    closeTopicMetaModal,
    loadTopicMetaTags,
    addTopicMetaTag,
    deleteTopicMetaTag,
  };
}
