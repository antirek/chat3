import { onMounted, toRef } from 'vue';
import { useConfigStore } from '@/app/stores/config';
import { useCredentialsStore } from '@/app/stores/credentials';
import { usePacks } from './usePacks';
import { usePackDialogs } from './usePackDialogs';
import { usePackMessages } from './usePackMessages';
import { usePackUsers } from './usePackUsers';
import { usePackModals } from './usePackModals';
import { useUtils } from './useUtils';

export function usePacksPage() {
  const configStore = useConfigStore();
  const credentialsStore = useCredentialsStore();

  const apiKey = toRef(credentialsStore, 'apiKey');
  const tenantId = toRef(credentialsStore, 'tenantId');

  function getApiKey() {
    return apiKey.value;
  }

  const packsModule = usePacks(getApiKey, configStore, credentialsStore);
  const {
    packs,
    loading,
    error,
    currentPage,
    currentLimit,
    totalPages,
    totalPacks,
    currentPageInput,
    paginationStart,
    paginationEnd,
    filterInput,
    selectedFilterExample,
    currentFilter,
    currentSort,
    loadPacks,
    formatTimestamp,
    getSortIndicator,
    toggleSort,
    selectPackFilterExample,
    clearPackFilter,
    applyPackFilter,
  } = packsModule;

  const packDialogsModule = usePackDialogs(getApiKey, configStore, credentialsStore);
  const {
    selectedPackId,
    packDialogs,
    packDialogsLoading,
    packDialogsError,
    packDialogsPage,
    packDialogsLimit,
    packDialogsTotal,
    packDialogsTotalPages,
    packDialogsPaginationStart,
    packDialogsPaginationEnd,
    loadPackDialogs,
    selectPack,
    goToPackDialogsPage,
    changePackDialogsLimit,
  } = packDialogsModule;

  const packMessagesModule = usePackMessages(getApiKey, configStore, credentialsStore, selectedPackId);
  const {
    packMessages,
    packMessagesLoading,
    packMessagesError,
    packMessagesHasMore,
    packMessagesCursor,
    packMessagesLimit,
    packMessagesFilterValue,
    selectedMessageFilterExample,
    loadInitialPackMessages,
    loadMorePackMessages,
    changePackMessagesLimit,
    resetPackMessages,
    applyPackMessagesFilter,
    clearPackMessagesFilter,
  } = packMessagesModule;

  const packUsersModule = usePackUsers(getApiKey, configStore, credentialsStore, selectedPackId);
  const {
    packUsers,
    packUsersLoading,
    packUsersError,
    packUsersFilterValue,
    packUsersPage,
    packUsersLimit,
    packUsersTotal,
    packUsersTotalPages,
    packUsersPaginationStart,
    packUsersPaginationEnd,
    packUsersPaginated,
    loadPackUsers,
    goToPackUsersPage,
    changePackUsersLimit,
  } = packUsersModule;

  const modalsModule = usePackModals(
    getApiKey,
    configStore,
    credentialsStore,
    currentPage,
    currentLimit,
    currentFilter,
    currentSort,
    loadPacks,
  );
  const {
    createModal,
    addDialogModal,
    markAllReadModal,
    addDialogPackId,
    addDialogDialogId,
    markAllReadPackId,
    markAllReadSubmitting,
    markAllReadError,
    metaModal,
    infoModal,
    dialogInfoModal,
    urlModal,
    metaTags,
    newMetaKeyForEdit,
    newMetaValueForEdit,
    infoUrl,
    jsonViewerContent,
    copyJsonButtonText,
    dialogInfoUrl,
    dialogInfoJsonContent,
    dialogInfoCopyButtonText,
    generatedUrl,
    copyUrlButtonText,
    showCreateModal,
    createPack,
    showAddDialogModal,
    closeAddDialogModal,
    addDialogToPack,
    showMarkAllReadModal,
    closeMarkAllReadModal,
    markPackAllReadForAllUsers,
    showMetaModal,
    closeMetaModal,
    addMetaTag,
    deleteMetaTag,
    showInfoModal,
    copyJsonToClipboard,
    showDialogInfoModal,
    closeDialogInfoModal,
    copyDialogJsonToClipboard,
    deletePack,
    showUrlModal,
    showUrlWithUrl,
    copyUrlToClipboard,
  } = modalsModule;

  function getPackTabUrl(tab: 'dialogs' | 'messages' | 'users'): string {
    const base = configStore.config.TENANT_API_URL || 'http://localhost:3000';
    const packId = selectedPackId.value;
    if (!packId) return '';
    if (tab === 'dialogs') {
      return `${base}/api/packs/${encodeURIComponent(packId)}/dialogs?page=${packDialogsPage.value}&limit=${packDialogsLimit.value}`;
    }
    if (tab === 'messages') {
      const p = new URLSearchParams({ limit: packMessagesLimit.value.toString() });
      if (packMessagesFilterValue.value.trim()) p.set('filter', packMessagesFilterValue.value.trim());
      return `${base}/api/packs/${encodeURIComponent(packId)}/messages?${p.toString()}`;
    }
    if (tab === 'users') return `${base}/api/packs/${encodeURIComponent(packId)}/users`;
    return '';
  }

  const utilsModule = useUtils(credentialsStore, apiKey, tenantId, loadPacks);
  const { getUrlParams, setApiKeyFromExternal } = utilsModule;

  onMounted(() => {
    credentialsStore.loadFromStorage();

    const params = getUrlParams();
    if (params.apiKey) {
      setApiKeyFromExternal(params.apiKey, params.tenantId);
    } else {
      const key = getApiKey();
      if (key) {
        loadPacks(1);
      }
    }

    window.addEventListener('message', (event) => {
      if (event.data?.type === 'setApiCredentials') {
        setApiKeyFromExternal(event.data.apiKey, event.data.tenantId);
      }
    });

    window.addEventListener('credentials-applied', () => {
      if (getApiKey()) {
        loadPacks(1);
      }
    });
  });

  return {
    packs,
    loading,
    error,
    selectedPackId,
    packDialogs,
    packDialogsLoading,
    packDialogsError,
    packDialogsPage,
    packDialogsLimit,
    packDialogsTotal,
    packDialogsTotalPages,
    packDialogsPaginationStart,
    packDialogsPaginationEnd,
    loadPackDialogs,
    selectPack,
    goToPackDialogsPage,
    changePackDialogsLimit,
    packMessages,
    packMessagesLoading,
    packMessagesError,
    packMessagesHasMore,
    packMessagesCursor,
    packMessagesLimit,
    packMessagesFilterValue,
    loadInitialPackMessages,
    loadMorePackMessages,
    changePackMessagesLimit,
    resetPackMessages,
    applyPackMessagesFilter,
    clearPackMessagesFilter,
    selectedMessageFilterExample,
    packUsers,
    packUsersLoading,
    packUsersError,
    packUsersFilterValue,
    packUsersPage,
    packUsersLimit,
    packUsersTotal,
    packUsersTotalPages,
    packUsersPaginationStart,
    packUsersPaginationEnd,
    packUsersPaginated,
    loadPackUsers,
    goToPackUsersPage,
    changePackUsersLimit,
    currentPage,
    currentLimit,
    totalPages,
    totalPacks,
    currentPageInput,
    paginationStart,
    paginationEnd,
    filterInput,
    selectedFilterExample,
    currentFilter,
    currentSort,
    showCreateModalFlag: createModal.isOpen,
    showAddDialogModalFlag: modalsModule.addDialogModal.isOpen,
    addDialogPackId: modalsModule.addDialogPackId,
    addDialogDialogId: modalsModule.addDialogDialogId,
    showMarkAllReadModalFlag: markAllReadModal.isOpen,
    markAllReadPackId,
    markAllReadSubmitting,
    markAllReadError,
    showMetaModalFlag: metaModal.isOpen,
    showInfoModalFlag: infoModal.isOpen,
    showDialogInfoModalFlag: dialogInfoModal.isOpen,
    dialogInfoUrl,
    dialogInfoJsonContent,
    dialogInfoCopyButtonText,
    showUrlModalFlag: urlModal.isOpen,
    metaTags,
    newMetaKeyForEdit,
    newMetaValueForEdit,
    infoUrl,
    jsonViewerContent,
    copyJsonButtonText,
    generatedUrl,
    copyUrlButtonText,
    loadPacks,
    goToFirstPage: packsModule.pagination.goToFirstPage,
    goToPreviousPage: packsModule.pagination.goToPreviousPage,
    goToNextPage: packsModule.pagination.goToNextPage,
    goToLastPage: packsModule.pagination.goToLastPage,
    goToPage: packsModule.pagination.goToPage,
    changeLimit: packsModule.pagination.changeLimit,
    getSortIndicator,
    toggleSort,
    formatTimestamp,
    showCreateModal,
    closeCreateModal: createModal.close,
    createPack,
    showAddDialogModal,
    closeAddDialogModal,
    addDialogToPack,
    onUpdateAddDialogDialogId: (v: string) => { addDialogDialogId.value = v; },
    showMarkAllReadModal,
    closeMarkAllReadModal,
    markPackAllReadForAllUsers,
    showMetaModal,
    closeMetaModal,
    addMetaTag,
    deleteMetaTag,
    showInfoModal,
    closeInfoModal: infoModal.close,
    copyJsonToClipboard,
    showDialogInfoModal,
    closeDialogInfoModal: dialogInfoModal.close,
    copyDialogJsonToClipboard,
    deletePack,
    selectPackFilterExample,
    clearPackFilter,
    applyPackFilter,
    showUrlModal,
    showUrlWithUrl,
    getPackTabUrl,
    closeUrlModal: urlModal.close,
    copyUrlToClipboard,
  };
}
