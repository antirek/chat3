import { ref, onMounted, toRef } from 'vue';
import { useCredentialsStore } from '@/app/stores/credentials';
import { useModal } from '@/shared/lib/composables/useModal';
import { useDialogs } from './useDialogs';
import { useMessages } from './useMessages';
import { useDialogModals } from './useDialogModals';
import { useMessageModals } from './useMessageModals';
import { useUtils } from './useUtils';

export function useDialogsMessagesPage() {
  // Конфигурация
  const credentialsStore = useCredentialsStore();

  // Используем credentials из store (toRef для правильной типизации)
  const apiKey = toRef(credentialsStore, 'apiKey');
  const tenantId = toRef(credentialsStore, 'tenantId');

  // Функция для получения API ключа
  function getApiKey() {
    return apiKey.value;
  }

  // Диалоги
  const dialogsModule = useDialogs(getApiKey);
  const {
    dialogs,
    loadingDialogs,
    dialogsError,
    currentFilter,
    currentAdditionalFilter,
    currentSort,
    filterValue,
    sortValue,
    selectedFilterExample,
    selectedSortExample,
    applying,
    applyButtonText,
    showDialogsPagination,
    dialogsPagination,
    visibleDialogPages,
    loadDialogsWithFilter,
    changePage,
    updateFilterInput,
    updateSortInput,
    clearAll,
    applyCombined,
    toggleSort,
    getDialogSortIndicator,
    formatTimestamp,
    formatMembers,
  } = dialogsModule;

  // Сообщения
  const messagesModule = useMessages(getApiKey);
  const {
    messages,
    loadingMessages,
    messagesError,
    currentDialogId,
    currentMessageFilter,
    currentMessageSort,
    messageFilterValue,
    selectedMessageFilterExample,
    showMessagesPagination,
    messagesPagination,
    visibleMessagePages,
    loadDialogMessages,
    changeMessagePage,
    updateMessageFilterInput,
    applyMessageFilter,
    clearMessageFilter,
    toggleMessageSort,
    getMessageSortIndicator,
    formatTimestamp: formatMessageTimestamp,
  } = messagesModule;

  // Модальные окна (общие)
  const infoModal = useModal();
  const urlModal = useModal();
  const modalTitle = ref('Информация');
  const modalUrl = ref<string | null>(null);
  const modalJsonContent = ref<string | null>(null);
  const modalOtherContent = ref<string | null>(null);
  
  // URL модалка
  const urlModalTitle = ref('');
  const urlModalUrl = ref('');
  const urlCopyButtonText = ref('📋 Скопировать URL');

  // Утилиты
  const utilsModule = useUtils(
    urlModalUrl,
    urlCopyButtonText,
    modalTitle,
    modalUrl,
    modalJsonContent,
    modalOtherContent,
    infoModal,
    credentialsStore,
    apiKey,
    tenantId,
    loadDialogsWithFilter,
  );
  const {
    getUrlParams,
    copyToClipboard,
    copyUrlToClipboard,
    copyJsonToClipboardFromModal,
    showModal,
    closeModal,
    setApiKeyFromExternal,
  } = utilsModule;

  // Модальные окна для диалогов
  const dialogModalsModule = useDialogModals(
    getApiKey,
    loadDialogsWithFilter,
    currentFilter,
    dialogsPagination,
    currentAdditionalFilter,
    currentSort,
    showModal,
    urlModal,
    urlModalTitle,
    urlModalUrl,
    urlCopyButtonText,
  );
  const {
    createDialogModal,
    usersForDialog,
    loadingUsers,
    usersError,
    usersLoaded,
    selectedMembers,
    showAddDialogModal,
    loadUsersForDialog,
    createDialog,
    showDialogInfo,
    showCurrentUrl,
  } = dialogModalsModule;

  // Модальные окна для сообщений
  const messageModalsModule = useMessageModals(
    formatMessageTimestamp,
    currentDialogId,
    currentMessageFilter,
    currentMessageSort,
    messagesPagination,
    showModal,
    urlModal,
    urlModalTitle,
    urlModalUrl,
    urlCopyButtonText,
  );
  const {
    showMessageInfo,
    showCurrentMessageUrl,
  } = messageModalsModule;

  // Координация между диалогами и сообщениями
  async function selectDialog(dialogId: string) {
    currentDialogId.value = dialogId;
    messagesPagination.currentPage.value = 1;
    messagesPagination.currentPageInput.value = 1;
    loadDialogMessages(dialogId, 1);
  }

  // Инициализация
  onMounted(() => {
    // Глобальные функции для использования в v-html
    (window as any).copyJsonToClipboardFromModal = copyJsonToClipboardFromModal;
    (window as any).copyToClipboard = copyToClipboard;

    credentialsStore.loadFromStorage();

    const params = getUrlParams();
    if (params.apiKey) {
      setApiKeyFromExternal(params.apiKey, params.tenantId);
    } else {
      const key = getApiKey();
      if (key && key.trim()) {
        // Если API Key уже есть в store, загружаем диалоги
        loadDialogsWithFilter('');
      } else {
        // Если API Key нет, не показываем загрузку
        loadingDialogs.value = false;
      }
    }

    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'setApiCredentials') {
        setApiKeyFromExternal(event.data.apiKey, event.data.tenantId);
      }
    });

    // Слушаем событие применения credentials из AppLayout
    window.addEventListener('credentials-applied', () => {
      // Перезагружаем данные при применении новых credentials
      const key = getApiKey();
      if (key && key.trim()) {
        loadDialogsWithFilter('');
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' || event.key === 'Esc') {
        if (infoModal.isOpen.value) {
          closeModal();
        }
        if (createDialogModal.isOpen.value) {
          createDialogModal.close();
        }
      }
    });
  });

  return {
    // Диалоги
    dialogs,
    loadingDialogs,
    dialogsError,
    currentPage: dialogsPagination.currentPage,
    currentPageInput: dialogsPagination.currentPageInput,
    currentDialogLimit: dialogsPagination.currentLimit,
    totalPages: dialogsPagination.totalPages,
    totalDialogs: dialogsPagination.totalItems,
    dialogPaginationStart: dialogsPagination.paginationStart,
    dialogPaginationEnd: dialogsPagination.paginationEnd,
    visibleDialogPages,
    currentFilter,
    currentAdditionalFilter,
    currentSort,
    filterValue,
    sortValue,
    selectedFilterExample,
    selectedSortExample,
    applying,
    applyButtonText,
    showDialogsPagination,
    // Сообщения
    messages,
    loadingMessages,
    messagesError,
    currentDialogId,
    currentMessagePage: messagesPagination.currentPage,
    currentMessagePageInput: messagesPagination.currentPageInput,
    currentMessageLimit: messagesPagination.currentLimit,
    totalMessagePages: messagesPagination.totalPages,
    totalMessages: messagesPagination.totalItems,
    messagePaginationStart: messagesPagination.paginationStart,
    messagePaginationEnd: messagesPagination.paginationEnd,
    visibleMessagePages,
    currentMessageFilter,
    currentMessageSort,
    messageFilterValue,
    selectedMessageFilterExample,
    showMessagesPagination,
    // Модальные окна
    showInfoModalFlag: infoModal.isOpen,
    showCreateDialogModalFlag: createDialogModal.isOpen,
    modalTitle,
    modalUrl,
    modalJsonContent,
    modalOtherContent,
    // Создание диалога
    usersForDialog,
    loadingUsers,
    usersError,
    usersLoaded,
    selectedMembers,
    // Функции
    updateFilterInput,
    updateSortInput,
    clearAll,
    applyCombined,
    // Dialogs Pagination Functions
    goToDialogsFirstPage: dialogsPagination.goToFirstPage,
    goToDialogsPreviousPage: dialogsPagination.goToPreviousPage,
    goToDialogsNextPage: dialogsPagination.goToNextPage,
    goToDialogsLastPage: dialogsPagination.goToLastPage,
    goToDialogsPage: dialogsPagination.goToPage,
    changeDialogLimit: dialogsPagination.changeLimit,
    changePage,
    formatTimestamp,
    formatMembers,
    selectDialog,
    // Messages Pagination Functions
    goToMessagesFirstPage: messagesPagination.goToFirstPage,
    goToMessagesPreviousPage: messagesPagination.goToPreviousPage,
    goToMessagesNextPage: messagesPagination.goToNextPage,
    goToMessagesLastPage: messagesPagination.goToLastPage,
    goToMessagesPage: messagesPagination.goToPage,
    changeMessageLimit: messagesPagination.changeLimit,
    changeMessagePage,
    formatMessageTime: formatMessageTimestamp,
    toggleSort,
    getDialogSortIndicator,
    toggleMessageSort,
    getMessageSortIndicator,
    updateMessageFilterInput,
    applyMessageFilter,
    clearMessageFilter,
    showCurrentMessageUrl,
    showCurrentUrl,
    showAddDialogModal,
    closeCreateDialogModal: createDialogModal.close,
    loadUsersForDialog,
    createDialog,
    showDialogInfo,
    showMessageInfo,
    closeModal,
    copyJsonToClipboardFromModal,
    // URL модалка
    showUrlModal: urlModal.isOpen,
    urlModalTitle,
    urlModalUrl,
    urlCopyButtonText,
    closeUrlModal: urlModal.close,
    copyUrlToClipboard,
  };
}

