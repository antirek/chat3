import { ref, watch } from 'vue';
import { useUsers } from './useUsers';
import { useDialogs } from './useDialogs';
import { useMessages } from './useMessages';
import { useMessageInput } from './useMessageInput';
import { useAutoRefresh, type AutoRefreshInterval } from './useAutoRefresh';

export function useChat() {
  const selectedUserId = ref<string | null>(null);
  const selectedDialogId = ref<string | null>(null);
  const autoRefreshInterval = ref<AutoRefreshInterval>(10);

  const { loadingUsers, usersError, users, loadUsers } = useUsers();
  const { loadingDialogs, dialogsError, dialogs, loadDialogs } = useDialogs(selectedUserId);
  const { loadingMessages, messagesError, messages, loadMessages, sendMessage } = useMessages(
    selectedUserId,
    selectedDialogId
  );
  const { messageText, sending, sendError, clearInput, setError, validate } = useMessageInput();

  // Загружаем диалоги при выборе пользователя
  watch(selectedUserId, (newUserId) => {
    if (newUserId) {
      selectedDialogId.value = null; // Сбрасываем выбор диалога
      loadDialogs();
    } else {
      dialogs.value = [];
      selectedDialogId.value = null;
    }
  });

  // Загружаем сообщения при выборе диалога
  watch(selectedDialogId, (newDialogId) => {
    if (newDialogId && selectedUserId.value) {
      loadMessages();
    } else {
      messages.value = [];
    }
  });

  // Автообновление сообщений
  const autoRefreshEnabled = ref(false);
  
  const { startRefresh: _startRefresh, stopRefresh: _stopRefresh } = useAutoRefresh(
    autoRefreshInterval,
    loadMessages,
    autoRefreshEnabled
  );

  // Обновляем enabled для автообновления при изменении выбранных значений
  watch([selectedUserId, selectedDialogId], () => {
    autoRefreshEnabled.value = !!(selectedUserId.value && selectedDialogId.value);
  }, { immediate: true });

  async function handleSendMessage() {
    if (!validate()) {
      return;
    }

    if (!selectedDialogId.value || !selectedUserId.value) {
      setError('Не выбран диалог или пользователь');
      return;
    }

    try {
      sending.value = true;
      sendError.value = null;

      await sendMessage(messageText.value);
      clearInput();
    } catch (error: any) {
      setError(error.message || 'Ошибка отправки сообщения');
    } finally {
      sending.value = false;
    }
  }

  function handleKeyPress(event: KeyboardEvent) {
    // Enter без Shift - отправить
    // Shift+Enter - новая строка
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  }

  return {
    // State
    selectedUserId,
    selectedDialogId,
    autoRefreshInterval,
    
    // Users
    loadingUsers,
    usersError,
    users,
    loadUsers,
    
    // Dialogs
    loadingDialogs,
    dialogsError,
    dialogs,
    loadDialogs,
    
    // Messages
    loadingMessages,
    messagesError,
    messages,
    
    // Message input
    messageText,
    sending,
    sendError,
    
    // Actions
    handleSendMessage,
    handleKeyPress,
  };
}
