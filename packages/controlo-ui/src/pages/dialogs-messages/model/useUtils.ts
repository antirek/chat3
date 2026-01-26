/**
 * Модуль утилит и общих функций
 * Отвечает за: утилиты форматирования, работы с URL, копирования в буфер обмена, модальные утилиты
 */
import { Ref } from 'vue';
import { useModal } from '@/shared/lib/composables/useModal';
import { useCredentialsStore } from '@/app/stores/credentials';
import { escapeHtml } from '@/shared/lib/utils/string';
import { getUrlParams } from '@/shared/lib/utils/url';
import { copyUrlFromModal as copyUrlFromModalShared, copyJsonFromModal } from '@/shared/lib/utils/clipboard';
import { buildModalContentWithCopyButtons } from '@/shared/lib/utils/modalContent';

export function useUtils(
  urlModalUrl: Ref<string>,
  urlCopyButtonText: Ref<string>,
  currentModalJsonForCopy: Ref<string | null>,
  modalTitle: Ref<string>,
  modalBody: Ref<string>,
  modalUrl: Ref<string>,
  infoModal: ReturnType<typeof useModal>,
  credentialsStore: ReturnType<typeof useCredentialsStore>,
  apiKey: Ref<string>,
  tenantId: Ref<string>,
  loadDialogsWithFilter: (filter: string) => void,
) {
  // Утилиты для копирования
  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(
      () => {
        alert('URL скопирован в буфер обмена!');
      },
      (err) => {
        console.error('Ошибка копирования:', err);
        alert('Ошибка копирования в буфер обмена');
      },
    );
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

  function copyJsonToClipboardFromModal(button?: any) {
    copyJsonFromModal(currentModalJsonForCopy.value, button);
  }

  // Функция для копирования URL из модального окна (будет вызвана из v-html)
  function copyUrlFromModal(button: any) {
    copyUrlFromModalShared(button);
  }

  // Модальные утилиты
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
  }

  // Добавляем функции в window для вызова из v-html
  if (typeof window !== 'undefined') {
    (window as any).copyJsonToClipboardFromModal = copyJsonToClipboardFromModal;
    (window as any).copyUrlFromModal = copyUrlFromModal;
  }

  // Функции для работы с API ключом
  function setApiKeyFromExternal(extApiKey: string, extTenantId?: string) {
    if (!extApiKey) {
      console.warn('API Key не предоставлен');
      return;
    }

    credentialsStore.setCredentials(extApiKey, extTenantId);

    console.log('API Key set from external:', apiKey.value);
    console.log('Tenant ID set from external:', tenantId.value);

    loadDialogsWithFilter('');
  }

  return {
    // Utils
    escapeHtml,
    getUrlParams,
    copyToClipboard,
    copyUrlToClipboard,
    copyJsonToClipboardFromModal,
    // Modal Utils
    showModal,
    closeModal,
    // API Utils
    setApiKeyFromExternal,
  };
}
