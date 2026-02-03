/**
 * Модуль модальных окон для работы с мета-тегами
 * Отвечает за: управление мета-тегами диалогов, сообщений, участников, топиков (добавление, удаление, редактирование)
 */
import { ref, type Ref } from 'vue';
import { useConfigStore } from '@/app/stores/config';
import { useCredentialsStore } from '@/app/stores/credentials';
import { useModal } from '@/shared/lib/composables/useModal';

export function useMetaModals(
  currentUserId: Ref<string | null>,
  currentDialogId: Ref<string | null>,
  currentViewMode: Ref<'messages' | 'members' | 'topics'>,
  loadDialogMembers: (dialogId: string, page?: number) => Promise<void>,
  loadDialogTopics: (dialogId: string, page?: number) => Promise<void>,
  membersPagination: any,
  topicsPagination: any
) {
  const configStore = useConfigStore();
  const credentialsStore = useCredentialsStore();

  // Модальные окна
  const dialogMetaModal = useModal();
  const memberMetaModal = useModal();
  const messageMetaModal = useModal();
  const topicMetaModal = useModal();

  // Мета-теги диалога
  const dialogMetaDialogId = ref('');
  const dialogMetaTags = ref<Record<string, any>>({});
  const loadingDialogMeta = ref(false);
  const newDialogMetaKey = ref('');
  const newDialogMetaValue = ref('');

  // Мета-теги участника
  const memberMetaModalDialogId = ref('');
  const memberMetaModalUserId = ref('');
  const memberMetaTags = ref<Array<{ key: string; value: string; isExisting: boolean }>>([]);
  const currentMemberMetaOriginal = ref<Record<string, any>>({});
  const memberMetaStatus = ref('');

  // Мета-теги сообщения
  const messageMetaMessageId = ref('');
  const messageMetaTagsData = ref<Record<string, any>>({});
  const newMessageMetaKey = ref('');
  const newMessageMetaValue = ref('');
  const loadingMessageMeta = ref(false);

  // Мета-теги топика
  const topicMetaDialogId = ref('');
  const topicMetaTopicId = ref('');
  const topicMetaTags = ref<Record<string, any>>({});
  const newTopicMetaKey = ref('');
  const newTopicMetaValue = ref('');
  const loadingTopicMeta = ref(false);

  // Функции для модального окна мета-тегов диалога
  async function showDialogMetaModal(dialogId: string) {
    dialogMetaDialogId.value = dialogId;
    dialogMetaModal.open();
    await loadDialogMetaTags(dialogId);
  }

  function closeDialogMetaModal() {
    dialogMetaModal.close();
    dialogMetaDialogId.value = '';
    dialogMetaTags.value = {};
    newDialogMetaKey.value = '';
    newDialogMetaValue.value = '';
  }

  async function loadDialogMetaTags(dialogId: string) {
    try {
      loadingDialogMeta.value = true;
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const fullUrl = `${baseUrl}/api/meta/dialog/${dialogId}`;
      const response = await fetch(fullUrl, {
        headers: credentialsStore.getHeaders(),
      });
      
      if (!response.ok) {
        throw new Error('Failed to load dialog meta');
      }
      
      const { data: meta } = await response.json();
      dialogMetaTags.value = meta || {};
    } catch (error) {
      console.error('Error loading dialog meta tags:', error);
      dialogMetaTags.value = {};
    } finally {
      loadingDialogMeta.value = false;
    }
  }

  async function addDialogMetaTag(keyOrEmpty?: string, valueFromModal?: any) {
    const dialogId = dialogMetaDialogId.value;
    const key = (keyOrEmpty !== undefined && keyOrEmpty !== null ? keyOrEmpty : newDialogMetaKey.value).trim();
    const value =
      valueFromModal !== undefined && valueFromModal !== null
        ? valueFromModal
        : parseMetaValueFromInput(newDialogMetaValue.value.trim());

    if (!key) {
      alert('Заполните ключ');
      return;
    }
    if (keyOrEmpty === undefined && !newDialogMetaValue.value.trim()) {
      alert('Заполните значение');
      return;
    }
    
    try {
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const fullUrl = `${baseUrl}/api/meta/dialog/${dialogId}/${key}`;
      const response = await fetch(fullUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...credentialsStore.getHeaders(),
        },
        body: JSON.stringify({ value }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to set meta tag');
      }

      newDialogMetaKey.value = '';
      newDialogMetaValue.value = '';
      await loadDialogMetaTags(dialogId);
      alert('Meta тег успешно добавлен!');
    } catch (error) {
      console.error('Error adding dialog meta tag:', error);
      alert(`Ошибка добавления meta тега: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async function deleteDialogMetaTag(key: string) {
    if (!confirm(`Удалить meta тег "${key}"?`)) {
      return;
    }
    
    const dialogId = dialogMetaDialogId.value;
    try {
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const fullUrl = `${baseUrl}/api/meta/dialog/${dialogId}/${key}`;
      const response = await fetch(fullUrl, {
        method: 'DELETE',
        headers: credentialsStore.getHeaders(),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete meta tag');
      }
      
      await loadDialogMetaTags(dialogId);
      alert('Meta тег успешно удален!');
    } catch (error) {
      console.error('Error deleting dialog meta tag:', error);
      alert(`Ошибка удаления meta тега: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Функции для модального окна мета-тегов участника
  async function showMemberMetaModal(dialogId: string, userId: string) {
    memberMetaModalDialogId.value = dialogId;
    memberMetaModalUserId.value = userId;
    memberMetaStatus.value = '';
    
    try {
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const fullUrl = `${baseUrl}/api/dialogs/${dialogId}/members?filter=(userId,eq,${userId})`;
      const response = await fetch(fullUrl, {
        headers: credentialsStore.getHeaders(),
      });
      
      if (response.ok) {
        const data = await response.json();
        const members = Array.isArray(data.data) ? data.data : [];
        const member = members.find((m: any) => m.userId === userId);
        const meta = member?.meta || {};
        currentMemberMetaOriginal.value = JSON.parse(JSON.stringify(meta));
        
        memberMetaTags.value = Object.keys(meta).map((key) => ({
          key,
          value: formatMetaValueForInput(meta[key]),
          isExisting: true,
        }));
      } else {
        currentMemberMetaOriginal.value = {};
        memberMetaTags.value = [];
      }
    } catch (error) {
      console.error('Error loading member meta:', error);
      currentMemberMetaOriginal.value = {};
      memberMetaTags.value = [];
    }
    
    memberMetaModal.open();
  }

  function closeMemberMetaModal() {
    memberMetaModal.close();
    memberMetaModalDialogId.value = '';
    memberMetaModalUserId.value = '';
    memberMetaTags.value = [];
    currentMemberMetaOriginal.value = {};
    memberMetaStatus.value = '';
  }

  function addMemberMetaRowModal() {
    memberMetaTags.value.push({ key: '', value: '', isExisting: false });
  }

  function removeMemberMetaRowModal(index: number) {
    memberMetaTags.value.splice(index, 1);
    if (memberMetaTags.value.length === 0) {
      memberMetaTags.value = [];
    }
  }

  function formatMetaValueForInput(value: any): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    return JSON.stringify(value);
  }

  function parseMetaValueFromInput(inputValue: string): any {
    if (!inputValue || inputValue.trim() === '') return null;
    const trimmed = inputValue.trim();
    
    // Попробуем распознать как массив (JSON)
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        return JSON.parse(trimmed);
      } catch (_e) {
        // Если не парсится как JSON, вернем строку
        return trimmed;
      }
    }
    
    // Попробуем распознать как объект (JSON)
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        return JSON.parse(trimmed);
      } catch (_e) {
        return trimmed;
      }
    }
    
    // Попробуем распознать как число
    const num = Number(trimmed);
    if (!isNaN(num) && trimmed !== '') {
      // Проверяем, что это действительно число, а не случайность
      const isNumber = /^-?\d+(\.\d+)?$/.test(trimmed);
      if (isNumber) {
        return num;
      }
    }
    
    // Попробуем распознать как boolean
    if (trimmed.toLowerCase() === 'true') return true;
    if (trimmed.toLowerCase() === 'false') return false;
    
    // Если null или undefined
    if (trimmed.toLowerCase() === 'null') return null;
    if (trimmed.toLowerCase() === 'undefined') return undefined;
    
    // В остальных случаях возвращаем строку
    return trimmed;
  }

  function collectMemberMetaTagsModal(): Record<string, any> {
    const meta: Record<string, any> = {};
    memberMetaTags.value.forEach((tag) => {
      if (tag.key.trim()) {
        meta[tag.key.trim()] = parseMetaValueFromInput(tag.value);
      }
    });
    return meta;
  }

  async function saveMemberMetaChangesModal() {
    if (!memberMetaModalDialogId.value || !memberMetaModalUserId.value) {
      alert('Ошибка: не выбран диалог или участник');
      return;
    }
    
    const newMeta = collectMemberMetaTagsModal();
    memberMetaStatus.value = '';
    
    try {
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const oldKeys = Object.keys(currentMemberMetaOriginal.value);
      for (const key of oldKeys) {
        if (!(key in newMeta)) {
          const fullUrl = `${baseUrl}/api/dialogs/${memberMetaModalDialogId.value}/members/${memberMetaModalUserId.value}/meta/${key}`;
          await fetch(fullUrl, {
            method: 'DELETE',
            headers: credentialsStore.getHeaders(),
          });
        }
      }
      
      for (const [key, value] of Object.entries(newMeta)) {
        const oldValue = currentMemberMetaOriginal.value[key];
        if (oldValue !== value) {
          const fullUrl = `${baseUrl}/api/dialogs/${memberMetaModalDialogId.value}/members/${memberMetaModalUserId.value}/meta/${key}`;
          await fetch(fullUrl, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              ...credentialsStore.getHeaders(),
            },
            body: JSON.stringify({ value }),
          });
        }
      }
      
      memberMetaStatus.value = 'Мета-теги успешно сохранены';
      
      if (currentDialogId.value === memberMetaModalDialogId.value) {
        await loadDialogMembers(currentDialogId.value, membersPagination.currentPage.value);
      }
      
      currentMemberMetaOriginal.value = JSON.parse(JSON.stringify(newMeta));
      
      setTimeout(() => {
        memberMetaStatus.value = '';
      }, 3000);
    } catch (error) {
      console.error('Error saving member meta:', error);
      memberMetaStatus.value = `Ошибка: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  // Функции для модального окна мета-тегов сообщения
  async function showMessageMetaModal(messageId: string) {
    if (!currentUserId.value || !currentDialogId.value) {
      alert('Сначала выберите пользователя и диалог');
      return;
    }
    
    messageMetaMessageId.value = messageId;
    messageMetaModal.open();
    await loadMessageMetaTags(messageId);
  }

  function closeMessageMetaModal() {
    messageMetaModal.close();
    messageMetaMessageId.value = '';
    messageMetaTagsData.value = {};
    newMessageMetaKey.value = '';
    newMessageMetaValue.value = '';
  }

  async function loadMessageMetaTags(messageId: string) {
    if (!currentUserId.value || !currentDialogId.value) {
      return;
    }
    
    try {
      loadingMessageMeta.value = true;
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const fullUrl = `${baseUrl}/api/users/${currentUserId.value}/dialogs/${currentDialogId.value}/messages/${messageId}`;
      const response = await fetch(fullUrl, {
        headers: credentialsStore.getHeaders(),
      });
      
      if (!response.ok) {
        throw new Error('Failed to load message meta');
      }
      
      const { data: message } = await response.json();
      messageMetaTagsData.value = message.meta || {};
    } catch (error) {
      console.error('Error loading message meta tags:', error);
      messageMetaTagsData.value = {};
    } finally {
      loadingMessageMeta.value = false;
    }
  }

  async function addMessageMetaTag(keyOrEmpty?: string, valueFromModal?: any) {
    const messageId = messageMetaMessageId.value;
    const key = (keyOrEmpty !== undefined && keyOrEmpty !== null ? keyOrEmpty : newMessageMetaKey.value).trim();
    const value =
      valueFromModal !== undefined && valueFromModal !== null
        ? valueFromModal
        : parseMetaValueFromInput(newMessageMetaValue.value.trim());

    if (!key) {
      alert('Заполните ключ');
      return;
    }
    if (keyOrEmpty === undefined && !newMessageMetaValue.value.trim()) {
      alert('Заполните значение');
      return;
    }
    
    try {
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const fullUrl = `${baseUrl}/api/meta/message/${messageId}/${encodeURIComponent(key)}`;
      const response = await fetch(fullUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...credentialsStore.getHeaders(),
        },
        body: JSON.stringify({ value }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to set meta tag');
      }

      newMessageMetaKey.value = '';
      newMessageMetaValue.value = '';
      await loadMessageMetaTags(messageId);
      alert('Meta тег успешно добавлен!');
    } catch (error) {
      console.error('Error adding message meta tag:', error);
      alert(`Ошибка добавления meta тега: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  

  async function deleteMessageMetaTag(key: string) {
    if (!confirm(`Удалить meta тег "${key}"?`)) {
      return;
    }
    
    const messageId = messageMetaMessageId.value;
    try {
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const fullUrl = `${baseUrl}/api/meta/message/${messageId}/${encodeURIComponent(key)}`;
      const response = await fetch(fullUrl, {
        method: 'DELETE',
        headers: credentialsStore.getHeaders(),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete meta tag');
      }
      
      await loadMessageMetaTags(messageId);
      alert('Meta тег успешно удален!');
    } catch (error) {
      console.error('Error deleting message meta tag:', error);
      alert(`Ошибка удаления meta тега: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Функции для модального окна мета-тегов топика
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
      topicMetaTags.value = topic.meta || {};
    } catch (error) {
      console.error('Error loading topic meta tags:', error);
      topicMetaTags.value = {};
    } finally {
      loadingTopicMeta.value = false;
    }
  }

  async function addTopicMetaTag(keyOrEmpty?: string, valueFromModal?: any) {
    const dialogId = topicMetaDialogId.value;
    const topicId = topicMetaTopicId.value;
    const key = (keyOrEmpty !== undefined && keyOrEmpty !== null ? keyOrEmpty : newTopicMetaKey.value).trim();
    const value =
      valueFromModal !== undefined && valueFromModal !== null
        ? valueFromModal
        : parseMetaValueFromInput(newTopicMetaValue.value.trim());

    if (!key) {
      alert('Заполните ключ');
      return;
    }
    if (keyOrEmpty === undefined && !newTopicMetaValue.value.trim()) {
      alert('Заполните значение');
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
        const error = await response.json();
        throw new Error(error.message || 'Failed to set meta tag');
      }
      
      newTopicMetaKey.value = '';
      newTopicMetaValue.value = '';
      await loadTopicMetaTags(dialogId, topicId);
      if (currentViewMode.value === 'topics' && currentDialogId.value === dialogId) {
        await loadDialogTopics(dialogId, topicsPagination.currentPage.value);
      }
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
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete meta tag');
      }
      
      await loadTopicMetaTags(dialogId, topicId);
      if (currentViewMode.value === 'topics' && currentDialogId.value === dialogId) {
        await loadDialogTopics(dialogId, topicsPagination.currentPage.value);
      }
      alert('Meta тег успешно удален!');
    } catch (error) {
      console.error('Error deleting topic meta tag:', error);
      alert(`Ошибка удаления meta тега: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return {
    // Modals
    dialogMetaModal,
    memberMetaModal,
    messageMetaModal,
    topicMetaModal,
    // Dialog meta
    dialogMetaDialogId,
    dialogMetaTags,
    loadingDialogMeta,
    newDialogMetaKey,
    newDialogMetaValue,
    showDialogMetaModal,
    closeDialogMetaModal,
    loadDialogMetaTags,
    addDialogMetaTag,
    deleteDialogMetaTag,
    // Member meta
    memberMetaModalDialogId,
    memberMetaModalUserId,
    memberMetaTags,
    currentMemberMetaOriginal,
    memberMetaStatus,
    showMemberMetaModal,
    closeMemberMetaModal,
    addMemberMetaRowModal,
    removeMemberMetaRowModal,
    formatMetaValueForInput,
    parseMetaValueFromInput,
    collectMemberMetaTagsModal,
    saveMemberMetaChangesModal,
    // Message meta
    messageMetaMessageId,
    messageMetaTagsData,
    loadingMessageMeta,
    newMessageMetaKey,
    newMessageMetaValue,
    showMessageMetaModal,
    closeMessageMetaModal,
    loadMessageMetaTags,
    addMessageMetaTag,
    deleteMessageMetaTag,
    // Topic meta
    topicMetaDialogId,
    topicMetaTopicId,
    topicMetaTags,
    loadingTopicMeta,
    newTopicMetaKey,
    newTopicMetaValue,
    showTopicMetaModal,
    closeTopicMetaModal,
    loadTopicMetaTags,
    addTopicMetaTag,
    deleteTopicMetaTag,
  };
}
