/**
 * Модуль модальных окон для работы с сообщениями
 * Отвечает за: добавление сообщений, реакции, события сообщений, матрицу статусов, установку статусов
 */
import { ref, nextTick, type Ref } from 'vue';
import { useConfigStore } from '@/app/stores/config';
import { useCredentialsStore } from '@/app/stores/credentials';
import { useModal } from '@/shared/lib/composables/useModal';
import { formatTimestamp } from '@/shared/lib/utils/date';

export function useMessageModals(
  currentUserId: Ref<string | null>,
  currentDialogId: Ref<string | null>,
  loadDialogMessages: (dialogId: string, page?: number) => Promise<void>,
  messagesPagination: any
) {
  const configStore = useConfigStore();
  const credentialsStore = useCredentialsStore();
  const tenantId = ref(credentialsStore.tenantId);

  // Модальные окна
  const addMessageModal = useModal();
  const reactionModal = useModal();
  const eventsModal = useModal();
  const statusMatrixModal = useModal();
  const statusesModal = useModal();
  const setStatusModal = useModal();
  const messageTopicModal = useModal();

  // Добавление сообщения
  const messageSender = ref('carl');
  const messageType = ref('internal.text');
  const messageContent = ref('тест тест');
  const messageTopicId = ref('');
  const quotedMessageId = ref('');
  const messageMetaTags = ref<Array<{ key: string; value: string }>>([{ key: '', value: '' }]);
  const availableTopics = ref<any[]>([]);
  const payloadJson = ref('{}');

  // Реакции
  const currentMessageIdForReaction = ref<string | null>(null);
  const existingReactions = ref<any[]>([]);
  const selectedReaction = ref<string | null>(null);

  // События
  const currentMessageIdForEvents = ref<string | null>(null);
  const events = ref<any[]>([]);
  const loadingEvents = ref(false);
  const eventsError = ref<string | null>(null);
  const selectedEventId = ref<string | null>(null);
  const eventUpdates = ref<any[]>([]);

  // Статусы
  const loadingStatusMatrix = ref(false);
  const statusMatrixError = ref<string | null>(null);
  const loadingStatuses = ref(false);
  const statusesError = ref<string | null>(null);
  const totalStatuses = ref(0);
  const currentMessageIdForSetStatus = ref<string | null>(null);
  const setStatusResult = ref('');
  const setStatusUrl = ref('');
  const currentMessageIdForStatuses = ref<string | null>(null);
  const statusesUrl = ref('');
  const statusMatrixUrl = ref('');
  const statusMatrix = ref<any[]>([]);
  const statuses = ref<any[]>([]);
  const currentStatusesPage = ref(1);
  const currentStatusesLimit = ref(50);
  const totalStatusesPages = ref(1);

  // Топик сообщения (установка/сброс)
  const currentMessageForTopic = ref<{ messageId: string; topicId: string | null } | null>(null);
  const dialogTopicsForMessageTopic = ref<any[]>([]);
  const loadingMessageTopic = ref(false);
  const errorMessageTopic = ref<string | null>(null);

  // Функции для модального окна добавления сообщения
  async function showAddMessageModal() {
    if (!currentDialogId.value) {
      alert('Сначала выберите диалог');
      return;
    }
    
    if (!currentUserId.value) {
      alert('Сначала выберите пользователя');
      return;
    }
    
    messageSender.value = 'carl';
    messageType.value = 'internal.text';
    messageContent.value = 'тест тест';
    messageTopicId.value = '';
    quotedMessageId.value = '';
    messageMetaTags.value = [{ key: '', value: '' }];
    availableTopics.value = [];
    
    try {
      const topicsResponse = await fetch(
        `/api/users/${currentUserId.value}/dialogs/${currentDialogId.value}/topics?page=1&limit=100`,
        {
          headers: credentialsStore.getHeaders(),
        }
      );
      
      if (topicsResponse.ok) {
        const topicsData = await topicsResponse.json();
        if (topicsData.data && topicsData.data.length > 0) {
          availableTopics.value = topicsData.data;
        }
      }
    } catch (error) {
      console.error('Ошибка при загрузке топиков:', error);
    }
    
    addMessageModal.open();
    updatePayloadJson();
  }

  function closeAddMessageModal() {
    addMessageModal.close();
  }

  function addMetaTagRow() {
    messageMetaTags.value.push({ key: '', value: '' });
    updatePayloadJson();
  }

  function removeMetaTagRow(index: number) {
    if (messageMetaTags.value.length > 1) {
      messageMetaTags.value.splice(index, 1);
      updatePayloadJson();
    }
  }

  function collectMetaTags(): Record<string, string> | null {
    const metaTags: Record<string, string> = {};
    messageMetaTags.value.forEach((tag) => {
      if (tag.key.trim() && tag.value.trim()) {
        metaTags[tag.key.trim()] = tag.value.trim();
      }
    });
    return Object.keys(metaTags).length > 0 ? metaTags : null;
  }

  function updatePayloadJson() {
    const meta = collectMetaTags();
    
    const payload: any = {
      senderId: messageSender.value,
      type: messageType.value,
      content: messageContent.value,
    };
    
    if (quotedMessageId.value.trim()) {
      payload.quotedMessageId = quotedMessageId.value.trim();
    }
    
    if (messageTopicId.value.trim()) {
      payload.topicId = messageTopicId.value.trim();
    }
    
    if (meta) {
      payload.meta = meta;
    }
    
    payloadJson.value = JSON.stringify(payload, null, 2);
  }

  async function submitAddMessage() {
    if (!currentDialogId.value || !currentUserId.value) {
      alert('Ошибка: не выбран диалог или пользователь');
      return;
    }

    const meta = collectMetaTags();

    try {
      const payload: any = {
        senderId: messageSender.value,
        type: messageType.value,
        content: messageContent.value,
      };
      
      if (quotedMessageId.value.trim()) {
        payload.quotedMessageId = quotedMessageId.value.trim();
      }
      
      if (messageTopicId.value.trim()) {
        payload.topicId = messageTopicId.value.trim();
      }
      
      if (meta) {
        payload.meta = meta;
      }

      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const fullUrl = `${baseUrl}/api/dialogs/${currentDialogId.value}/messages`;
      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...credentialsStore.getHeaders(),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Message added successfully:', result);
      
      alert('Сообщение успешно добавлено!');
      
      closeAddMessageModal();
      
      if (currentDialogId.value) {
        loadDialogMessages(currentDialogId.value, messagesPagination.currentPage.value);
      }
    } catch (error) {
      console.error('Error adding message:', error);
      alert(`Ошибка при добавлении сообщения: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Функции для модального окна реакций
  async function showReactionModal(messageId: string) {
    if (!currentUserId.value) {
      alert('Сначала выберите пользователя');
      return;
    }
    
    if (!currentDialogId.value) {
      alert('Сначала выберите диалог');
      return;
    }
    
    currentMessageIdForReaction.value = messageId;
    reactionModal.open();
    await loadExistingReactions(messageId);
  }

  function closeReactionModal() {
    reactionModal.close();
    currentMessageIdForReaction.value = null;
    existingReactions.value = [];
  }

  async function loadExistingReactions(messageId: string) {
    try {
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const fullUrl = `${baseUrl}/api/users/${currentUserId.value}/dialogs/${currentDialogId.value}/messages/${messageId}`;
      const response = await fetch(fullUrl, {
        headers: credentialsStore.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const message = data.data || {};
      const reactionSet = message.reactionSet || [];
      
      existingReactions.value = reactionSet;
    } catch (error) {
      console.error('Error loading reactions:', error);
      existingReactions.value = [];
    }
  }

  async function toggleReaction(reaction: string) {
    if (!currentMessageIdForReaction.value || !currentUserId.value || !currentDialogId.value) {
      alert('Ошибка: не выбран сообщение, пользователь или диалог');
      return;
    }

    const existingReaction = existingReactions.value.find((r: any) => r.reaction === reaction);
    const isActive = existingReaction && existingReaction.me;

    try {
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const action = isActive ? 'unset' : 'set';
      const fullUrl = `${baseUrl}/api/users/${currentUserId.value}/dialogs/${currentDialogId.value}/messages/${currentMessageIdForReaction.value}/reactions/${action}`;
      
      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...credentialsStore.getHeaders(),
        },
        body: JSON.stringify({
          reaction: reaction,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      await loadExistingReactions(currentMessageIdForReaction.value);
      
      if (currentDialogId.value) {
        loadDialogMessages(currentDialogId.value, messagesPagination.currentPage.value);
      }
    } catch (error) {
      console.error('Error toggling reaction:', error);
      alert(`Ошибка при ${isActive ? 'снятии' : 'установке'} реакции: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Функции для модального окна событий сообщения
  async function showEventsModal(messageId: string) {
    if (!currentUserId.value) {
      alert('Сначала выберите пользователя');
      return;
    }
    
    if (!currentDialogId.value) {
      alert('Сначала выберите диалог');
      return;
    }
    
    currentMessageIdForEvents.value = messageId;
    eventsModal.open();
    eventUpdates.value = [];
    await loadMessageEvents(messageId);
  }

  function closeEventsModal() {
    eventsModal.close();
    currentMessageIdForEvents.value = null;
    events.value = [];
    eventUpdates.value = [];
    selectedEventId.value = null;
  }

  async function loadMessageEvents(messageId: string) {
    try {
      loadingEvents.value = true;
      eventsError.value = null;
      
      const baseUrl = configStore.config.CONTROL_APP_URL || 'http://localhost:3001';
      const fullUrl = `${baseUrl}/api/messages/${messageId}/events?tenantId=${encodeURIComponent(tenantId.value)}`;
      
      const response = await fetch(fullUrl, {
        method: 'GET',
        headers: {
          'X-Tenant-Id': tenantId.value,
        },
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          events.value = [];
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      const eventsList = Array.isArray(data.data) ? data.data : (Array.isArray(data.events) ? data.events : []);
      events.value = eventsList;
    } catch (error) {
      console.error('Error loading events:', error);
      eventsError.value = error instanceof Error ? error.message : 'Ошибка загрузки';
      events.value = [];
    } finally {
      loadingEvents.value = false;
    }
  }

  function getEventId(event: any): string {
    if (event._id) {
      if (typeof event._id === 'object') {
        if (event._id.toString && typeof event._id.toString === 'function') {
          return event._id.toString();
        } else if (event._id.$oid) {
          return event._id.$oid;
        }
        return String(event._id);
      }
      return String(event._id);
    }
    return String(event.id || '');
  }

  // Используем общую функцию форматирования из shared
  const formatEventTime = formatTimestamp;

  function getEventDescription(eventType: string, data: any): string {
    const descriptions: Record<string, string> = {
      'dialog.create': 'Создан диалог',
      'dialog.update': 'Обновлен диалог',
      'dialog.delete': 'Удален диалог',
      'message.create': 'Создано сообщение',
      'message.update': 'Обновлено сообщение',
      'dialog.member.add': 'Добавлен участник диалога',
      'dialog.member.remove': 'Удален участник диалога',
      'dialog.member.update': 'Обновлен участник диалога',
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
      } else if (data.statusUpdate?.status) {
        description += `: статус "${data.statusUpdate.status}"`;
      } else if (data.reactionUpdate?.reaction) {
        description += `: реакция "${data.reactionUpdate.reaction}"`;
      }
    }
    
    return description;
  }

  async function loadEventUpdates(eventId: string) {
    if (!currentMessageIdForEvents.value) return;
    
    try {
      const url = `/api/messages/${currentMessageIdForEvents.value}/updates?tenantId=${encodeURIComponent(tenantId.value)}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-Tenant-Id': tenantId.value,
        },
      });
      
      if (!response.ok) {
        eventUpdates.value = [];
        return;
      }
      
      const data = await response.json();
      const allUpdates = Array.isArray(data.data) ? data.data : [];
      
      const eventIdStr = String(eventId).trim();
      const filteredUpdates = allUpdates.filter((update: any) => {
        if (!update.eventId) return false;
        let updateEventId: string;
        if (typeof update.eventId === 'object') {
          if (update.eventId.toString && typeof update.eventId.toString === 'function') {
            updateEventId = update.eventId.toString();
          } else if (update.eventId.$oid) {
            updateEventId = update.eventId.$oid;
          } else {
            updateEventId = String(update.eventId);
          }
        } else {
          updateEventId = String(update.eventId);
        }
        return updateEventId.trim() === eventIdStr;
      });
      
      eventUpdates.value = filteredUpdates;
      selectedEventId.value = eventId;
    } catch (error) {
      console.error('Error loading event updates:', error);
      eventUpdates.value = [];
    }
  }

  // Функции для модального окна матрицы статусов
  async function showStatusMatrixModal(messageId: string) {
    if (!currentUserId.value) {
      alert('Сначала выберите пользователя');
      return;
    }
    
    if (!currentDialogId.value) {
      alert('Сначала выберите диалог');
      return;
    }
    
    statusMatrixModal.open();
    
    await nextTick();
    
    const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
    statusMatrixUrl.value = `${baseUrl}/api/users/${currentUserId.value}/dialogs/${currentDialogId.value}/messages/${messageId}`;
    
    loadingStatusMatrix.value = true;
    statusMatrixError.value = null;
    
    try {
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const fullUrl = `${baseUrl}/api/users/${currentUserId.value}/dialogs/${currentDialogId.value}/messages/${messageId}`;
      const response = await fetch(fullUrl, {
        headers: credentialsStore.getHeaders(),
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          statusMatrix.value = [];
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      const message = data.data || {};
      statusMatrix.value = message.statusMessageMatrix || [];
    } catch (error) {
      console.error('Error loading status matrix:', error);
      statusMatrixError.value = error instanceof Error ? error.message : 'Ошибка загрузки';
      statusMatrix.value = [];
    } finally {
      loadingStatusMatrix.value = false;
    }
  }

  function closeStatusMatrixModal() {
    statusMatrixModal.close();
    statusMatrix.value = [];
  }

  // Функции для модального окна статусов
  async function showStatusesModal(messageId: string) {
    if (!currentUserId.value) {
      alert('Сначала выберите пользователя');
      return;
    }
    
    if (!currentDialogId.value) {
      alert('Сначала выберите диалог');
      return;
    }
    
    currentMessageIdForStatuses.value = messageId;
    currentStatusesPage.value = 1;
    currentStatusesLimit.value = 50;
    
    statusesModal.open();
    
    await nextTick();
    
    const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
    statusesUrl.value = `${baseUrl}/api/users/${currentUserId.value}/dialogs/${currentDialogId.value}/messages/${messageId}/statuses?page=${currentStatusesPage.value}&limit=${currentStatusesLimit.value}`;
    
    await loadStatuses(messageId, currentStatusesPage.value, currentStatusesLimit.value);
  }

  function closeStatusesModal() {
    statusesModal.close();
    currentMessageIdForStatuses.value = null;
    statuses.value = [];
    currentStatusesPage.value = 1;
  }

  async function loadStatuses(messageId: string, page: number, limit: number) {
    if (!currentUserId.value || !currentDialogId.value) {
      return;
    }
    
    loadingStatuses.value = true;
    statusesError.value = null;
    
    await nextTick();
    
    const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
    const fullUrl = `${baseUrl}/api/users/${currentUserId.value}/dialogs/${currentDialogId.value}/messages/${messageId}/statuses?page=${page}&limit=${limit}`;
    statusesUrl.value = fullUrl;
    
    try {
      const response = await fetch(fullUrl, {
        headers: credentialsStore.getHeaders(),
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          statuses.value = [];
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      statuses.value = data.data || [];
      const pagination = data.pagination || {};
      totalStatuses.value = pagination.total || 0;
      totalStatusesPages.value = pagination.pages || 1;
      currentStatusesPage.value = page;
    } catch (error) {
      console.error('Error loading statuses:', error);
      statusesError.value = error instanceof Error ? error.message : 'Ошибка загрузки';
      statuses.value = [];
    } finally {
      loadingStatuses.value = false;
    }
  }

  function goToStatusesPage(page: number) {
    if (currentMessageIdForStatuses.value) {
      loadStatuses(currentMessageIdForStatuses.value, page, currentStatusesLimit.value);
    }
  }

  // Функции для модального окна установки статуса
  async function showSetStatusModal(messageId: string) {
    if (!currentUserId.value) {
      alert('Сначала выберите пользователя');
      return;
    }
    
    if (!currentDialogId.value) {
      alert('Сначала выберите диалог');
      return;
    }
    
    currentMessageIdForSetStatus.value = messageId;
    
    const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
    setStatusUrl.value = `${baseUrl}/api/users/${currentUserId.value}/dialogs/${currentDialogId.value}/messages/${messageId}/status/{status}`;
    
    setStatusModal.open();
    
    await nextTick();
    
    setStatusResult.value = '';
  }

  function closeSetStatusModal() {
    setStatusModal.close();
    currentMessageIdForSetStatus.value = null;
    setStatusResult.value = '';
    setStatusUrl.value = '';
  }

  async function setMessageStatus(status: string) {
    if (!currentMessageIdForSetStatus.value || !currentUserId.value || !currentDialogId.value) {
      alert('Ошибка: не выбран сообщение, пользователь или диалог');
      return;
    }
    
    setStatusResult.value = 'Установка статуса...';
    
    try {
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const fullUrl = `${baseUrl}/api/users/${currentUserId.value}/dialogs/${currentDialogId.value}/messages/${currentMessageIdForSetStatus.value}/status/${status}`;
      
      console.log('Setting message status:', { baseUrl, fullUrl, status });
      
      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: credentialsStore.getHeaders(),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Status set successfully:', data);
      
      setStatusResult.value = `✓ Статус успешно установлен!\nСтатус: **${status}**\nСообщение обновлено`;
      
      if (currentDialogId.value) {
        setTimeout(() => {
          loadDialogMessages(currentDialogId.value!, messagesPagination.currentPage.value);
        }, 500);
      }
      
      setTimeout(() => {
        closeSetStatusModal();
      }, 2000);
    } catch (error) {
      console.error('Error setting status:', error);
      setStatusResult.value = `✗ Ошибка: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  // Топик сообщения: установка/сброс
  async function showMessageTopicModal(message: { messageId: string; topicId?: string | null }) {
    if (!currentDialogId.value || !currentUserId.value) {
      alert('Сначала выберите пользователя и диалог');
      return;
    }
    currentMessageForTopic.value = {
      messageId: message.messageId,
      topicId: message.topicId ?? null,
    };
    errorMessageTopic.value = null;
    dialogTopicsForMessageTopic.value = [];
    messageTopicModal.open();
    try {
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const fullUrl = `${baseUrl}/api/users/${currentUserId.value}/dialogs/${currentDialogId.value}/topics?page=1&limit=100`;
      const response = await fetch(fullUrl, { headers: credentialsStore.getHeaders() });
      if (response.ok) {
        const data = await response.json();
        dialogTopicsForMessageTopic.value = data.data ?? [];
      }
    } catch (err) {
      console.error('Error loading dialog topics:', err);
      errorMessageTopic.value = err instanceof Error ? err.message : 'Ошибка загрузки топиков';
    }
  }

  function closeMessageTopicModal() {
    messageTopicModal.close();
    currentMessageForTopic.value = null;
    dialogTopicsForMessageTopic.value = [];
    errorMessageTopic.value = null;
  }

  async function setMessageTopic(topicId: string) {
    if (!currentMessageForTopic.value) return;
    loadingMessageTopic.value = true;
    errorMessageTopic.value = null;
    try {
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const fullUrl = `${baseUrl}/api/messages/${currentMessageForTopic.value.messageId}/topic`;
      const response = await fetch(fullUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...credentialsStore.getHeaders() },
        body: JSON.stringify({ topicId }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || `HTTP ${response.status}`);
      }
      if (currentDialogId.value) {
        loadDialogMessages(currentDialogId.value, messagesPagination.currentPage.value);
      }
      closeMessageTopicModal();
    } catch (err) {
      errorMessageTopic.value = err instanceof Error ? err.message : 'Ошибка установки топика';
    } finally {
      loadingMessageTopic.value = false;
    }
  }

  async function clearMessageTopic() {
    if (!currentMessageForTopic.value) return;
    loadingMessageTopic.value = true;
    errorMessageTopic.value = null;
    try {
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const fullUrl = `${baseUrl}/api/messages/${currentMessageForTopic.value.messageId}/topic`;
      const response = await fetch(fullUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...credentialsStore.getHeaders() },
        body: JSON.stringify({ topicId: null }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || `HTTP ${response.status}`);
      }
      if (currentDialogId.value) {
        loadDialogMessages(currentDialogId.value, messagesPagination.currentPage.value);
      }
      closeMessageTopicModal();
    } catch (err) {
      errorMessageTopic.value = err instanceof Error ? err.message : 'Ошибка сброса топика';
    } finally {
      loadingMessageTopic.value = false;
    }
  }

  return {
    // Modals
    addMessageModal,
    reactionModal,
    eventsModal,
    statusMatrixModal,
    statusesModal,
    setStatusModal,
    // Add message
    messageSender,
    messageType,
    messageContent,
    messageTopicId,
    quotedMessageId,
    messageMetaTags,
    availableTopics,
    payloadJson,
    showAddMessageModal,
    closeAddMessageModal,
    addMetaTagRow,
    removeMetaTagRow,
    updatePayloadJson,
    submitAddMessage,
    // Reactions
    currentMessageIdForReaction,
    existingReactions,
    selectedReaction,
    showReactionModal,
    closeReactionModal,
    loadExistingReactions,
    toggleReaction,
    // Events
    currentMessageIdForEvents,
    events,
    loadingEvents,
    eventsError,
    selectedEventId,
    eventUpdates,
    showEventsModal,
    closeEventsModal,
    loadMessageEvents,
    getEventId,
    formatEventTime,
    getEventDescription,
    loadEventUpdates,
    // Statuses
    loadingStatusMatrix,
    statusMatrixError,
    loadingStatuses,
    statusesError,
    totalStatuses,
    currentMessageIdForSetStatus,
    setStatusResult,
    setStatusUrl,
    currentMessageIdForStatuses,
    statusesUrl,
    statusMatrixUrl,
    statusMatrix,
    statuses,
    currentStatusesPage,
    currentStatusesLimit,
    totalStatusesPages,
    showStatusMatrixModal,
    closeStatusMatrixModal,
    showStatusesModal,
    closeStatusesModal,
    loadStatuses,
    goToStatusesPage,
    showSetStatusModal,
    closeSetStatusModal,
    setMessageStatus,
    // Message topic (set/clear)
    messageTopicModal,
    currentMessageForTopic,
    dialogTopicsForMessageTopic,
    loadingMessageTopic,
    errorMessageTopic,
    showMessageTopicModal,
    closeMessageTopicModal,
    setMessageTopic,
    clearMessageTopic,
  };
}
