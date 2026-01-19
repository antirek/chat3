import { onMounted, toRef } from 'vue';
import { useConfigStore } from '@/app/stores/config';
import { useCredentialsStore } from '@/app/stores/credentials';
import { useTenants } from './useTenants';
import { useTenantModals } from './useTenantModals';
import { useUtils } from './useUtils';

export function useTenantsPage() {
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

  // Тенанты
  const tenantsModule = useTenants(getApiKey, configStore, credentialsStore);
  const {
    tenants,
    loading,
    error,
    pagination,
    currentPage,
    currentLimit,
    totalPages,
    totalTenants,
    currentPageInput,
    paginationStart,
    paginationEnd,
    filterInput,
    selectedFilterExample,
    currentFilter,
    sort,
    currentSort,
    loadTenants,
    formatTimestamp,
    selectTenantFilterExample,
    clearTenantFilter,
    applyTenantFilter,
  } = tenantsModule;

  // Модальные окна
  const modalsModule = useTenantModals(
    getApiKey,
    configStore,
    credentialsStore,
    currentPage,
    currentLimit,
    currentFilter,
    currentSort,
    loadTenants,
  );
  const {
    createModal,
    metaModal,
    infoModal,
    urlModal,
    createTenantId,
    createMetaTags,
    newMetaKey,
    newMetaValue,
    metaTenantId,
    metaTags,
    newMetaKeyForEdit,
    newMetaValueForEdit,
    infoUrl,
    jsonViewerContent,
    copyJsonButtonText,
    generatedUrl,
    copyUrlButtonText,
    showCreateModal,
    addCreateMetaTag,
    removeCreateMetaTag,
    createTenant,
    showMetaModal,
    closeMetaModal,
    addMetaTag,
    deleteMetaTag,
    showInfoModal,
    copyJsonToClipboard,
    deleteTenant,
    showUrlModal,
    copyUrlToClipboard,
  } = modalsModule;

  // Утилиты
  const utilsModule = useUtils(credentialsStore, apiKey, tenantId, loadTenants);
  const { getUrlParams, setApiKeyFromExternal } = utilsModule;

  // Инициализация
  onMounted(() => {
    // Загружаем credentials из store (они уже загружены из localStorage при создании store)
    credentialsStore.loadFromStorage();

    // Проверяем URL параметры (для обратной совместимости с iframe)
    const params = getUrlParams();
    if (params.apiKey) {
      setApiKeyFromExternal(params.apiKey, params.tenantId);
    } else {
      // Если нет URL параметров, но есть API Key в store, загружаем тенантов
      const key = getApiKey();
      if (key) {
        loadTenants(1);
      }
    }

    // Обработка сообщений от родительского окна (для обратной совместимости)
    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'setApiCredentials') {
        setApiKeyFromExternal(event.data.apiKey, event.data.tenantId);
      }
    });
  });

  return {
    // State
    tenants,
    loading,
    error,
    // Pagination (из composable)
    currentPage,
    currentLimit,
    totalPages,
    totalTenants,
    currentPageInput,
    paginationStart,
    paginationEnd,
    // Filter (из composable)
    filterInput,
    selectedFilterExample,
    currentFilter,
    // Sort (из composable)
    currentSort,
    // Modals (из composable)
    showCreateModalFlag: createModal.isOpen,
    showMetaModalFlag: metaModal.isOpen,
    showInfoModalFlag: infoModal.isOpen,
    showUrlModalFlag: urlModal.isOpen,
    // Создание тенанта
    createTenantId,
    createMetaTags,
    newMetaKey,
    newMetaValue,
    // Meta теги
    metaTenantId,
    metaTags,
    newMetaKeyForEdit,
    newMetaValueForEdit,
    // Info modal
    infoUrl,
    jsonViewerContent,
    copyJsonButtonText,
    // URL modal
    generatedUrl,
    copyUrlButtonText,
    // Functions
    loadTenants,
    goToFirstPage: pagination.goToFirstPage,
    goToPreviousPage: pagination.goToPreviousPage,
    goToNextPage: pagination.goToNextPage,
    goToLastPage: pagination.goToLastPage,
    goToPage: pagination.goToPage,
    changeLimit: pagination.changeLimit,
    getSortIndicator: sort.getSortIndicator,
    toggleSort: sort.toggleSort,
    formatTimestamp,
    showCreateModal,
    closeCreateModal: createModal.close,
    addCreateMetaTag,
    removeCreateMetaTag,
    createTenant,
    showMetaModal,
    closeMetaModal,
    addMetaTag,
    deleteMetaTag,
    showInfoModal,
    closeInfoModal: infoModal.close,
    copyJsonToClipboard,
    deleteTenant,
    selectTenantFilterExample,
    clearTenantFilter,
    applyTenantFilter,
    showUrlModal,
    closeUrlModal: urlModal.close,
    copyUrlToClipboard,
  };
}
