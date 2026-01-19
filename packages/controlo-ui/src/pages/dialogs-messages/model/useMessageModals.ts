/**
 * Модуль модальных окон для работы с сообщениями
 * Отвечает за: отображение информации о сообщении, URL сообщений
 */
import { useConfigStore } from '@/app/stores/config';
import { useModal } from '@/shared/lib/composables/useModal';

export function useMessageModals(
  formatMessageTime: (createdAt: string | number | undefined) => string,
  currentDialogId: { value: string | null },
  currentMessageFilter: { value: string | null },
  currentMessageSort: { value: string | null },
  messagesPagination: {
    currentPage: { value: number };
  },
  showModal: (title: string, content: string, url: string | null, jsonContent: any) => void,
  urlModal: ReturnType<typeof useModal>,
  urlModalTitle: { value: string },
  urlModalUrl: { value: string },
  urlCopyButtonText: { value: string },
) {
  // Конфигурация
  const configStore = useConfigStore();

  // Модалки сообщений
  function showMessageInfo(message: any) {
    try {
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const url = `${baseUrl}/api/messages/${message.messageId}`;

      // Формируем упрощенный объект из данных сообщения, как в оригинале
      const messageInfo = {
        id: message.messageId,
        sender: message.senderId,
        time: formatMessageTime(message.createdAt),
        content: message.content,
        type: message.type,
      };

      showModal('Информация о сообщении', `<div class="json-content">${JSON.stringify(messageInfo, null, 2)}</div>`, url, messageInfo);
    } catch (error) {
      console.error('Error showing message info:', error);
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const url = `${baseUrl}/api/messages/${message.messageId}`;
      showModal('Ошибка', `Не удалось загрузить информацию о сообщении: ${error instanceof Error ? error.message : 'Unknown error'}`, url, null);
    }
  }

  function showCurrentMessageUrl() {
    if (!currentDialogId.value) {
      alert('Выберите диалог');
      return;
    }

    let url = `/api/dialogs/${currentDialogId.value}/messages`;
    const params = new URLSearchParams();

    params.append('page', messagesPagination.currentPage.value.toString());
    params.append('limit', '10');

    if (currentMessageFilter.value) {
      params.append('filter', currentMessageFilter.value);
    }

    if (currentMessageSort.value) {
      params.append('sort', currentMessageSort.value);
    }

    const fullUrl = url + (params.toString() ? '?' + params.toString() : '');
    const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
    const completeUrl = `${baseUrl}${fullUrl}`;

    urlModalTitle.value = 'Текущий URL запроса сообщений';
    urlModalUrl.value = completeUrl;
    urlCopyButtonText.value = '📋 Скопировать URL';
    urlModal.open();
  }

  return {
    showMessageInfo,
    showCurrentMessageUrl,
  };
}
