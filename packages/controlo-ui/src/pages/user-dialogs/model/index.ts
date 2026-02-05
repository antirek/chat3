import { ref, computed, onMounted, toRef } from 'vue';
import { useCredentialsStore } from '@/app/stores/credentials';
import { useUsers } from './useUsers';
import { useDialogs } from './useDialogs';
import { usePacks } from './usePacks';
import { usePackDialogs } from './usePackDialogs';
import { usePackMessagesForUser } from './usePackMessagesForUser';
import { useMessages } from './useMessages';
import { useMembers } from './useMembers';
import { useTopics } from './useTopics';
import { useMessageModals } from './useMessageModals';
import { useMetaModals } from './useMetaModals';
import { useEntityModals } from './useEntityModals';
import { useModalUtils, formatLastSeen, formatMessageTime, shortenDialogId, shortenTopicId, escapeHtml } from './useUtils';

export function useUserDialogsPage() {
  // Конфигурация
  const credentialsStore = useCredentialsStore();

  // Используем credentials из store
  const apiKey = toRef(credentialsStore, 'apiKey');

  // Модальные утилиты (нужно для useUsers)
  const modalUtils = useModalUtils();
  const {
    infoModal,
    modalTitle,
    modalUrl,
    modalJsonContent,
    modalOtherContent,
    showModal,
    closeModal,
    urlModal,
    urlModalTitle,
    urlModalUrl,
    urlCopyButtonText,
    showUrlModal,
    copyUrlToClipboard,
  } = modalUtils;

  // Пользователи
  const usersModule = useUsers(showModal, showUrlModal);
  const {
    loadingUsers,
    usersError,
    users,
    usersPagination,
    usersFilter,
    userPaginationStart,
    userPaginationEnd,
    loadUsers,
    selectUserFilterExample,
    clearUserFilter,
    applyUserFilter,
    showUserInfoModal,
    showUsersUrl,
  } = usersModule;

  // Page-specific state для пользователей
  const currentUserId = ref<string | null>(null);
  const currentUserName = ref<string>('');

  // Диалоги
  const dialogsModule = useDialogs(currentUserId, showModal, showUrlModal);
  const {
    loadingDialogs,
    dialogsError,
    dialogs,
    dialogsPagination,
    dialogsFilter,
    visibleDialogPages,
    currentSort,
    loadUserDialogs,
    selectFilterExample,
    clearFilter,
    applyFilter,
    changeDialogPage,
    toggleSort,
    getDialogSortIndicator,
    showCurrentUrl,
    showDialogInfo,
  } = dialogsModule;

  // Таб средней панели: диалоги или паки
  const middlePanelTab = ref<'dialogs' | 'packs'>('dialogs');

  // Паки пользователя
  const packsModule = usePacks(currentUserId, showModal, showUrlModal);
  const {
    loadingPacks,
    packsError,
    packs,
    packsPagination,
    packsFilter,
    visiblePackPages,
    currentSort: currentPackSort,
    toggleSort: togglePackSort,
    getPackSortIndicator,
    loadUserPacks,
    selectPacksFilterExample,
    clearPacksFilter,
    applyPacksFilter,
    changePackPage,
    showPacksCurrentUrl,
    showPackInfo,
  } = packsModule;

  // Выбранный пак (для отображения диалогов пака в третьей колонке)
  const currentPackId = ref<string | null>(null);
  const packDialogsModule = usePackDialogs(currentUserId);
  const {
    packDialogs,
    loadingPackDialogs,
    packDialogsError,
    packDialogsTotal,
    packDialogsPage,
    packDialogsLimit,
    packDialogsTotalPages,
    packDialogsPaginationStart,
    packDialogsPaginationEnd,
    loadPackDialogs,
    clearPackDialogs,
    setPackDialogsLimit,
  } = packDialogsModule;

  // Таб третьей колонки при выборе пака: Диалоги пака | Сообщения пака
  const rightPanelPackTab = ref<'dialogs' | 'messages'>('dialogs');

  const packMessagesForUserModule = usePackMessagesForUser(currentUserId, currentPackId);
  const {
    packMessages: packMessagesForUser,
    loadingPackMessages: loadingPackMessagesForUser,
    packMessagesError: packMessagesForUserError,
    packMessagesHasMore: packMessagesForUserHasMore,
    loadInitialPackMessagesForUser,
    loadMorePackMessagesForUser,
    resetPackMessagesForUser,
    setPackMessagesLimitForUser: setPackMessagesLimitForUserPanel,
  } = packMessagesForUserModule;

  function selectPack(packId: string) {
    currentPackId.value = packId;
    rightPanelPackTab.value = 'dialogs';
    loadPackDialogs(packId, 1);
  }

  function selectRightPanelPackTab(tab: 'dialogs' | 'messages') {
    rightPanelPackTab.value = tab;
    if (tab === 'messages' && currentUserId.value && currentPackId.value) {
      loadInitialPackMessagesForUser();
    }
  }

  function goToPackDialogsPage(page: number) {
    if (currentPackId.value) {
      loadPackDialogs(currentPackId.value, page);
    }
  }

  function changePackDialogsLimit(limit: number) {
    setPackDialogsLimit(limit);
    if (currentPackId.value) {
      loadPackDialogs(currentPackId.value, 1);
    }
  }

  // Модальное окно «Участники диалога» (в контексте «Диалоги пака»)
  const packDialogMembersModalOpen = ref(false);
  const packDialogMembersModalDialogId = ref<string | null>(null);
  function showPackDialogMembersModal(dialogId: string) {
    packDialogMembersModalDialogId.value = dialogId;
    packDialogMembersModalOpen.value = true;
  }
  function closePackDialogMembersModal() {
    packDialogMembersModalOpen.value = false;
    packDialogMembersModalDialogId.value = null;
  }

  // Page-specific state для диалогов
  const currentDialogId = ref<string | null>(null);

  // Режим просмотра (messages, members, topics)
  const currentViewMode = ref<'messages' | 'members' | 'topics'>('messages');

  // Сообщения
  const messagesModule = useMessages(currentUserId, currentDialogId, showModal, showUrlModal);
  const {
    loadingMessages,
    messagesError,
    messages,
    messagesPagination,
    showMessagesPagination,
    visibleMessagePages,
    messagesFilter,
    currentMessageSort,
    loadDialogMessages,
    setMessageFilterByTopicId,
    selectMessageFilterExample,
    clearMessageFilter,
    applyMessageFilter,
    changeMessagePage,
    toggleMessageSort,
    getMessageSortIndicator,
    getMessageStatus,
    getStatusIcon,
    getStatusColor,
    showCurrentMessageUrl,
    showMessageInfo,
  } = messagesModule;

  // Участники
  const membersModule = useMembers(currentDialogId, showUrlModal);
  const {
    loadingMembers,
    membersError,
    members,
    membersPagination,
    visibleMemberPages,
    membersFilter,
    loadDialogMembers,
    selectMemberFilterExamplePanel,
    clearMemberFilterFieldPanel,
    applyMemberFilterPanel,
    changeMemberPage,
    removeMemberFromPanel,
    generateMembersApiUrl,
    showMembersUrlModal,
  } = membersModule;

  // Топики
  const topicsModule = useTopics(currentUserId, currentDialogId, showUrlModal);
  const {
    loadingTopics,
    topicsError,
    topics,
    topicsPagination,
    loadDialogTopics,
    showTopicsUrlModal,
  } = topicsModule;


  // Модалки для сообщений
  const messageModals = useMessageModals(
    currentUserId,
    currentDialogId,
    loadDialogMessages,
    messagesPagination
  );
  const {
    addMessageModal,
    reactionModal,
    eventsModal,
    statusMatrixModal,
    statusesModal,
    setStatusModal,
    messageSender,
    messageType,
    messageContent,
    messageTopicId,
    quotedMessageId,
    messageMetaTags,
    availableTopics,
    payloadJson,
    showAddMessageModal,
    closeAddMessageModal,
    addMetaTagRow,
    removeMetaTagRow,
    updatePayloadJson,
    submitAddMessage,
    currentMessageIdForReaction,
    existingReactions,
    selectedReaction,
    showReactionModal,
    closeReactionModal,
    loadExistingReactions,
    toggleReaction,
    currentMessageIdForEvents,
    events,
    loadingEvents,
    eventsError,
    selectedEventId,
    eventUpdates,
    showEventsModal,
    closeEventsModal,
    loadMessageEvents,
    getEventId,
    formatEventTime,
    getEventDescription,
    loadEventUpdates,
    loadingStatusMatrix,
    statusMatrixError,
    loadingStatuses,
    statusesError,
    totalStatuses,
    currentMessageIdForSetStatus,
    setStatusResult,
    setStatusUrl,
    currentMessageIdForStatuses,
    statusesUrl,
    statusMatrixUrl,
    statusMatrix,
    statuses,
    currentStatusesPage,
    currentStatusesLimit,
    totalStatusesPages,
    showStatusMatrixModal,
    closeStatusMatrixModal,
    showStatusesModal,
    closeStatusesModal,
    loadStatuses,
    goToStatusesPage,
    showSetStatusModal,
    closeSetStatusModal,
    setMessageStatus,
    messageTopicModal,
    currentMessageForTopic,
    dialogTopicsForMessageTopic,
    loadingMessageTopic,
    errorMessageTopic,
    showMessageTopicModal,
    closeMessageTopicModal,
    setMessageTopic,
    clearMessageTopic,
  } = messageModals;

  // Модалки для мета-тегов
  const metaModals = useMetaModals(
    currentUserId,
    currentDialogId,
    currentViewMode,
    loadDialogMembers,
    loadDialogTopics,
    membersPagination,
    topicsPagination
  );
  const {
    dialogMetaModal,
    memberMetaModal,
    messageMetaModal,
    topicMetaModal,
    dialogMetaDialogId,
    dialogMetaTags,
    loadingDialogMeta,
    newDialogMetaKey,
    newDialogMetaValue,
    showDialogMetaModal,
    closeDialogMetaModal,
    loadDialogMetaTags,
    addDialogMetaTag,
    deleteDialogMetaTag,
    memberMetaModalDialogId,
    memberMetaModalUserId,
    memberMetaTags,
    currentMemberMetaOriginal,
    memberMetaStatus,
    showMemberMetaModal,
    closeMemberMetaModal,
    addMemberMetaRowModal,
    updateMemberMetaKeyModal,
    updateMemberMetaValueModal,
    removeMemberMetaRowModal,
    formatMetaValueForInput,
    parseMetaValueFromInput,
    collectMemberMetaTagsModal,
    saveMemberMetaChangesModal,
    messageMetaMessageId,
    messageMetaTagsData,
    loadingMessageMeta,
    newMessageMetaKey,
    newMessageMetaValue,
    showMessageMetaModal,
    closeMessageMetaModal,
    loadMessageMetaTags,
    addMessageMetaTag,
    deleteMessageMetaTag,
    topicMetaDialogId,
    topicMetaTopicId,
    topicMetaTags,
    loadingTopicMeta,
    newTopicMetaKey,
    newTopicMetaValue,
    showTopicMetaModal,
    closeTopicMetaModal,
    loadTopicMetaTags,
    addTopicMetaTag,
    deleteTopicMetaTag,
    packMetaModal,
    packMetaPackId,
    packMetaTags,
    loadingPackMeta,
    newPackMetaKey,
    newPackMetaValue,
    showPackMetaModal,
    closePackMetaModal,
    loadPackMetaTags,
    addPackMetaTag,
    deletePackMetaTag,
  } = metaModals;

  // Модалки для создания сущностей
  const entityModals = useEntityModals(
    currentDialogId,
    currentViewMode,
    loadDialogMembers,
    loadDialogTopics,
    membersPagination,
    topicsPagination
  );
  const {
    addMemberModal,
    addTopicModal,
    dialogEventsModal,
    newMemberSelect,
    newMemberType,
    newMemberMetaTags,
    availableUsersForMember,
    showAddMemberModal,
    closeAddMemberModal,
    addMemberMetaRow,
    removeMemberMetaRow,
    submitAddMember,
    newTopicMetaTags,
    showAddTopicModal,
    closeAddTopicModal,
    addTopicMetaRow,
    removeTopicMetaRow,
    submitAddTopic,
    currentDialogIdForEvents,
    dialogEvents,
    loadingDialogEvents,
    dialogEventsError,
    selectedDialogEventId,
    dialogEventUpdates,
    showDialogEventsModal,
    closeDialogEventsModal,
    loadDialogEvents,
    getDialogEventId,
    getUpdateId,
    getDialogEventDescription,
    loadAllDialogUpdatesInModal,
  } = entityModals;

  // Computed
  const showDialogsPagination = computed(() => {
    return dialogsPagination.totalItems.value > 0 && currentUserId.value !== null;
  });

  // Функции для пользователей (координация с другими модулями)
  async function selectUser(userId: string, userName: string) {
    currentUserId.value = userId;
    currentUserName.value = userName;
    currentDialogId.value = null;
    middlePanelTab.value = 'dialogs';
    dialogs.value = [];
    packs.value = [];
    messages.value = [];
    await loadUserDialogs(userId, 1);
  }

  // Переключение таба средней панели (диалоги / паки)
  function selectMiddlePanelTab(tab: 'dialogs' | 'packs') {
    middlePanelTab.value = tab;
    if (tab === 'dialogs') {
      currentPackId.value = null;
      clearPackDialogs();
    } else if (tab === 'packs' && currentUserId.value) {
      loadUserPacks(currentUserId.value, 1);
    }
  }

  /** Переход к табу «Диалоги пользователя» с фильтром по dialogId */
  function goToDialogInDialogsTab(dialogId: string) {
    currentPackId.value = null;
    clearPackDialogs();
    middlePanelTab.value = 'dialogs';
    dialogsFilter.filterInput.value = `(dialogId,eq,${dialogId})`;
    dialogsFilter.applyFilter(); // синхронизирует currentFilter из filterInput
    if (currentUserId.value) {
      loadUserDialogs(currentUserId.value, 1);
    }
  }

  // Функции для диалогов (координация с другими модулями)
  function selectDialog(dialogId: string) {
    currentDialogId.value = dialogId;
    currentViewMode.value = 'messages';
    loadDialogMessages(dialogId, 1);
  }

  async function selectDialogMembers(dialogId: string) {
    currentDialogId.value = dialogId;
    currentViewMode.value = 'members';
    membersFilter.clearFilter();
    // Обновляем пагинацию напрямую, без вызова onPageChange
    membersPagination.currentPage.value = 1;
    membersPagination.currentPageInput.value = 1;
    await loadDialogMembers(dialogId, 1);
  }

  async function selectDialogTopics(dialogId: string) {
    currentDialogId.value = dialogId;
    currentViewMode.value = 'topics';
    await loadDialogTopics(dialogId, 1);
  }

  /** Переключение на таб «Сообщения» с фильтром по topicId (из списка топиков). */
  function showMessagesForTopic(topicId: string) {
    currentViewMode.value = 'messages';
    setMessageFilterByTopicId(topicId);
    if (currentDialogId.value) {
      loadDialogMessages(currentDialogId.value, 1);
    }
  }

  // Lifecycle
  onMounted(() => {
    if (apiKey.value) {
      loadUsers(1, usersPagination.currentLimit.value);
    }

    // Слушаем событие применения credentials из AppLayout
    window.addEventListener('credentials-applied', () => {
      // Перезагружаем данные при применении новых credentials
      if (apiKey.value) {
        loadUsers(1, usersPagination.currentLimit.value);
      }
    });
  });

  return {
    // Users
    loadingUsers,
    usersError,
    users,
    currentUserId,
    currentUserName,
    userPaginationStart,
    userPaginationEnd,
    // Users Pagination
    currentUserPage: usersPagination.currentPage,
    currentUserPageInput: usersPagination.currentPageInput,
    currentUserLimit: usersPagination.currentLimit,
    totalUserPages: usersPagination.totalPages,
    totalUsers: usersPagination.totalItems,
    // Users Filter
    userFilterInput: usersFilter.filterInput,
    selectedUserFilterExample: usersFilter.selectedFilterExample,
    currentUserFilter: usersFilter.currentFilter,
    // Dialogs
    loadingDialogs,
    dialogsError,
    dialogs,
    currentDialogId,
    showDialogsPagination,
    visibleDialogPages,
    // Dialogs Pagination
    currentDialogPage: dialogsPagination.currentPage,
    currentDialogPageInput: dialogsPagination.currentPageInput,
    currentDialogLimit: dialogsPagination.currentLimit,
    totalDialogPages: dialogsPagination.totalPages,
    totalDialogs: dialogsPagination.totalItems,
    dialogPaginationStart: dialogsPagination.paginationStart,
    dialogPaginationEnd: dialogsPagination.paginationEnd,
    // Dialogs Filter
    filterValue: dialogsFilter.filterInput,
    selectedFilterExample: dialogsFilter.selectedFilterExample,
    currentDialogFilter: dialogsFilter.currentFilter,
    // Dialogs Sort
    currentSort,
    toggleSort,
    getDialogSortIndicator,
    // Middle panel tab (dialogs / packs)
    middlePanelTab,
    selectMiddlePanelTab,
    // Packs
    loadingPacks,
    packsError,
    packs,
    packsPagination,
    packsFilter,
    visiblePackPages,
    loadUserPacks,
    selectPacksFilterExample,
    clearPacksFilter,
    applyPacksFilter,
    changePackPage,
    showPacksCurrentUrl,
    showPackInfo,
    goToPacksFirstPage: packsPagination.goToFirstPage,
    goToPacksPreviousPage: packsPagination.goToPreviousPage,
    goToPacksNextPage: packsPagination.goToNextPage,
    goToPacksLastPage: packsPagination.goToLastPage,
    goToPacksPage: packsPagination.goToPage,
    changePackLimit: packsPagination.changeLimit,
    currentPackPage: packsPagination.currentPage,
    currentPackPageInput: packsPagination.currentPageInput,
    currentPackLimit: packsPagination.currentLimit,
    totalPackPages: packsPagination.totalPages,
    totalPacks: packsPagination.totalItems,
    packPaginationStart: packsPagination.paginationStart,
    packPaginationEnd: packsPagination.paginationEnd,
    packFilterValue: packsFilter.filterInput,
    selectedPackFilterExample: packsFilter.selectedFilterExample,
    currentPackSort,
    togglePackSort,
    getPackSortIndicator,
    currentPackId,
    selectPack,
    packDialogs,
    loadingPackDialogs,
    packDialogsError,
    packDialogsTotal,
    packDialogsPage,
    packDialogsLimit,
    packDialogsTotalPages,
    packDialogsPaginationStart,
    packDialogsPaginationEnd,
    loadPackDialogs,
    clearPackDialogs,
    goToPackDialogsPage,
    changePackDialogsLimit,
    rightPanelPackTab,
    selectRightPanelPackTab,
    packMessagesForUser,
    loadingPackMessagesForUser,
    packMessagesForUserError,
    packMessagesForUserHasMore,
    loadInitialPackMessagesForUser,
    loadMorePackMessagesForUser,
    resetPackMessagesForUser,
    setPackMessagesLimitForUserPanel,
    goToDialogInDialogsTab,
    packDialogMembersModalOpen,
    packDialogMembersModalDialogId,
    showPackDialogMembersModal,
    closePackDialogMembersModal,
    // Messages
    loadingMessages,
    messagesError,
    messages,
    showMessagesPagination,
    visibleMessagePages,
    // Messages Pagination
    currentMessagePage: messagesPagination.currentPage,
    currentMessagePageInput: messagesPagination.currentPageInput,
    currentMessageLimit: messagesPagination.currentLimit,
    totalMessagePages: messagesPagination.totalPages,
    totalMessages: messagesPagination.totalItems,
    messagePaginationStart: messagesPagination.paginationStart,
    messagePaginationEnd: messagesPagination.paginationEnd,
    // Messages Filter
    messageFilterInput: messagesFilter.filterInput,
    selectedMessageFilterExample: messagesFilter.selectedFilterExample,
    currentMessageFilter: messagesFilter.currentFilter,
    // Messages Sort
    currentMessageSort,
    toggleMessageSort,
    getMessageSortIndicator,
    // Members
    loadingMembers,
    membersError,
    members,
    visibleMemberPages,
    // Members Pagination
    currentMemberPage: membersPagination.currentPage,
    currentMemberPageInput: membersPagination.currentPageInput,
    currentMemberLimit: membersPagination.currentLimit,
    totalMemberPages: membersPagination.totalPages,
    totalMembers: membersPagination.totalItems,
    memberPaginationStart: membersPagination.paginationStart,
    memberPaginationEnd: membersPagination.paginationEnd,
    // Members Filter
    memberFilterInput: membersFilter.filterInput,
    selectedMemberFilterExample: membersFilter.selectedFilterExample,
    currentMemberFilter: membersFilter.currentFilter,
    // Topics
    loadingTopics,
    topicsError,
    topics,
    // Topics Pagination
    currentTopicsPage: topicsPagination.currentPage,
    currentTopicsPageInput: topicsPagination.currentPageInput,
    currentTopicsLimit: topicsPagination.currentLimit,
    totalTopicsPages: topicsPagination.totalPages,
    totalTopics: topicsPagination.totalItems,
    topicsPaginationStart: topicsPagination.paginationStart,
    topicsPaginationEnd: topicsPagination.paginationEnd,
    // View Mode
    currentViewMode,
    // Modals - flags
    isInfoModalOpen: infoModal.isOpen,
    isAddMessageModalOpen: addMessageModal.isOpen,
    isReactionModalOpen: reactionModal.isOpen,
    isEventsModalOpen: eventsModal.isOpen,
    isStatusMatrixModalOpen: statusMatrixModal.isOpen,
    isStatusesModalOpen: statusesModal.isOpen,
    isSetStatusModalOpen: setStatusModal.isOpen,
    isMessageTopicModalOpen: messageTopicModal.isOpen,
    isDialogEventsModalOpen: dialogEventsModal.isOpen,
    isDialogMetaModalOpen: dialogMetaModal.isOpen,
    isAddMemberModalOpen: addMemberModal.isOpen,
    isAddTopicModalOpen: addTopicModal.isOpen,
    isMemberMetaModalOpen: memberMetaModal.isOpen,
    isMessageMetaModalOpen: messageMetaModal.isOpen,
    isTopicMetaModalOpen: topicMetaModal.isOpen,
    isPackMetaModalOpen: packMetaModal.isOpen,
    modalTitle,
    modalUrl,
    modalJsonContent,
    modalOtherContent,
    // Functions
    loadUsers,
    selectUserFilterExample,
    clearUserFilter,
    applyUserFilter,
    goToUsersFirstPage: usersPagination.goToFirstPage,
    goToUsersPreviousPage: usersPagination.goToPreviousPage,
    goToUsersNextPage: usersPagination.goToNextPage,
    goToUsersLastPage: usersPagination.goToLastPage,
    goToUsersPage: usersPagination.goToPage,
    changeUserLimit: usersPagination.changeLimit,
    selectUser,
    loadUserDialogs: (userId: string, page?: number, limit?: number) => loadUserDialogs(userId, page, limit),
    selectFilterExample,
    clearFilter,
    applyFilter,
    // Dialogs Pagination Functions
    goToDialogsFirstPage: dialogsPagination.goToFirstPage,
    goToDialogsPreviousPage: dialogsPagination.goToPreviousPage,
    goToDialogsNextPage: dialogsPagination.goToNextPage,
    goToDialogsLastPage: dialogsPagination.goToLastPage,
    goToDialogsPage: dialogsPagination.goToPage,
    changeDialogLimit: dialogsPagination.changeLimit,
    changeDialogPage,
    selectDialog,
    selectDialogMembers,
    selectDialogTopics,
    showMessagesForTopic,
    loadDialogMessages,
    selectMessageFilterExample,
    clearMessageFilter,
    applyMessageFilter,
    // Messages Pagination Functions
    goToMessagesFirstPage: messagesPagination.goToFirstPage,
    goToMessagesPreviousPage: messagesPagination.goToPreviousPage,
    goToMessagesNextPage: messagesPagination.goToNextPage,
    goToMessagesLastPage: messagesPagination.goToLastPage,
    goToMessagesPage: messagesPagination.goToPage,
    changeMessageLimit: messagesPagination.changeLimit,
    changeMessagePage,
    loadDialogMembers,
    selectMemberFilterExamplePanel,
    clearMemberFilterFieldPanel,
    applyMemberFilterPanel,
    // Members Pagination Functions
    goToMembersFirstPage: membersPagination.goToFirstPage,
    goToMembersPreviousPage: membersPagination.goToPreviousPage,
    goToMembersNextPage: membersPagination.goToNextPage,
    goToMembersLastPage: membersPagination.goToLastPage,
    goToMembersPage: membersPagination.goToPage,
    changeMemberLimit: membersPagination.changeLimit,
    changeMemberPage,
    loadDialogTopics,
    // Topics Pagination Functions
    goToTopicsFirstPage: topicsPagination.goToFirstPage,
    goToTopicsPreviousPage: topicsPagination.goToPreviousPage,
    goToTopicsNextPage: topicsPagination.goToNextPage,
    goToTopicsLastPage: topicsPagination.goToLastPage,
    goToTopicsPage: topicsPagination.goToPage,
    changeTopicsLimit: topicsPagination.changeLimit,
    changeTopicsPage: topicsPagination.goToPage,
    formatLastSeen,
    formatMessageTime,
    shortenDialogId,
    shortenTopicId,
    escapeHtml,
    getMessageStatus,
    getStatusIcon,
    getStatusColor,
    showModal,
    closeModal,
    // Модальные окна
    showUserInfoModal,
    showUsersUrl,
    showCurrentUrl,
    showCurrentMessageUrl,
    showDialogInfo,
    showMessageInfo,
    // Добавление сообщения
    showAddMessageModal,
    closeAddMessageModal,
    addMetaTagRow,
    removeMetaTagRow,
    updatePayloadJson,
    submitAddMessage,
    messageSender,
    messageType,
    messageContent,
    messageTopicId,
    quotedMessageId,
    messageMetaTags,
    availableTopics,
    payloadJson,
    // Реакции
    showReactionModal,
    closeReactionModal,
    loadExistingReactions,
    toggleReaction,
    currentMessageIdForReaction,
    existingReactions,
    selectedReaction,
    // События сообщения
    showEventsModal,
    closeEventsModal,
    loadMessageEvents,
    getEventId,
    formatEventTime,
    getEventDescription,
    loadEventUpdates,
    currentMessageIdForEvents,
    events,
    loadingEvents,
    eventsError,
    selectedEventId,
    eventUpdates,
    // Статусы
    showStatusMatrixModal,
    closeStatusMatrixModal,
    showStatusesModal,
    closeStatusesModal,
    loadStatuses,
    goToStatusesPage,
    showSetStatusModal,
    closeSetStatusModal,
    setMessageStatus,
    showMessageTopicModal,
    closeMessageTopicModal,
    currentMessageForTopic,
    dialogTopicsForMessageTopic,
    loadingMessageTopic,
    errorMessageTopic,
    setMessageTopic,
    clearMessageTopic,
    loadingStatusMatrix,
    statusMatrixError,
    loadingStatuses,
    statusesError,
    statusesUrl,
    totalStatuses,
    currentMessageIdForSetStatus,
    setStatusResult,
    setStatusUrl,
    currentMessageIdForStatuses,
    statusMatrixUrl,
    statusMatrix,
    statuses,
    currentStatusesPage,
    currentStatusesLimit,
    totalStatusesPages,
    // События диалога
    showDialogEventsModal,
    closeDialogEventsModal,
    loadDialogEvents,
    getDialogEventId,
    getUpdateId,
    getDialogEventDescription,
    loadAllDialogUpdatesInModal,
    currentDialogIdForEvents,
    dialogEvents,
    loadingDialogEvents,
    dialogEventsError,
    selectedDialogEventId,
    dialogEventUpdates,
    // Мета-теги диалога
    showDialogMetaModal,
    closeDialogMetaModal,
    loadDialogMetaTags,
    addDialogMetaTag,
    deleteDialogMetaTag,
    dialogMetaDialogId,
    dialogMetaTags,
    loadingDialogMeta,
    newDialogMetaKey,
    newDialogMetaValue,
    // Добавление участника
    showAddMemberModal,
    closeAddMemberModal,
    addMemberMetaRow,
    removeMemberMetaRow,
    submitAddMember,
    newMemberSelect,
    newMemberType,
    newMemberMetaTags,
    availableUsersForMember,
    // Создание топика
    showAddTopicModal,
    closeAddTopicModal,
    addTopicMetaRow,
    removeTopicMetaRow,
    submitAddTopic,
    newTopicMetaTags,
    // Мета-теги участника
    showMemberMetaModal,
    closeMemberMetaModal,
    addMemberMetaRowModal,
    updateMemberMetaKeyModal,
    updateMemberMetaValueModal,
    removeMemberMetaRowModal,
    formatMetaValueForInput,
    parseMetaValueFromInput,
    collectMemberMetaTagsModal,
    saveMemberMetaChangesModal,
    memberMetaModalDialogId,
    memberMetaModalUserId,
    memberMetaTags,
    currentMemberMetaOriginal,
    memberMetaStatus,
    // Мета-теги сообщения
    showMessageMetaModal,
    closeMessageMetaModal,
    loadMessageMetaTags,
    addMessageMetaTag,
    deleteMessageMetaTag,
    messageMetaMessageId,
    messageMetaTagsData,
    loadingMessageMeta,
    newMessageMetaKey,
    newMessageMetaValue,
    // Мета-теги топика
    showTopicMetaModal,
    closeTopicMetaModal,
    loadTopicMetaTags,
    addTopicMetaTag,
    deleteTopicMetaTag,
    topicMetaDialogId,
    topicMetaTopicId,
    topicMetaTags,
    loadingTopicMeta,
    // Мета-теги пака
    showPackMetaModal,
    closePackMetaModal,
    loadPackMetaTags,
    addPackMetaTag,
    deletePackMetaTag,
    packMetaTags,
    loadingPackMeta,
    newPackMetaKey,
    newPackMetaValue,
    // Участники
    removeMemberFromPanel,
    generateMembersApiUrl,
    showMembersUrlModal,
    showTopicsUrlModal,
    // URL модалка
    isUrlModalOpen: urlModal.isOpen,
    showUrlModal,
    urlModalTitle,
    urlModalUrl,
    urlCopyButtonText,
    closeUrlModal: urlModal.close,
    copyUrlToClipboard,
  };
}
