/**
 * Модуль утилит и общих модальных окон
 * Отвечает за: форматирование дат/времени, укорачивание ID, экранирование HTML,
 * универсальные модальные окна (информация, URL), копирование в буфер обмена
 */
import { ref } from 'vue';
import { useModal } from '@/shared/lib/composables/useModal';
import { formatTimestamp } from '@/shared/lib/utils/date';
import { escapeHtml } from '@/shared/lib/utils/string';

// Утилиты форматирования
export { formatTimestamp as formatLastSeen, formatTimestamp as formatMessageTime };
export { escapeHtml };

export function shortenDialogId(dialogId: string) {
  if (!dialogId) return '-';
  if (dialogId.startsWith('dlg_')) {
    return `dlg_${dialogId.substring(4, 8)}...`;
  }
  return dialogId.length > 20 ? dialogId.substring(0, 20) + '...' : dialogId;
}

export function shortenTopicId(topicId: string) {
  if (!topicId) return '-';
  if (topicId.startsWith('topic_')) {
    return `topic_${topicId.substring(6, 10)}...`;
  }
  return topicId;
}

// Модальные утилиты
export function useModalUtils() {
  const infoModal = useModal();
  
  // Модальные окна - данные
  const modalTitle = ref('Информация');
  const modalUrl = ref<string | null>(null);
  const modalJsonContent = ref<string | null>(null);
  const modalOtherContent = ref<string | null>(null);

  // URL модалка
  const urlModal = useModal();
  const urlModalTitle = ref('');
  const urlModalUrl = ref('');
  const urlCopyButtonText = ref('📋 Скопировать URL');

  function showModal(title: string, content: string, url: string | null = null, jsonContent: any = null) {
    modalTitle.value = title || 'Информация';
    modalUrl.value = url || null;

    // Инициализируем значения
    modalJsonContent.value = null;
    modalOtherContent.value = null;

    // Если jsonContent передан напрямую, используем его
    if (jsonContent !== null && jsonContent !== undefined) {
      try {
        const jsonStr = typeof jsonContent === 'string' ? jsonContent : JSON.stringify(jsonContent, null, 2);
        modalJsonContent.value = jsonStr;
        // Если есть другой контент помимо JSON, сохраняем его
        if (content && typeof content === 'string' && content.trim() && !content.includes('json-content')) {
          modalOtherContent.value = content;
        }
      } catch (error) {
        console.error('Error stringifying JSON:', error);
        modalJsonContent.value = null;
        if (content && typeof content === 'string') {
          modalOtherContent.value = content;
        }
      }
    } else if (content && typeof content === 'string' && content.includes('json-content')) {
      // Если JSON встроен в HTML content, извлекаем его
      const jsonMatch = content.match(/<pre[^>]*class="json-content"[^>]*>([\s\S]*?)<\/pre>/);
      if (jsonMatch && jsonMatch[1]) {
        // Декодируем HTML entities
        const jsonText = jsonMatch[1]
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .trim();
        if (jsonText) {
          modalJsonContent.value = jsonText;
        }
        
        // Удаляем JSON блок из content и сохраняем остальное как otherContent
        const contentWithoutJson = content
          .replace(/<div[^>]*class="json-content-wrapper"[^>]*>[\s\S]*?<\/div>/gi, '')
          .replace(/<pre[^>]*class="json-content"[^>]*>[\s\S]*?<\/pre>/gi, '')
          .trim();
        if (contentWithoutJson) {
          modalOtherContent.value = contentWithoutJson;
        }
      } else {
        // JSON не найден в content, сохраняем весь content как otherContent
        modalOtherContent.value = content;
      }
    } else if (content && typeof content === 'string' && content.trim()) {
      // Нет JSON, только обычный контент
      modalOtherContent.value = content;
    }

    infoModal.open();
  }

  function closeModal() {
    infoModal.close();
    modalUrl.value = null;
    modalJsonContent.value = null;
    modalOtherContent.value = null;
  }


  function showUrlModal(title: string, url: string) {
    urlModalTitle.value = title;
    urlModalUrl.value = url;
    urlCopyButtonText.value = '📋 Скопировать URL';
    urlModal.open();
  }

  function copyUrlToClipboard() {
    navigator.clipboard.writeText(urlModalUrl.value).then(
      () => {
        urlCopyButtonText.value = '✅ Скопировано!';
        setTimeout(() => {
          urlCopyButtonText.value = '📋 Скопировать URL';
        }, 2000);
      },
      () => {
        urlCopyButtonText.value = '❌ Ошибка';
        setTimeout(() => {
          urlCopyButtonText.value = '📋 Скопировать URL';
        }, 2000);
      },
    );
  }

  return {
    // Info modal
    infoModal,
    modalTitle,
    modalUrl,
    modalJsonContent,
    modalOtherContent,
    showModal,
    closeModal,
    // URL modal
    urlModal,
    urlModalTitle,
    urlModalUrl,
    urlCopyButtonText,
    showUrlModal,
    copyUrlToClipboard,
  };
}
