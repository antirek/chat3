/**
 * Модуль утилит и общих функций
 * Отвечает за: утилиты форматирования, работы с URL, копирования в буфер обмена, модальные утилиты
 */
import { Ref } from 'vue';
import { useModal } from '@/shared/lib/composables/useModal';
import { useCredentialsStore } from '@/app/stores/credentials';
import { escapeHtml } from '@/shared/lib/utils/string';
import { getUrlParams } from '@/shared/lib/utils/url';
export function useUtils(
  urlModalUrl: Ref<string>,
  urlCopyButtonText: Ref<string>,
  modalTitle: Ref<string>,
  modalUrl: Ref<string | null>,
  modalJsonContent: Ref<string | null>,
  modalOtherContent: Ref<string | null>,
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

  // Модальные утилиты
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
    // Modal Utils
    showModal,
    closeModal,
    // API Utils
    setApiKeyFromExternal,
  };
}
