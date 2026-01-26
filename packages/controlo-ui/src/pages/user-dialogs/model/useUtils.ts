/**
 * Модуль утилит и общих модальных окон
 * Отвечает за: форматирование дат/времени, укорачивание ID, экранирование HTML,
 * универсальные модальные окна (информация, URL), копирование в буфер обмена
 */
import { ref } from 'vue';
import { useModal } from '@/shared/lib/composables/useModal';
import { formatTimestamp } from '@/shared/lib/utils/date';
import { escapeHtml } from '@/shared/lib/utils/string';
import { copyUrlFromModal as copyUrlFromModalShared, copyJsonFromModal } from '@/shared/lib/utils/clipboard';
import { buildModalContentWithCopyButtons } from '@/shared/lib/utils/modalContent';

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
  const modalBody = ref('');
  const modalUrl = ref('');
  const currentModalJsonForCopy = ref<string | null>(null);

  // URL модалка
  const urlModal = useModal();
  const urlModalTitle = ref('');
  const urlModalUrl = ref('');
  const urlCopyButtonText = ref('📋 Скопировать URL');

  function showModal(title: string, content: string, url: string | null = null, jsonContent: any = null) {
    modalTitle.value = title;

    // Сохраняем JSON для копирования
    if (jsonContent) {
      const jsonStr = typeof jsonContent === 'string' ? jsonContent : JSON.stringify(jsonContent, null, 2);
      currentModalJsonForCopy.value = jsonStr;
    }

    // Формируем контент с кнопками копирования
    const modalContent = buildModalContentWithCopyButtons(content, url, jsonContent);

    modalBody.value = modalContent;
    modalUrl.value = url || '';
    infoModal.open();
  }

  function closeModal() {
    infoModal.close();
    modalBody.value = '';
    currentModalJsonForCopy.value = null;
  }

  // Функция для копирования JSON из модального окна (будет вызвана из v-html)
  function copyJsonToClipboardFromModal(button?: any) {
    copyJsonFromModal(currentModalJsonForCopy.value, button);
  }

  // Функция для копирования URL в буфер обмена
  function copyToClipboardFromModal(text: string) {
    navigator.clipboard.writeText(text).then(
      () => {
        const button = document.querySelector('.url-copy button') as any;
        if (button) {
          const originalText = button.textContent;
          button.textContent = '✅ Скопировано!';
          button.style.background = '#28a745';
          setTimeout(() => {
            button.textContent = originalText;
            button.style.background = '#28a745';
          }, 2000);
        }
      },
      (err) => {
        console.error('Failed to copy URL:', err);
        alert('Не удалось скопировать URL');
      }
    );
  }

  // Функция для копирования URL из модального окна (будет вызвана из v-html)
  function copyUrlFromModal(button: any) {
    copyUrlFromModalShared(button);
  }

  // Добавляем функции в window для вызова из v-html
  if (typeof window !== 'undefined') {
    (window as any).copyJsonToClipboardFromModal = copyJsonToClipboardFromModal;
    (window as any).copyToClipboardFromModal = copyToClipboardFromModal;
    (window as any).copyUrlFromModal = copyUrlFromModal;
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
    modalBody,
    modalUrl,
    currentModalJsonForCopy,
    showModal,
    closeModal,
    copyJsonToClipboardFromModal,
    copyToClipboardFromModal,
    // URL modal
    urlModal,
    urlModalTitle,
    urlModalUrl,
    urlCopyButtonText,
    showUrlModal,
    copyUrlToClipboard,
  };
}
