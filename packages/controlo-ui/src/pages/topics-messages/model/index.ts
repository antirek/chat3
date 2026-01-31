import { ref, computed, onMounted, toRef, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useConfigStore } from '@/app/stores/config';
import { useCredentialsStore } from '@/app/stores/credentials';
import { useModal } from '@/shared/lib/composables/useModal';
import { getTenantApiUrl } from '@/shared/lib/utils/url';
import { useTopicsList } from './useTopicsList';
import { useMessagesByTopic } from './useMessagesByTopic';
import { useTopicMetaModal } from './useTopicMetaModal';
import { useTopicsMessagesUtils } from './useUtils';
import { useMembers } from '@/pages/dialogs-messages/model/useMembers';

export function useTopicsMessagesPage() {
  const router = useRouter();
  const configStore = useConfigStore();
  const credentialsStore = useCredentialsStore();
  const apiKey = toRef(credentialsStore, 'apiKey');
  const tenantId = toRef(credentialsStore, 'tenantId');

  function getApiKey() {
    return apiKey.value;
  }

  const selectedTopicId = ref<string | null>(null);
  const selectedDialogId = ref<string | null>(null);
  const selectedTopicKey = computed(() => selectedTopicId.value);

  const topicsModule = useTopicsList(getApiKey);
  const {
    topics,
    loadingTopics,
    topicsError,
    filterValue,
    sortValue,
    selectedFilterExample,
    selectedSortExample,
    applying,
    applyButtonText,
    showTopicsPagination,
    topicsPagination,
    topicsSort,
    loadTopics,
    applyCombined,
    toggleSort,
    getSortIndicator,
    buildTopicsUrl,
  } = topicsModule;

  const topicMetaModule = useTopicMetaModal(getApiKey, loadTopics);
  const {
    topicMetaModal,
    topicMetaTags,
    loadingTopicMeta,
    newTopicMetaKey,
    newTopicMetaValue,
    showTopicMetaModal,
    closeTopicMetaModal,
    addTopicMetaTag,
    deleteTopicMetaTag,
  } = topicMetaModule;

  const messagesModule = useMessagesByTopic(getApiKey, selectedDialogId, selectedTopicId);
  const {
    messages,
    loadingMessages,
    messagesError,
    messageFilterValue,
    selectedMessageFilterExample,
    showMessagesPagination,
    messagesPagination,
    loadMessages,
    applyMessageFilter,
    clearMessageFilter,
    toggleMessageSort,
    getMessageSortIndicator,
    formatTimestamp,
    buildMessagesUrl,
    currentMessageSort,
  } = messagesModule;

  const membersModule = useMembers(getApiKey);
  const {
    members,
    loadingMembers,
    membersError,
    membersPagination,
    loadDialogMembers,
    clearMembers,
  } = membersModule;

  const currentRightTab = ref<'messages' | 'members'>('messages');

  function selectMessagesTab() {
    currentRightTab.value = 'messages';
  }

  function selectMembersTab() {
    currentRightTab.value = 'members';
    if (selectedDialogId.value) {
      loadDialogMembers(selectedDialogId.value, 1);
    }
  }

  const showMembersPagination = computed(
    () => selectedDialogId.value !== null && membersPagination.totalItems.value > 0
  );

  watch(selectedDialogId, (id) => {
    if (!id) clearMembers();
  });

  const infoModal = useModal();
  const urlModal = useModal();
  const modalTitle = ref('Информация');
  const modalUrl = ref<string | null>(null);
  const modalJsonContent = ref<string | null>(null);
  const modalOtherContent = ref<string | null>(null);
  const urlModalTitle = ref('');
  const urlModalUrl = ref('');
  const urlCopyButtonText = ref('📋 Скопировать URL');

  const utils = useTopicsMessagesUtils(
    urlModalUrl,
    urlCopyButtonText,
    modalTitle,
    modalUrl,
    modalJsonContent,
    modalOtherContent,
    infoModal,
    credentialsStore,
    apiKey,
    loadTopics,
  );
  const { showTopicInfoModal, closeModal, getUrlParams, setApiKeyFromExternal, copyUrlToClipboard } = utils;

  async function showDialogInfoForTopic(dialogId: string) {
    const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
    modalTitle.value = 'Диалог';
    modalUrl.value = `${baseUrl}/api/dialogs/${dialogId}`;
    modalJsonContent.value = null;
    modalOtherContent.value = null;
    try {
      const url = getTenantApiUrl(`/api/dialogs/${dialogId}`);
      const response = await fetch(url, { headers: credentialsStore.getHeaders() });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      modalJsonContent.value = JSON.stringify(data.data ?? data, null, 2);
    } catch (err) {
      modalJsonContent.value = JSON.stringify({ error: err instanceof Error ? err.message : 'Ошибка загрузки' }, null, 2);
    }
    infoModal.open();
  }

  function goToDialogsMessagesPage(dialogId: string) {
    router.push({
      path: '/dialogs-messages',
      query: { filter: `(dialogId,eq,${dialogId})` },
    });
  }

  function selectTopic(topic: { topicId: string; dialogId: string }) {
    selectedTopicId.value = topic.topicId;
    selectedDialogId.value = topic.dialogId;
    clearMembers();
  }

  function goToMembersPage(page: number) {
    if (selectedDialogId.value) {
      membersPagination.currentPage.value = page;
      membersPagination.currentPageInput.value = page;
      loadDialogMembers(selectedDialogId.value, page);
    }
  }

  function goToMembersFirstPage() {
    membersPagination.goToFirstPage();
    if (selectedDialogId.value) loadDialogMembers(selectedDialogId.value, 1);
  }
  function goToMembersPreviousPage() {
    if (membersPagination.currentPage.value <= 1) return;
    const page = membersPagination.currentPage.value - 1;
    membersPagination.currentPage.value = page;
    membersPagination.currentPageInput.value = page;
    if (selectedDialogId.value) loadDialogMembers(selectedDialogId.value, page);
  }
  function goToMembersNextPage() {
    if (membersPagination.currentPage.value >= membersPagination.totalPages.value) return;
    const page = membersPagination.currentPage.value + 1;
    membersPagination.currentPage.value = page;
    membersPagination.currentPageInput.value = page;
    if (selectedDialogId.value) loadDialogMembers(selectedDialogId.value, page);
  }
  function goToMembersLastPage() {
    membersPagination.goToLastPage();
    if (selectedDialogId.value) loadDialogMembers(selectedDialogId.value, membersPagination.totalPages.value);
  }
  function changeMemberLimit(limit: number) {
    membersPagination.changeLimit(limit);
    if (selectedDialogId.value) loadDialogMembers(selectedDialogId.value, 1, limit);
  }

  function showTopicInfo(topic: Record<string, unknown>) {
    showTopicInfoModal(topic);
  }

  function showMessageInfo(message: Record<string, unknown> & { messageId?: string }) {
    modalTitle.value = 'Сообщение';
    const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
    modalUrl.value = message.messageId ? `${baseUrl}/api/messages/${message.messageId}` : null;
    modalJsonContent.value = JSON.stringify(message, null, 2);
    modalOtherContent.value = null;
    infoModal.open();
  }

  function showTopicMeta(topic: { topicId: string; dialogId: string }) {
    showTopicMetaModal(topic.dialogId, topic.topicId);
  }

  function setNewTopicMetaKey(v: string) {
    newTopicMetaKey.value = v;
  }
  function setNewTopicMetaValue(v: string) {
    newTopicMetaValue.value = v;
  }

  function showCurrentUrl() {
    const url = buildTopicsUrl();
    urlModalTitle.value = 'URL запроса топиков';
    urlModalUrl.value = url;
    urlModal.open();
  }

  function showCurrentMessageUrl() {
    const url = buildMessagesUrl();
    if (!url) return;
    urlModalTitle.value = 'URL запроса сообщений топика';
    urlModalUrl.value = url;
    urlModal.open();
  }

  function closeUrlModal() {
    urlModal.close();
  }

  onMounted(() => {
    credentialsStore.loadFromStorage();
    const params = getUrlParams();
    if (params.apiKey) {
      setApiKeyFromExternal(params.apiKey, params.tenantId);
    } else {
      const key = getApiKey();
      if (key?.trim()) {
        loadTopics(1);
      } else {
        loadingTopics.value = false;
      }
    }
    window.addEventListener('credentials-applied', () => {
      const key = getApiKey();
      if (key?.trim()) loadTopics(1);
    });
  });

  return {
    topics,
    loadingTopics,
    topicsError,
    filterValue,
    sortValue,
    selectedFilterExample,
    selectedSortExample,
    applying,
    applyButtonText,
    showTopicsPagination,
    topicsPagination,
    currentSort: topicsSort.currentSort,
    loadTopics,
    applyCombined,
    toggleSort,
    getSortIndicator,
    showCurrentUrl,
    selectTopic,
    selectedTopicId,
    selectedDialogId,
    selectedTopicKey,
    showTopicInfo,
    showMessageInfo,
    showDialogInfoForTopic,
    goToDialogsMessagesPage,
    showTopicMeta,
    isTopicMetaModalOpen: topicMetaModal.isOpen,
    topicMetaTags,
    loadingTopicMeta,
    newTopicMetaKey,
    newTopicMetaValue,
    closeTopicMetaModal,
    addTopicMetaTag,
    deleteTopicMetaTag,
    setNewTopicMetaKey,
    setNewTopicMetaValue,
    currentRightTab,
    selectMessagesTab,
    selectMembersTab,
    members,
    loadingMembers,
    membersError,
    membersPagination,
    showMembersPagination,
    goToMembersPage,
    goToMembersFirstPage,
    goToMembersPreviousPage,
    goToMembersNextPage,
    goToMembersLastPage,
    changeMemberLimit,
    messages,
    loadingMessages,
    messagesError,
    messageFilterValue,
    selectedMessageFilterExample,
    showMessagesPagination,
    messagesPagination,
    currentMessageSort,
    loadMessages,
    applyMessageFilter,
    clearMessageFilter,
    toggleMessageSort,
    getMessageSortIndicator,
    formatTimestamp,
    showCurrentMessageUrl,
    showInfoModalFlag: infoModal.isOpen,
    modalTitle,
    modalUrl,
    modalJsonContent,
    modalOtherContent,
    closeModal,
    showUrlModal: urlModal.isOpen,
    urlModalTitle,
    urlModalUrl,
    urlCopyButtonText,
    closeUrlModal,
    copyUrlToClipboard,
  };
}
