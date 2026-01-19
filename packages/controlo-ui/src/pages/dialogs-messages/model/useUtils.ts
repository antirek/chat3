/**
 * Модуль утилит и общих функций
 * Отвечает за: утилиты форматирования, работы с URL, копирования в буфер обмена, модальные утилиты
 */
import { Ref } from 'vue';
import { useModal } from '@/shared/lib/composables/useModal';
import { useCredentialsStore } from '@/app/stores/credentials';

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
  // Утилиты форматирования
  function escapeHtml(value: string) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Утилиты для работы с URL
  function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return {
      apiKey: params.get('apiKey') || '',
      tenantId: params.get('tenantId') || 'tnt_default',
    };
  }

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

  function copyJsonToClipboardFromModal() {
    const jsonText = currentModalJsonForCopy.value;

    if (!jsonText) {
      alert('Нет данных для копирования');
      return;
    }

    navigator.clipboard.writeText(jsonText).then(
      () => {
        const button = document.querySelector('.modal-body .btn-primary');
        if (button && 'style' in button && 'textContent' in button) {
          const originalText = button.textContent;
          button.textContent = '✅ Скопировано!';
          (button as any).style.background = '#28a745';
          setTimeout(() => {
            button.textContent = originalText;
            (button as any).style.background = '';
          }, 2000);
        }
      },
      (err) => {
        console.error('Failed to copy JSON:', err);
        alert('Не удалось скопировать JSON');
      },
    );
  }

  // Модальные утилиты
  function showModal(title: string, content: string, url: string | null = null, jsonContent: any = null) {
    modalTitle.value = title;

    let modalContent = '';

    if (url) {
      modalContent += `<div class="info-url" style="margin-bottom: 15px; padding: 8px; background: #f8f9fa; border-radius: 4px; font-family: monospace; font-size: 12px; word-break: break-all; color: #495057;">${escapeHtml(url)}</div>`;
    }

    modalContent += content;

    if (jsonContent) {
      const jsonStr = typeof jsonContent === 'string' ? jsonContent : JSON.stringify(jsonContent, null, 2);
      currentModalJsonForCopy.value = jsonStr;
      modalContent += `<div class="form-actions" style="margin-top: 15px;">
      <button type="button" class="btn-primary" onclick="copyJsonToClipboardFromModal()" style="margin-right: 10px;">📋 Копировать JSON</button>
    </div>`;
    }

    modalBody.value = modalContent;
    modalUrl.value = url || '';
    infoModal.open();
  }

  function closeModal() {
    infoModal.close();
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
