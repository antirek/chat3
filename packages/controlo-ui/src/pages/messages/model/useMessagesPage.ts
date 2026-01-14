/* eslint-env browser */
/* global alert, confirm */
import { ref, computed, onMounted, toRef } from 'vue';
import { useConfigStore } from '@/app/stores/config';
import { useCredentialsStore } from '@/app/stores/credentials';
import { usePagination } from '@/shared/lib/composables/usePagination';
import { useFilter } from '@/shared/lib/composables/useFilter';
import { useModal } from '@/shared/lib/composables/useModal';

export function useMessagesPage() {
  // Конфигурация
  const configStore = useConfigStore();
  const credentialsStore = useCredentialsStore();

  // Используем credentials из store (toRef для правильной типизации)
  const apiKey = toRef(credentialsStore, 'apiKey');
  const tenantId = toRef(credentialsStore, 'tenantId');
  
  // Данные
  const messages = ref<any[]>([]);
  const dialogs = ref<any[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Функция загрузки данных (нужна для callbacks)
  let loadMessagesFn: (page: number) => Promise<void>;

  // Используем общие composables
  const pagination = usePagination({
    initialPage: 1,
    initialLimit: 20,
    onPageChange: (page, limit) => {
      if (loadMessagesFn) {
        loadMessagesFn(page);
      }
    },
  });

  const filter = useFilter({
    initialFilter: '',
    // onFilterChange не нужен, так как загрузка происходит в applyMessageFilter
  });

  // Сортировка (специфичная для messages - формат (field,asc)/(field,desc))
  const currentSort = ref<string | null>(null);

  // Модальные окна
  const infoModal = useModal();
  const metaModal = useModal();
  const urlModal = useModal();

  // Meta теги
  const metaMessageId = ref('');
  const metaTags = ref<Record<string, any> | null>(null);
  const newMetaKeyForEdit = ref('');
  const newMetaValueForEdit = ref('');

  // Info modal
  const infoUrl = ref('');
  const jsonViewerContent = ref('');
  const currentJsonForCopy = ref('');
  const copyJsonButtonText = ref('📋 Копировать JSON');

  // URL modal
  const generatedUrl = ref('');
  const copyUrlButtonText = ref('📋 Скопировать');

  // Computed для пагинации (видимые страницы)
  const visiblePages = computed(() => {
    const startPage = Math.max(1, pagination.currentPage.value - 2);
    const endPage = Math.min(pagination.totalPages.value, pagination.currentPage.value + 2);
    const pages: number[] = [];
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  });

  const fullUrl = computed(() => {
    const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
    return `${baseUrl}${generatedUrl.value}`;
  });

  // Функции
  function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return {
      apiKey: params.get('apiKey') || '',
      tenantId: params.get('tenantId') || 'tnt_default',
    };
  }

  function setApiKeyFromExternal(extApiKey: string, extTenantId?: string) {
    if (!extApiKey) {
      console.warn('API Key не предоставлен');
      return;
    }

    credentialsStore.setCredentials(extApiKey, extTenantId);

    console.log('API Key set from external:', apiKey.value);
    console.log('Tenant ID set from external:', tenantId.value);

    loadMessages(1);
  }

  function getApiKey() {
    return apiKey.value;
  }

  async function loadDialogs() {
    try {
      const key = getApiKey();
      if (!key) {
        return;
      }

      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const response = await fetch(`${baseUrl}/api/dialogs?limit=100`, {
        headers: credentialsStore.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      dialogs.value = data.data || [];
    } catch (err) {
      console.error('Error loading dialogs:', err);
    }
  }

  async function loadMessages(page = pagination.currentPage.value) {
    try {
      const key = getApiKey();

      if (!key) {
        // Не показываем ошибку, если просто нет API Key - это нормально
        error.value = null;
        messages.value = [];
        loading.value = false;
        return;
      }

      // Обновляем страницу без вызова callback, чтобы избежать бесконечного цикла
      if (pagination.currentPage.value !== page) {
        pagination.currentPage.value = page;
        pagination.currentPageInput.value = page;
      }
      loading.value = true;
      error.value = null;

      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.currentLimit.value.toString(),
      });

      if (filter.currentFilter.value) {
        params.append('filter', filter.currentFilter.value);
      }

      if (currentSort.value) {
        params.append('sort', currentSort.value);
      }

      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const url = `${baseUrl}/api/messages?${params.toString()}`;
      
      const response = await fetch(url, {
        headers: credentialsStore.getHeaders(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      pagination.setPaginationData(data.pagination?.total || 0, data.pagination?.pages || 1);

      if (data.data && data.data.length > 0) {
        messages.value = data.data;
      } else {
        messages.value = [];
      }
    } catch (err) {
      console.error('Error loading messages:', err);
      if (err instanceof TypeError && err.message.includes('fetch')) {
        error.value = 'Не удалось подключиться к серверу. Проверьте, что backend сервер запущен на порту 3000.';
      } else {
        error.value = err instanceof Error ? err.message : 'Ошибка загрузки';
      }
      messages.value = [];
    } finally {
      loading.value = false;
    }
  }

  // Сохраняем ссылку на функцию для callbacks
  loadMessagesFn = loadMessages;

  function getDialogName(dialogId: string) {
    const dialog = dialogs.value.find((d) => d.dialogId === dialogId);
    return dialog ? dialog.dialogId : dialogId;
  }

  function formatTimestamp(timestamp: string | number | undefined) {
    if (!timestamp) return '-';
    const ts = typeof timestamp === 'string' ? parseFloat(timestamp) : timestamp;
    const date = new Date(ts);
    return date.toLocaleString('ru-RU');
  }

  function getSortIndicator(field: string) {
    if (!currentSort.value || !currentSort.value.includes(field)) {
      return '◄';
    } else if (currentSort.value.includes('asc')) {
      return '▲';
    } else {
      return '▼';
    }
  }

  function toggleSort(field: string) {
    if (!currentSort.value || !currentSort.value.includes(field)) {
      currentSort.value = `(${field},asc)`;
    } else if (currentSort.value.includes('asc')) {
      currentSort.value = `(${field},desc)`;
    } else {
      currentSort.value = null;
    }
    loadMessages(1);
  }

  async function showInfoModal(messageIdParam: string) {
    try {
      getApiKey(); // Проверка наличия ключа
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const url = `${baseUrl}/api/messages/${messageIdParam}`;

      infoUrl.value = url;

      const response = await fetch(url, {
        headers: credentialsStore.getHeaders(),
      });

      const responseData = await response.json();

      if (!response.ok) {
        const errorJson = JSON.stringify(
          {
            status: response.status,
            statusText: response.statusText,
            error: responseData,
          },
          null,
          2,
        );
        jsonViewerContent.value = errorJson;
        currentJsonForCopy.value = errorJson;
      } else {
        const jsonStr = JSON.stringify(responseData, null, 2);
        jsonViewerContent.value = jsonStr;
        currentJsonForCopy.value = jsonStr;
      }

      infoModal.open();
      copyJsonButtonText.value = '📋 Копировать JSON';
    } catch (err) {
      console.error('Error showing info modal:', err);
      const errorJson = JSON.stringify(
        {
          error: err instanceof Error ? err.message : 'Unknown error',
        },
        null,
        2,
      );
      jsonViewerContent.value = errorJson;
      currentJsonForCopy.value = errorJson;
      infoModal.open();
    }
  }

  async function copyJsonToClipboard() {
    const jsonText = jsonViewerContent.value || currentJsonForCopy.value;

    if (!jsonText) {
      alert('Нет данных для копирования');
      return;
    }

    try {
      await navigator.clipboard.writeText(jsonText);
      copyJsonButtonText.value = '✅ Скопировано!';
      setTimeout(() => {
        copyJsonButtonText.value = '📋 Копировать JSON';
      }, 2000);
    } catch (err) {
      console.error('Failed to copy JSON:', err);
      alert('Не удалось скопировать JSON');
    }
  }

  async function showMetaModal(messageIdValue: string) {
    metaMessageId.value = messageIdValue;
    await loadMetaTags(messageIdValue);
    metaModal.open();
  }

  async function loadMetaTags(messageIdValue: string) {
    try {
      getApiKey(); // Проверка наличия ключа
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';

      const response = await fetch(`${baseUrl}/api/messages/${messageIdValue}`, {
        headers: credentialsStore.getHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to load message meta');
      }

      const { data: message } = await response.json();
      metaTags.value = message.meta || {};
    } catch (err) {
      console.error('Error loading meta tags:', err);
      alert('Ошибка загрузки мета-тегов: ' + (err instanceof Error ? err.message : 'Unknown error'));
      metaTags.value = null;
    }
  }

  async function addMetaTag() {
    if (metaMessageId.value && newMetaKeyForEdit.value && newMetaValueForEdit.value) {
      try {
        getApiKey(); // Проверка наличия ключа
        const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
        const url = `${baseUrl}/api/meta/message/${metaMessageId.value}/${newMetaKeyForEdit.value}`;

        let value: any;
        try {
          value = JSON.parse(newMetaValueForEdit.value);
        } catch {
          value = newMetaValueForEdit.value;
        }

        const response = await fetch(url, {
          method: 'PUT',
          headers: {
            ...credentialsStore.getHeaders(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ value }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to set meta tag');
        }

        alert('Meta тег успешно добавлен!');
        newMetaKeyForEdit.value = '';
        newMetaValueForEdit.value = '';
        await loadMetaTags(metaMessageId.value);
      } catch (err) {
        console.error('Error adding meta tag:', err);
        alert('Ошибка добавления meta тега: ' + (err instanceof Error ? err.message : 'Unknown error'));
      }
    } else {
      alert('Заполните ключ и значение');
    }
  }

  async function deleteMetaTag(key: string) {
    if (!confirm(`Удалить meta тег "${key}"?`)) {
      return;
    }

    if (metaMessageId.value && key) {
      try {
        getApiKey(); // Проверка наличия ключа
        const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
        const url = `${baseUrl}/api/meta/message/${metaMessageId.value}/${key}`;

        const response = await fetch(url, {
          method: 'DELETE',
          headers: credentialsStore.getHeaders(),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to delete meta tag');
        }

        alert('Meta тег успешно удален!');
        await loadMetaTags(metaMessageId.value);
      } catch (err) {
        console.error('Error deleting meta tag:', err);
        alert('Ошибка удаления meta тега: ' + (err instanceof Error ? err.message : 'Unknown error'));
      }
    }
  }

  function selectMessageFilterExample() {
    // selectedFilterExample уже обновлен через v-model к моменту вызова @change
    const selected = filter.selectedFilterExample.value;
    
    if (selected && selected !== 'custom') {
      filter.filterInput.value = selected;
    } else if (selected === 'custom') {
      filter.filterInput.value = '';
    }
  }

  function clearMessageFilter() {
    filter.clearFilter();
    currentSort.value = null;
    loadMessages(1);
  }

  function applyMessageFilter() {
    const filterValue = filter.filterInput.value.trim();

    if (!filterValue) {
      alert('Введите фильтр сообщений');
      return;
    }

    // Устанавливаем currentFilter напрямую из filterInput
    filter.currentFilter.value = filterValue;
    pagination.currentPage.value = 1;
    pagination.currentPageInput.value = 1;
    loadMessages(1);
  }

  function generateApiUrl() {
    const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
    const params = new URLSearchParams({
      page: pagination.currentPage.value.toString(),
      limit: pagination.currentLimit.value.toString(),
    });

    if (filter.currentFilter.value) {
      params.append('filter', filter.currentFilter.value);
    }

    if (currentSort.value) {
      params.append('sort', currentSort.value);
    }

    return `/api/messages?${params.toString()}`;
  }

  function showUrlModal() {
    generatedUrl.value = generateApiUrl();
    urlModal.open();
    copyUrlButtonText.value = '📋 Скопировать';
  }

  async function copyUrlToClipboard() {
    const url = fullUrl.value;
    try {
      await navigator.clipboard.writeText(url);
      copyUrlButtonText.value = '✓ Скопировано!';
      setTimeout(() => {
        copyUrlButtonText.value = '📋 Скопировать';
      }, 2000);
    } catch (err) {
      console.error('Ошибка копирования:', err);
      alert('Не удалось скопировать URL');
    }
  }

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
    totalPages: pagination.totalPages,
    totalMessages: pagination.totalItems,
    currentPageInput: pagination.currentPageInput,
    visiblePages,
    // Filter (из composable)
    filterInput: filter.filterInput,
    selectedFilterExample: filter.selectedFilterExample,
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
    goToPreviousPage: () => {
      if (pagination.currentPage.value > 1) {
        loadMessages(pagination.currentPage.value - 1);
      }
    },
    goToNextPage: () => {
      if (pagination.currentPage.value < pagination.totalPages.value) {
        loadMessages(pagination.currentPage.value + 1);
      }
    },
    goToPage: (page: number) => {
      if (page >= 1 && page <= pagination.totalPages.value) {
        loadMessages(page);
      }
    },
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
