/**
 * Модуль модальных окон для создания сущностей и работы с событиями диалога
 * Отвечает за: добавление участников, создание топиков, просмотр событий диалога
 */
import { ref, type Ref } from 'vue';
import { useCredentialsStore } from '@/app/stores/credentials';
import { useModal } from '@/shared/lib/composables/useModal';

export function useEntityModals(
  currentDialogId: Ref<string | null>,
  currentViewMode: Ref<'messages' | 'members' | 'topics'>,
  loadDialogMembers: (dialogId: string, page?: number) => Promise<void>,
  loadDialogTopics: (dialogId: string, page?: number) => Promise<void>,
  membersPagination: any,
  topicsPagination: any
) {
  const credentialsStore = useCredentialsStore();
  const tenantId = ref(credentialsStore.tenantId);

  // Модальные окна
  const addMemberModal = useModal();
  const addTopicModal = useModal();
  const dialogEventsModal = useModal();

  // Добавление участника
  const newMemberSelect = ref('');
  const newMemberType = ref('');
  const newMemberMetaTags = ref<Array<{ key: string; value: string }>>([{ key: '', value: '' }]);
  const availableUsersForMember = ref<any[]>([]);

  // Создание топика
  const newTopicMetaTags = ref<Array<{ key: string; value: string }>>([{ key: '', value: '' }]);

  // События диалога
  const currentDialogIdForEvents = ref<string | null>(null);
  const dialogEvents = ref<any[]>([]);
  const loadingDialogEvents = ref(false);
  const dialogEventsError = ref<string | null>(null);
  const dialogEventUpdates = ref<any[]>([]);
  const selectedDialogEventId = ref<string | null>(null);

  // Функции для модального окна добавления участника
  async function showAddMemberModal() {
    if (!currentDialogId.value) {
      alert('Ошибка: не выбран диалог');
      return;
    }
    
    newMemberSelect.value = '';
    newMemberType.value = '';
    newMemberMetaTags.value = [{ key: '', value: '' }];
    availableUsersForMember.value = [];
    
    try {
      const response = await fetch(`/api/users?limit=100`, {
        headers: credentialsStore.getHeaders(),
      });
      
      if (response.ok) {
        const data = await response.json();
        availableUsersForMember.value = Array.isArray(data.data) ? data.data : [];
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
    
    addMemberModal.open();
  }

  function closeAddMemberModal() {
    addMemberModal.close();
    newMemberSelect.value = '';
    newMemberType.value = '';
    newMemberMetaTags.value = [{ key: '', value: '' }];
  }

  function addMemberMetaRow() {
    newMemberMetaTags.value.push({ key: '', value: '' });
  }

  function removeMemberMetaRow(index: number) {
    if (newMemberMetaTags.value.length > 1) {
      newMemberMetaTags.value.splice(index, 1);
    } else {
      newMemberMetaTags.value[0] = { key: '', value: '' };
    }
  }

  function collectMemberMetaTags(): Record<string, string> {
    const meta: Record<string, string> = {};
    newMemberMetaTags.value.forEach((tag) => {
      if (tag.key.trim() && tag.value.trim()) {
        meta[tag.key.trim()] = tag.value.trim();
      }
    });
    return meta;
  }

  async function submitAddMember() {
    if (!currentDialogId.value) {
      alert('Ошибка: не выбран диалог');
      return;
    }
    
    const userId = newMemberSelect.value;
    const type = newMemberType.value;
    const meta = collectMemberMetaTags();
    
    if (!userId) {
      alert('Пожалуйста, выберите пользователя');
      return;
    }
    
    try {
      const requestBody: any = { userId };
      if (type) {
        requestBody.type = type;
      }

      const response = await fetch(`/api/dialogs/${currentDialogId.value}/members/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...credentialsStore.getHeaders(),
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            errorMessage = errorData.message || errorMessage;
          } else {
            const errorText = await response.text();
            if (errorText && !errorText.startsWith('<!DOCTYPE')) {
              errorMessage = errorText;
            }
          }
        } catch (parseError) {
          console.error('Error parsing error response:', parseError);
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('Member added successfully:', result);
      
      if (Object.keys(meta).length > 0) {
        try {
          const entityId = `${currentDialogId.value}:${userId}`;
          for (const [key, value] of Object.entries(meta)) {
            const metaResponse = await fetch(`/api/meta/dialogMember/${entityId}/${key}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                ...credentialsStore.getHeaders(),
              },
              body: JSON.stringify({ value, dataType: 'string' }),
            });
            
            if (!metaResponse.ok) {
              console.warn(`Failed to set meta tag ${key}:`, await metaResponse.text());
            }
          }
        } catch (metaError) {
          console.error('Error setting meta tags:', metaError);
        }
      }
      
      alert('Участник успешно добавлен!');
      closeAddMemberModal();
      
      if (currentViewMode.value === 'members') {
        await loadDialogMembers(currentDialogId.value, membersPagination.currentPage.value);
      }
    } catch (error) {
      console.error('Error adding member:', error);
      alert(`Ошибка при добавлении участника: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Функции для модального окна создания топика
  async function showAddTopicModal() {
    if (!currentDialogId.value) {
      alert('Ошибка: не выбран диалог');
      return;
    }
    
    newTopicMetaTags.value = [{ key: '', value: '' }];
    addTopicModal.open();
  }

  function closeAddTopicModal() {
    addTopicModal.close();
    newTopicMetaTags.value = [{ key: '', value: '' }];
  }

  function addTopicMetaRow() {
    newTopicMetaTags.value.push({ key: '', value: '' });
  }

  function removeTopicMetaRow(index: number) {
    if (newTopicMetaTags.value.length > 1) {
      newTopicMetaTags.value.splice(index, 1);
    } else {
      newTopicMetaTags.value[0] = { key: '', value: '' };
    }
  }

  function collectTopicMetaTags(): Record<string, string> {
    const meta: Record<string, string> = {};
    newTopicMetaTags.value.forEach((tag) => {
      if (tag.key.trim() && tag.value.trim()) {
        meta[tag.key.trim()] = tag.value.trim();
      }
    });
    return meta;
  }

  async function submitAddTopic() {
    if (!currentDialogId.value) {
      alert('Ошибка: не выбран диалог');
      return;
    }
    
    const meta = collectTopicMetaTags();
    
    try {
      const requestBody: any = {};
      if (Object.keys(meta).length > 0) {
        requestBody.meta = meta;
      }
      
      const response = await fetch(`/api/dialogs/${currentDialogId.value}/topics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...credentialsStore.getHeaders(),
        },
        body: JSON.stringify(requestBody),
      });
      
      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            errorMessage = errorData.message || errorData.error || errorMessage;
          } else {
            const errorText = await response.text();
            if (errorText) errorMessage = errorText;
          }
        } catch (parseError) {
          console.error('Error parsing error response:', parseError);
        }
        alert(`Ошибка при создании топика: ${errorMessage}`);
        return;
      }
      
      const result = await response.json();
      console.log('Topic created:', result);
      
      closeAddTopicModal();
      
      if (currentViewMode.value === 'topics' && currentDialogId.value) {
        await loadDialogTopics(currentDialogId.value, topicsPagination.currentPage.value);
      }
      
      alert('Топик успешно создан!');
    } catch (error) {
      console.error('Error creating topic:', error);
      alert(`Ошибка при создании топика: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Функции для модального окна событий диалога
  async function showDialogEventsModal(dialogId: string) {
    currentDialogIdForEvents.value = dialogId;
    dialogEventsModal.open();
    dialogEventUpdates.value = [];
    await loadDialogEvents(dialogId);
  }

  function closeDialogEventsModal() {
    dialogEventsModal.close();
    currentDialogIdForEvents.value = null;
    dialogEvents.value = [];
    dialogEventUpdates.value = [];
    selectedDialogEventId.value = null;
  }

  async function loadDialogEvents(dialogId: string) {
    try {
      loadingDialogEvents.value = true;
      dialogEventsError.value = null;
      
      let url = `/api/dialogs/${dialogId}/events?tenantId=${encodeURIComponent(tenantId.value)}`;
      
      console.log('Запрос событий диалога к:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-Tenant-Id': tenantId.value,
        },
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          dialogEvents.value = [];
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      dialogEvents.value = Array.isArray(data.data) ? data.data : [];
    } catch (error) {
      console.error('Error loading dialog events:', error);
      dialogEventsError.value = error instanceof Error ? error.message : 'Ошибка загрузки';
      dialogEvents.value = [];
    } finally {
      loadingDialogEvents.value = false;
    }
  }

  function getDialogEventId(event: any): string | null {
    if (event._id) {
      if (typeof event._id === 'object') {
        if (event._id.toString && typeof event._id.toString === 'function') {
          return event._id.toString().trim();
        } else if (event._id.$oid) {
          return String(event._id.$oid).trim();
        }
        return String(event._id).trim();
      }
      return String(event._id).trim();
    } else if (event.id) {
      return String(event.id).trim();
    }
    return null;
  }

  function getUpdateId(update: any): string {
    if (update._id) {
      if (typeof update._id === 'object') {
        if (update._id.toString && typeof update._id.toString === 'function') {
          return update._id.toString();
        } else if (update._id.$oid) {
          return String(update._id.$oid);
        }
        return String(update._id);
      }
      return String(update._id);
    } else if (update.id) {
      return String(update.id);
    }
    return `${update.createdAt}-${update.eventType}-${update.userId}`;
  }

  function getDialogEventDescription(eventType: string, data: any): string {
    const descriptions: Record<string, string> = {
      'dialog.create': 'Создан диалог',
      'dialog.update': 'Обновлен диалог',
      'dialog.delete': 'Удален диалог',
      'dialog.member.add': 'Добавлен участник диалога',
      'dialog.member.remove': 'Удален участник диалога',
      'dialog.member.update': 'Обновлен участник диалога',
      'message.create': 'Создано сообщение',
      'message.update': 'Обновлено сообщение',
      'message.delete': 'Удалено сообщение',
      'message.status.update': 'Обновлен статус сообщения',
      'message.reaction.update': 'Обновлена реакция на сообщение',
      'dialog.typing': 'Пользователь печатает в диалоге',
    };
    
    let description = descriptions[eventType] || eventType;
    
    if (data) {
      if (data.message?.content) {
        description += `: "${data.message.content.substring(0, 50)}${data.message.content.length > 50 ? '...' : ''}"`;
      } else if (data.member?.userId) {
        description += `: пользователь ${data.member.userId}`;
      } else if (data.dialog?.dialogId) {
        description += `: "${data.dialog.dialogId}"`;
      }
    }
    
    return description;
  }

  async function loadAllDialogUpdatesInModal(dialogId: string, eventId: string) {
    try {
      selectedDialogEventId.value = eventId;
      
      let url = `/api/dialogs/${dialogId}/updates?tenantId=${encodeURIComponent(tenantId.value)}`;
      
      console.log('Запрос обновлений диалога к:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-Tenant-Id': tenantId.value,
        },
      });
      
      if (!response.ok) {
        let errorMessage = '';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || '';
        } catch (_e) {
          errorMessage = `HTTP ${response.status}`;
        }
        dialogEventUpdates.value = [];
        console.error('Ошибка загрузки обновлений диалога:', errorMessage);
        return;
      }
      
      const data = await response.json();
      const updates = Array.isArray(data.data) ? data.data : [];
      
      if (updates.length === 0) {
        dialogEventUpdates.value = [];
        return;
      }
      
      dialogEventUpdates.value = updates;
    } catch (error) {
      console.error('Error loading dialog event updates:', error);
      dialogEventUpdates.value = [];
    }
  }

  return {
    // Modals
    addMemberModal,
    addTopicModal,
    dialogEventsModal,
    // Add member
    newMemberSelect,
    newMemberType,
    newMemberMetaTags,
    availableUsersForMember,
    showAddMemberModal,
    closeAddMemberModal,
    addMemberMetaRow,
    removeMemberMetaRow,
    submitAddMember,
    // Add topic
    newTopicMetaTags,
    showAddTopicModal,
    closeAddTopicModal,
    addTopicMetaRow,
    removeTopicMetaRow,
    submitAddTopic,
    // Dialog events
    currentDialogIdForEvents,
    dialogEvents,
    loadingDialogEvents,
    dialogEventsError,
    selectedDialogEventId,
    dialogEventUpdates,
    showDialogEventsModal,
    closeDialogEventsModal,
    loadDialogEvents,
    getDialogEventId,
    getUpdateId,
    getDialogEventDescription,
    loadAllDialogUpdatesInModal,
  };
}
