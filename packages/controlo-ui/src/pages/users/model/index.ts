import { onMounted, toRef } from 'vue';
import { useConfigStore } from '@/app/stores/config';
import { useCredentialsStore } from '@/app/stores/credentials';
import { useUsers } from './useUsers';
import { useUserModals } from './useUserModals';
import { useUtils } from './useUtils';

export function useUsersPage() {
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

  // Пользователи
  const usersModule = useUsers(getApiKey, configStore, credentialsStore);
  const {
    users,
    loading,
    error,
    pagination,
    currentPage,
    currentLimit,
    totalPages,
    totalUsers,
    currentPageInput,
    paginationStart,
    paginationEnd,
    filterInput,
    selectedFilterExample,
    currentFilter,
    sort,
    currentSort,
    loadUsers,
    formatTimestamp,
    selectUserFilterExample,
    clearUserFilter,
    applyUserFilter,
  } = usersModule;

  // Модальные окна
  const modalsModule = useUserModals(
    getApiKey,
    configStore,
    credentialsStore,
    currentPage,
    currentLimit,
    currentFilter,
    currentSort,
    loadUsers,
  );
  const {
    createModal,
    editModal,
    metaModal,
    infoModal,
    urlModal,
    createUserId,
    createType,
    editUserId,
    editType,
    metaUserId,
    metaTags,
    newMetaKeyForEdit,
    newMetaValueForEdit,
    userInfoUrl,
    jsonViewerContent,
    copyJsonButtonText,
    generatedUrl,
    copyUrlButtonText,
    showCreateModal,
    createUser,
    showEditModal,
    updateUser,
    deleteUser,
    showMetaModal,
    addMetaTag,
    deleteMetaTag,
    showInfoModal,
    copyJsonToClipboard,
    showUrlModal,
    copyUrlToClipboard,
  } = modalsModule;

  // Утилиты
  const utilsModule = useUtils(credentialsStore, apiKey, tenantId, loadUsers);
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
      // Если нет URL параметров, но есть API Key в store, загружаем пользователей
      const key = getApiKey();
      if (key) {
        loadUsers(1);
      }
    }

    // Слушаем событие применения credentials из AppLayout
    window.addEventListener('credentials-applied', () => {
      // Перезагружаем данные при применении новых credentials
      const key = getApiKey();
      if (key) {
        loadUsers(1);
      }
    });
  });

  return {
    // State
    users,
    loading,
    error,
    // Pagination (из composable)
    currentPage,
    currentLimit,
    totalPages,
    totalUsers,
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
    showEditModalFlag: editModal.isOpen,
    showMetaModalFlag: metaModal.isOpen,
    showInfoModalFlag: infoModal.isOpen,
    showUrlModalFlag: urlModal.isOpen,
    // Создание пользователя
    createUserId,
    createType,
    // Редактирование пользователя
    editUserId,
    editType,
    // Meta теги
    metaUserId,
    metaTags,
    newMetaKeyForEdit,
    newMetaValueForEdit,
    // Info modal
    userInfoUrl,
    jsonViewerContent,
    copyJsonButtonText,
    // URL modal
    generatedUrl,
    copyUrlButtonText,
    // Functions
    loadUsers,
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
    createUser,
    showEditModal,
    closeEditModal: editModal.close,
    updateUser,
    showMetaModal,
    closeMetaModal: metaModal.close,
    addMetaTag,
    deleteMetaTag,
    showInfoModal,
    closeInfoModal: infoModal.close,
    copyJsonToClipboard,
    deleteUser,
    selectUserFilterExample,
    clearUserFilter,
    applyUserFilter,
    showUrlModal,
    closeUrlModal: urlModal.close,
    copyUrlToClipboard,
  };
}
