import { ref, type Ref } from 'vue';
import { useCredentialsStore } from '@/app/stores/credentials';
import { getTenantApiUrl } from '@/shared/lib/utils/url';

export function useMessages(
  selectedUserId: Ref<string | null>,
  selectedDialogId: Ref<string | null>
) {
  const credentialsStore = useCredentialsStore();

  const loadingMessages = ref(false);
  const messagesError = ref<string | null>(null);
  const messages = ref<any[]>([]);

  async function loadMessages() {
    if (!selectedUserId.value || !selectedDialogId.value) {
      messages.value = [];
      return;
    }

    try {
      loadingMessages.value = true;
      messagesError.value = null;

      // Загружаем последние 10 сообщений, отсортированных по убыванию (новые первыми)
      const url = getTenantApiUrl(
        `/api/users/${selectedUserId.value}/dialogs/${selectedDialogId.value}/messages?limit=10&sort=-createdAt`
      );
      const response = await fetch(url, {
        headers: credentialsStore.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      // API возвращает сообщения отсортированными по -createdAt (новые первыми)
      // Для отображения в мессенджере нужно перевернуть (старые сверху, новые снизу)
      const messagesData = (data.data || []).reverse();
      messages.value = messagesData;
    } catch (error: any) {
      console.error('Error loading messages:', error);
      messagesError.value = error.message || 'Ошибка загрузки сообщений';
      messages.value = [];
    } finally {
      loadingMessages.value = false;
    }
  }

  async function sendMessage(content: string) {
    if (!selectedDialogId.value || !selectedUserId.value) {
      throw new Error('Не выбран диалог или пользователь');
    }

    if (!content.trim()) {
      throw new Error('Сообщение не может быть пустым');
    }

    try {
      const url = getTenantApiUrl(`/api/dialogs/${selectedDialogId.value}/messages`);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...credentialsStore.getHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: content.trim(),
          senderId: selectedUserId.value,
          type: 'internal.text',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      // После успешной отправки обновляем список сообщений
      await loadMessages();
    } catch (error: any) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  return {
    loadingMessages,
    messagesError,
    messages,
    loadMessages,
    sendMessage,
  };
}
