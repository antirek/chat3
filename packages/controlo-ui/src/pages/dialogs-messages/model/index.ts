import { ref, computed, onMounted, toRef } from 'vue';
import { useConfigStore } from '@/app/stores/config';
import { useCredentialsStore } from '@/app/stores/credentials';
import { useModal } from '@/shared/lib/composables/useModal';
import { useDialogs } from './useDialogs';
import { useMessages } from './useMessages';
import { useMembers } from './useMembers';
import { useTopics } from './useTopics';
import { useDialogModals } from './useDialogModals';
import { useMessageModals } from './useMessageModals';
import { useUtils } from './useUtils';

export function useDialogsMessagesPage() {
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

  // Участники и топики (ленивая загрузка при открытии таба)
  const membersModule = useMembers(getApiKey);
  const {
    members,
    loadingMembers,
    membersError,
    membersPagination,
    loadDialogMembers,
    clearMembers,
  } = membersModule;

  const topicsModule = useTopics(getApiKey);
  const {
    topics,
    loadingTopics,
    topicsError,
    topicsPagination,
    loadDialogTopics,
    clearTopics,
  } = topicsModule;

  // Текущий таб правой панели
  const currentViewMode = ref<'messages' | 'members' | 'topics'>('messages');

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

  // Координация между диалогами и правой панелью
  async function selectDialog(dialogId: string) {
    currentDialogId.value = dialogId;
    messagesPagination.currentPage.value = 1;
    messagesPagination.currentPageInput.value = 1;
    loadDialogMessages(dialogId, 1);
    clearMembers();
    clearTopics();
  }

  function selectMessagesTab() {
    currentViewMode.value = 'messages';
  }

  function selectMembersTab() {
    currentViewMode.value = 'members';
    if (currentDialogId.value) {
      loadDialogMembers(currentDialogId.value, 1);
    }
  }

  function selectTopicsTab() {
    currentViewMode.value = 'topics';
    if (currentDialogId.value) {
      loadDialogTopics(currentDialogId.value, 1);
    }
  }

  const showMembersPagination = computed(
    () => currentDialogId.value !== null && membersPagination.totalItems.value > 0
  );
  const showTopicsPagination = computed(
    () => currentDialogId.value !== null && topicsPagination.totalItems.value > 0
  );

  function goToMembersPage(page: number) {
    if (currentDialogId.value) {
      membersPagination.currentPage.value = page;
      membersPagination.currentPageInput.value = page;
      loadDialogMembers(currentDialogId.value, page);
    }
  }
  function goToTopicsPage(page: number) {
    if (currentDialogId.value) {
      topicsPagination.currentPage.value = page;
      topicsPagination.currentPageInput.value = page;
      loadDialogTopics(currentDialogId.value, page);
    }
  }

  function changeMemberLimit(limit: number) {
    membersPagination.changeLimit(limit);
    if (currentDialogId.value) {
      loadDialogMembers(currentDialogId.value, 1, limit);
    }
  }
  function changeTopicsLimit(limit: number) {
    topicsPagination.changeLimit(limit);
    if (currentDialogId.value) {
      loadDialogTopics(currentDialogId.value, 1, limit);
    }
  }

  function showCurrentMembersUrl() {
    if (!currentDialogId.value) return;
    const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
    const page = membersPagination.currentPage.value;
    const limit = membersPagination.currentLimit.value;
    const url = `${baseUrl}/api/dialogs/${currentDialogId.value}/members?page=${page}&limit=${limit}`;
    urlModalTitle.value = 'URL запроса участников';
    urlModalUrl.value = url;
    urlModal.open();
  }

  function showCurrentTopicsUrl() {
    if (!currentDialogId.value) return;
    const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
    const page = topicsPagination.currentPage.value;
    const limit = topicsPagination.currentLimit.value;
    const url = `${baseUrl}/api/dialogs/${currentDialogId.value}/topics?page=${page}&limit=${limit}`;
    urlModalTitle.value = 'URL запроса топиков';
    urlModalUrl.value = url;
    urlModal.open();
  }

  function showCurrentTabUrl() {
    if (currentViewMode.value === 'messages') showCurrentMessageUrl();
    else if (currentViewMode.value === 'members') showCurrentMembersUrl();
    else if (currentViewMode.value === 'topics') showCurrentTopicsUrl();
  }

  const rightPanelTitle = computed(() => {
    if (currentViewMode.value === 'messages') return 'Сообщения';
    if (currentViewMode.value === 'members') return 'Участники';
    return 'Топики';
  });

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
    // Таб правой панели
    currentViewMode,
    selectMessagesTab,
    selectMembersTab,
    selectTopicsTab,
    // Участники
    members,
    loadingMembers,
    membersError,
    membersPagination,
    showMembersPagination,
    currentMemberPage: membersPagination.currentPage,
    currentMemberPageInput: membersPagination.currentPageInput,
    currentMemberLimit: membersPagination.currentLimit,
    totalMemberPages: membersPagination.totalPages,
    totalMembers: membersPagination.totalItems,
    memberPaginationStart: membersPagination.paginationStart,
    memberPaginationEnd: membersPagination.paginationEnd,
    goToMembersFirstPage: membersPagination.goToFirstPage,
    goToMembersPreviousPage: membersPagination.goToPreviousPage,
    goToMembersNextPage: membersPagination.goToNextPage,
    goToMembersLastPage: membersPagination.goToLastPage,
    goToMembersPage,
    changeMemberLimit,
    // Топики
    topics,
    loadingTopics,
    topicsError,
    topicsPagination,
    showTopicsPagination,
    currentTopicsPage: topicsPagination.currentPage,
    currentTopicsPageInput: topicsPagination.currentPageInput,
    currentTopicsLimit: topicsPagination.currentLimit,
    totalTopicsPages: topicsPagination.totalPages,
    totalTopics: topicsPagination.totalItems,
    topicsPaginationStart: topicsPagination.paginationStart,
    topicsPaginationEnd: topicsPagination.paginationEnd,
    goToTopicsFirstPage: topicsPagination.goToFirstPage,
    goToTopicsPreviousPage: topicsPagination.goToPreviousPage,
    goToTopicsNextPage: topicsPagination.goToNextPage,
    goToTopicsLastPage: topicsPagination.goToLastPage,
    goToTopicsPage,
    changeTopicsLimit,
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
    showCurrentMembersUrl,
    showCurrentTopicsUrl,
    showCurrentTabUrl,
    rightPanelTitle,
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

