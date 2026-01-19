import { onMounted, toRef } from 'vue';
import { useConfigStore } from '@/app/stores/config';
import { useCredentialsStore } from '@/app/stores/credentials';
import { useMessages } from './useMessages';
import { useMessageModals } from './useMessageModals';
import { useUtils } from './useUtils';

export function useMessagesPage() {
  // Конфигурация
  const configStore = useConfigStore();
  const credentialsStore = useCredentialsStore();

  // Используем credentials из store (toRef для правильной типизации)
  const apiKey = toRef(credentialsStore, 'apiKey');
  const tenantId = toRef(credentialsStore, 'tenantId');

  // Функция для получения API ключа
  function getApiKey() {
    return apiKey.value;
  }

  // Сообщения
  const messagesModule = useMessages(getApiKey, configStore, credentialsStore);
  const {
    messages,
    dialogs,
    loading,
    error,
    pagination,
    currentPage,
    currentLimit,
    totalPages,
    totalMessages,
    currentPageInput,
    visiblePages,
    filter,
    filterInput,
    selectedFilterExample,
    currentFilter,
    currentSort,
    loadDialogs,
    loadMessages,
    getDialogName,
    formatTimestamp,
    getSortIndicator,
    toggleSort,
    selectMessageFilterExample,
    clearMessageFilter,
    applyMessageFilter,
    goToPreviousPage,
    goToNextPage,
    goToPage,
    changeLimit,
  } = messagesModule;

  // Модальные окна
  const modalsModule = useMessageModals(
    getApiKey,
    configStore,
    credentialsStore,
    currentPage,
    currentLimit,
    currentFilter,
    currentSort,
  );
  const {
    infoModal,
    metaModal,
    urlModal,
    metaMessageId,
    metaTags,
    newMetaKeyForEdit,
    newMetaValueForEdit,
    infoUrl,
    jsonViewerContent,
    copyJsonButtonText,
    generatedUrl,
    fullUrl,
    copyUrlButtonText,
    showInfoModal,
    copyJsonToClipboard,
    showMetaModal,
    addMetaTag,
    deleteMetaTag,
    showUrlModal,
    copyUrlToClipboard,
  } = modalsModule;

  // Утилиты
  const utilsModule = useUtils(credentialsStore, apiKey, tenantId, loadMessages);
  const { getUrlParams, setApiKeyFromExternal } = utilsModule;

  // Инициализация
  onMounted(() => {
    // Загружаем credentials из store (они уже загружены из localStorage при создании store)
    credentialsStore.loadFromStorage();

    // Загружаем диалоги
    if (apiKey.value) {
      loadDialogs();
    }

    // Проверяем URL параметры (для обратной совместимости с iframe)
    const params = getUrlParams();
    if (params.apiKey) {
      setApiKeyFromExternal(params.apiKey, params.tenantId);
    } else {
      // Если нет URL параметров, но есть API Key в store, загружаем сообщения
      const key = getApiKey();
      if (key) {
        loadMessages(1);
      }
    }

    // Обработка сообщений от родительского окна (для обратной совместимости)
    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'setApiCredentials') {
        setApiKeyFromExternal(event.data.apiKey, event.data.tenantId);
      }
    });

    // Закрытие модальных окон при нажатии Esc
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' || event.key === 'Esc') {
        if (infoModal.isOpen.value) {
          infoModal.close();
        } else if (metaModal.isOpen.value) {
          metaModal.close();
        } else if (urlModal.isOpen.value) {
          urlModal.close();
        }
      }
    });
  });

  return {
    // State
    messages,
    dialogs,
    loading,
    error,
    // Pagination (из composable)
    currentPage: pagination.currentPage,
    currentLimit: pagination.currentLimit,
    totalPages,
    totalMessages,
    currentPageInput,
    visiblePages,
    // Filter (из composable)
    filterInput,
    selectedFilterExample,
    currentFilter: filter.currentFilter,
    // Sort
    currentSort,
    // Modals (из composable)
    showInfoModalFlag: infoModal.isOpen,
    showMetaModalFlag: metaModal.isOpen,
    showUrlModalFlag: urlModal.isOpen,
    // Meta теги
    metaMessageId,
    metaTags,
    newMetaKeyForEdit,
    newMetaValueForEdit,
    // Info modal
    infoUrl,
    jsonViewerContent,
    copyJsonButtonText,
    // URL modal
    generatedUrl,
    fullUrl,
    copyUrlButtonText,
    // Functions
    loadMessages,
    goToPreviousPage,
    goToNextPage,
    goToPage,
    changeLimit,
    getSortIndicator,
    toggleSort,
    getDialogName,
    formatTimestamp,
    showInfoModal,
    closeInfoModal: infoModal.close,
    copyJsonToClipboard,
    showMetaModal,
    closeMetaModal: metaModal.close,
    addMetaTag,
    deleteMetaTag,
    selectMessageFilterExample,
    clearMessageFilter,
    applyMessageFilter,
    showUrlModal,
    closeUrlModal: urlModal.close,
    copyUrlToClipboard,
  };
}
