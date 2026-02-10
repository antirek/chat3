/**
 * Модуль модальных окон для работы с сообщениями
 * Отвечает за: отображение информации о сообщении, URL сообщений
 */
import { useConfigStore } from '@/app/stores/config';
import { useModal } from '@/shared/lib/composables/useModal';
import { toTimestampWithMicros } from '@/shared/lib/utils/date';

export function useMessageModals(
  formatTimestamp: (createdAt: string | number | undefined) => string,
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

  // Модалки сообщений (данные из api/dialogs/{dialogId}/messages)
  function showMessageInfo(message: any) {
    try {
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      if (!currentDialogId.value) {
        showModal('Ошибка', 'Не выбран диалог', null, null);
        return;
      }
      let path = `/api/dialogs/${currentDialogId.value}/messages`;
      const params = new URLSearchParams();
      params.append('page', messagesPagination.currentPage.value.toString());
      params.append('limit', '10');
      if (currentMessageFilter.value) params.append('filter', currentMessageFilter.value);
      if (currentMessageSort.value) params.append('sort', currentMessageSort.value);
      const url = `${baseUrl}${path}${params.toString() ? '?' + params.toString() : ''}`;

      const messageInfo = {
        messageId: message.messageId,
        senderId: message.senderId,
        content: message.content,
        type: message.type,
        createdAt: toTimestampWithMicros(message.createdAt) || undefined,
      };

      showModal('Информация о сообщении', `<div class="json-content">${JSON.stringify(messageInfo, null, 2)}</div>`, url, messageInfo);
    } catch (error) {
      console.error('Error showing message info:', error);
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const url = currentDialogId.value ? `${baseUrl}/api/dialogs/${currentDialogId.value}/messages` : null;
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
