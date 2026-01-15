/* eslint-env browser */
/* global alert */
import { ref, computed, onMounted, toRef } from 'vue';
import { useConfigStore } from '@/app/stores/config';
import { useCredentialsStore } from '@/app/stores/credentials';
import { usePagination } from '@/shared/lib/composables/usePagination';
import { useModal } from '@/shared/lib/composables/useModal';

export function useDialogsMessagesPage() {
  // Конфигурация
  const configStore = useConfigStore();
  const credentialsStore = useCredentialsStore();

  // Используем credentials из store (toRef для правильной типизации)
  const apiKey = toRef(credentialsStore, 'apiKey');
  const tenantId = toRef(credentialsStore, 'tenantId');

  // Состояние диалогов
  const dialogs = ref<any[]>([]);
  const loadingDialogs = ref(false);
  const dialogsError = ref<string | null>(null);
  const currentFilter = ref<string | null>(null);
  const currentAdditionalFilter = ref<string | null>(null);
  const currentSort = ref<string>('');
  const filterValue = ref('');
  const sortValue = ref('');
  const selectedFilterExample = ref('');
  const selectedSortExample = ref('');
  const applying = ref(false);
  const applyButtonText = ref('Применить');
  const showDialogsPagination = ref(false);

  // Пагинация для диалогов
  const dialogsPagination = usePagination({
    initialPage: 1,
    initialLimit: 10,
    onPageChange: (page) => {
      const filterVal = filterValue.value.trim();
      loadDialogsWithFilter(filterVal || '', page, currentSort.value);
    },
  });

  // Состояние сообщений
  const messages = ref<any[]>([]);
  const loadingMessages = ref(false);
  const messagesError = ref<string | null>(null);
  const currentDialogId = ref<string | null>(null);
  const currentMessageFilter = ref<string | null>(null);
  const currentMessageSort = ref<string | null>(null);
  const messageFilterValue = ref('');
  const selectedMessageFilterExample = ref('');
  const showMessagesPagination = ref(false);

  // Пагинация для сообщений
  const messagesPagination = usePagination({
    initialPage: 1,
    initialLimit: 10,
    onPageChange: (page) => {
      if (currentDialogId.value) {
        loadDialogMessages(currentDialogId.value, page);
      }
    },
  });

  // Модальные окна
  const infoModal = useModal();
  const createDialogModal = useModal();
  const urlModal = useModal();
  const modalTitle = ref('Информация');
  const modalBody = ref('');
  const modalUrl = ref('');
  const currentModalJsonForCopy = ref<string | null>(null);
  
  // URL модалка
  const urlModalTitle = ref('');
  const urlModalUrl = ref('');
  const urlCopyButtonText = ref('📋 Скопировать URL');

  // Создание диалога
  const usersForDialog = ref<any[]>([]);
  const loadingUsers = ref(false);
  const usersError = ref<string | null>(null);
  const usersLoaded = ref(false);
  const selectedMembers = ref<string[]>([]);

  // Computed
  const visibleDialogPages = computed(() => {
    const pages: number[] = [];
    const maxPages = Math.min(5, dialogsPagination.totalPages.value);
    for (let i = 1; i <= maxPages; i++) {
      pages.push(i);
    }
    return pages;
  });

  const visibleMessagePages = computed(() => {
    const pages: number[] = [];
    const maxPages = Math.min(5, messagesPagination.totalPages.value);
    for (let i = 1; i <= maxPages; i++) {
      pages.push(i);
    }
    return pages;
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

    loadDialogsWithFilter('');
  }

  function getApiKey() {
    return apiKey.value;
  }

  function updateFilterInput() {
    if (selectedFilterExample.value === 'custom') {
      filterValue.value = '';
    } else if (selectedFilterExample.value) {
      filterValue.value = selectedFilterExample.value;
    }
  }

  function updateSortInput() {
    if (selectedSortExample.value === 'custom') {
      sortValue.value = '';
    } else if (selectedSortExample.value) {
      sortValue.value = selectedSortExample.value;
    }
  }

  function clearAll() {
    filterValue.value = '';
    sortValue.value = '';
    selectedFilterExample.value = '';
    selectedSortExample.value = '';
    currentFilter.value = null;
    currentAdditionalFilter.value = null;
    currentSort.value = '';
    dialogsPagination.currentPage.value = 1;
    dialogsPagination.currentPageInput.value = 1;
    loadDialogsWithFilter('');
  }

  async function applyCombined() {
    const filterVal = filterValue.value.trim();
    const sortVal = sortValue.value.trim();

    if (filterVal && (!filterVal.startsWith('(') || !filterVal.endsWith(')'))) {
      alert('Фильтр должен быть в формате (field,operator,value)');
      return;
    }

    if (sortVal && (!sortVal.startsWith('(') || !sortVal.endsWith(')'))) {
      alert('Сортировка должна быть в формате (field,direction)');
      return;
    }

    applying.value = true;
    applyButtonText.value = 'Применяется...';

    try {
      currentAdditionalFilter.value = filterVal || null;
      currentSort.value = sortVal || '';
      dialogsPagination.currentPage.value = 1;
      dialogsPagination.currentPageInput.value = 1;

      const combinedFilter = filterVal || '';
      await loadDialogsWithFilter(combinedFilter, 1);

      applyButtonText.value = '✓ Применено';
      setTimeout(() => {
        applyButtonText.value = 'Применить';
      }, 2000);
    } catch {
      applyButtonText.value = '✗ Ошибка';
      setTimeout(() => {
        applyButtonText.value = 'Применить';
      }, 2000);
    } finally {
      applying.value = false;
    }
  }

  async function loadDialogsWithFilter(filter: string, page = 1, sort: string | null = null) {
    loadingDialogs.value = true;
    dialogsError.value = null;

    try {
      const key = getApiKey();
      if (!key || !key.trim()) {
        throw new Error('API Key не указан');
      }

      let url = `/api/dialogs?filter=${encodeURIComponent(filter)}&page=${page}&limit=10`;
      const sortParam = sort || currentSort.value;
      if (sortParam) {
        url += `&sort=${encodeURIComponent(sortParam)}`;
      }

      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';

      let headers;
      try {
        headers = credentialsStore.getHeaders();
      } catch {
        throw new Error('API Key не указан');
      }

      const response = await fetch(`${baseUrl}${url}`, {
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.data && data.data.length > 0) {
        dialogsPagination.setPaginationData(data.pagination?.total || 0, data.pagination?.pages || 1);
        dialogs.value = data.data;
        showDialogsPagination.value = true;
      } else {
        dialogs.value = [];
        showDialogsPagination.value = false;
      }
    } catch (error) {
      console.error('Error loading dialogs:', error);
      dialogsError.value = error instanceof Error ? error.message : 'Ошибка загрузки';
      dialogs.value = [];
      showDialogsPagination.value = false;
    } finally {
      loadingDialogs.value = false;
    }
  }

  async function changePage(page: number) {
    if (page < 1 || page > dialogsPagination.totalPages.value || page === dialogsPagination.currentPage.value) return;

    dialogsPagination.currentPage.value = page;
    dialogsPagination.currentPageInput.value = page;

    const filterVal = filterValue.value.trim();
    const combinedFilter = filterVal || '';

    await loadDialogsWithFilter(combinedFilter, page, currentSort.value);
  }

  function formatUpdatedAt(createdAt: string | number | undefined) {
    if (!createdAt) return '-';

    const timestamp = typeof createdAt === 'string' ? parseFloat(createdAt) : createdAt;
    const date = new Date(timestamp);
    return date.toLocaleString('ru-RU');
  }

  function formatMembers(members: any[] | undefined) {
    if (!members || members.length === 0) return '-';

    return members
      .map((member) => {
        const status = member.isActive ? '🟢' : '🔴';
        return `${status} ${member.userId}`;
      })
      .join(', ');
  }

  async function selectDialog(dialogId: string) {
    currentDialogId.value = dialogId;
    messagesPagination.currentPage.value = 1;
    messagesPagination.currentPageInput.value = 1;
    loadDialogMessages(dialogId, 1);
  }

  async function loadDialogMessages(dialogId: string, page = 1) {
    loadingMessages.value = true;
    messagesError.value = null;

    try {
      const key = getApiKey();
      if (!key) {
        throw new Error('API Key не указан');
      }

      let url = `/api/dialogs/${dialogId}/messages?page=${page}&limit=10`;
      if (currentMessageSort.value) {
        url += `&sort=${encodeURIComponent(currentMessageSort.value)}`;
      }
      if (currentMessageFilter.value) {
        url += `&filter=${encodeURIComponent(currentMessageFilter.value)}`;
      }

      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const response = await fetch(`${baseUrl}${url}`, {
        headers: credentialsStore.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.data && data.data.length > 0) {
        messagesPagination.setPaginationData(data.pagination?.total || 0, data.pagination?.pages || 1);
        messages.value = data.data;
        showMessagesPagination.value = true;
      } else {
        messages.value = [];
        showMessagesPagination.value = false;
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      messagesError.value = error instanceof Error ? error.message : 'Ошибка загрузки';
      messages.value = [];
      showMessagesPagination.value = false;
    } finally {
      loadingMessages.value = false;
    }
  }

  async function changeMessagePage(page: number) {
    if (page < 1 || page === messagesPagination.currentPage.value || !currentDialogId.value) return;

    messagesPagination.currentPage.value = page;
    messagesPagination.currentPageInput.value = page;
    loadDialogMessages(currentDialogId.value, page);
  }

  function formatMessageTime(createdAt: string | number | undefined) {
    if (!createdAt) return '-';

    const timestamp = typeof createdAt === 'string' ? parseFloat(createdAt) : createdAt;
    const date = new Date(timestamp);
    return date.toLocaleString('ru-RU');
  }

  function toggleSort(field: string) {
    let newSort: string | null = null;

    if (!currentSort.value || !currentSort.value.includes(field)) {
      newSort = `(${field},asc)`;
    } else if (currentSort.value.includes('asc')) {
      newSort = `(${field},desc)`;
    } else {
      newSort = null;
    }

    currentSort.value = newSort || '';
    dialogsPagination.currentPage.value = 1;
    dialogsPagination.currentPageInput.value = 1;
    const filterVal = filterValue.value.trim();
    loadDialogsWithFilter(filterVal || '', 1);
  }

  function getDialogSortIndicator(field: string) {
    if (!currentSort.value || !currentSort.value.includes(field)) {
      return '◄';
    } else if (currentSort.value.includes('asc')) {
      return '▲';
    } else {
      return '▼';
    }
  }

  function toggleMessageSort(field: string) {
    let newSort: string | null = null;

    if (!currentMessageSort.value || !currentMessageSort.value.includes(field)) {
      newSort = `(${field},asc)`;
    } else if (currentMessageSort.value.includes('asc')) {
      newSort = `(${field},desc)`;
    } else {
      newSort = null;
    }

    currentMessageSort.value = newSort;
    messagesPagination.currentPage.value = 1;
    messagesPagination.currentPageInput.value = 1;
    if (currentDialogId.value) {
      loadDialogMessages(currentDialogId.value, 1);
    }
  }

  function getMessageSortIndicator(field: string) {
    if (!currentMessageSort.value || !currentMessageSort.value.includes(field)) {
      return '◄';
    } else if (currentMessageSort.value.includes('asc')) {
      return '▲';
    } else {
      return '▼';
    }
  }

  function updateMessageFilterInput() {
    if (selectedMessageFilterExample.value === 'custom') {
      messageFilterValue.value = '';
    } else if (selectedMessageFilterExample.value) {
      messageFilterValue.value = selectedMessageFilterExample.value;
    }
  }

  function applyMessageFilter() {
    const filterVal = messageFilterValue.value.trim();
    currentMessageFilter.value = filterVal || null;
    messagesPagination.currentPage.value = 1;
    messagesPagination.currentPageInput.value = 1;
    if (currentDialogId.value) {
      loadDialogMessages(currentDialogId.value, 1);
    }
  }

  function clearMessageFilter() {
    messageFilterValue.value = '';
    selectedMessageFilterExample.value = '';
    currentMessageFilter.value = null;
    currentMessageSort.value = null;
    messagesPagination.currentPage.value = 1;
    messagesPagination.currentPageInput.value = 1;

    if (currentDialogId.value) {
      loadDialogMessages(currentDialogId.value, 1);
    }
  }

  function escapeHtml(value: string) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function showCurrentMessageUrl() {
    if (!currentDialogId.value) {
      alert('Выберите диалог');
      return;
    }

    let url = `/api/dialogs/${currentDialogId.value}/messages`;
    const params = new URLSearchParams();

    params.append('page', messagesPagination.currentPage.value.toString());
    params.append('limit', '10');

    if (currentMessageFilter.value) {
      params.append('filter', currentMessageFilter.value);
    }

    if (currentMessageSort.value) {
      params.append('sort', currentMessageSort.value);
    }

    const fullUrl = url + (params.toString() ? '?' + params.toString() : '');
    const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
    const completeUrl = `${baseUrl}${fullUrl}`;

    urlModalTitle.value = 'Текущий URL запроса сообщений';
    urlModalUrl.value = completeUrl;
    urlCopyButtonText.value = '📋 Скопировать URL';
    urlModal.open();
  }

  function showCurrentUrl() {
    let url = `/api/dialogs`;
    const params = new URLSearchParams();

    params.append('page', dialogsPagination.currentPage.value.toString());
    params.append('limit', '10');

    if (currentFilter.value) {
      params.append('filter', currentFilter.value);
    }

    if (currentAdditionalFilter.value) {
      params.append('filter', currentAdditionalFilter.value);
    }

    if (currentSort.value) {
      params.append('sort', currentSort.value);
    }

    const fullUrl = url + (params.toString() ? '?' + params.toString() : '');
    const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
    const completeUrl = `${baseUrl}${fullUrl}`;

    urlModalTitle.value = 'Текущий URL запроса диалогов';
    urlModalUrl.value = completeUrl;
    urlCopyButtonText.value = '📋 Скопировать URL';
    urlModal.open();
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

  function showAddDialogModal() {
    createDialogModal.open();
    usersForDialog.value = [];
    selectedMembers.value = [];
    usersLoaded.value = false;
    usersError.value = null;
  }

  async function loadUsersForDialog() {
    const key = getApiKey();
    if (!key) {
      alert('API ключ не задан');
      return;
    }

    loadingUsers.value = true;
    usersError.value = null;
    usersLoaded.value = false;

    try {
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const response = await fetch(`${baseUrl}/api/users?limit=100`, {
        headers: credentialsStore.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const users = data.data || data.users || [];

      if (users.length === 0) {
        usersForDialog.value = [];
        usersLoaded.value = true;
        return;
      }

      usersForDialog.value = users.map((user: any) => ({
        userId: user.userId || user._id,
        userName: user.meta?.name || user.userId || user._id,
        userType: user.type || 'user',
      }));

      usersLoaded.value = true;
    } catch (error) {
      console.error('Error loading users:', error);
      usersError.value = error instanceof Error ? error.message : 'Ошибка загрузки';
    } finally {
      loadingUsers.value = false;
    }
  }

  async function createDialog() {
    const key = getApiKey();
    if (!key) {
      alert('API ключ не задан');
      return;
    }

    if (selectedMembers.value.length === 0) {
      alert('Выберите хотя бы одного участника');
      return;
    }

    try {
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';

      const requestBody = {
        members: selectedMembers.value.map((userId) => ({ userId })),
      };

      const response = await fetch(`${baseUrl}/api/dialogs`, {
        method: 'POST',
        headers: {
          ...credentialsStore.getHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || errorData.error || `HTTP error! status: ${response.status}`;
        throw new Error(errorMessage);
      }

      const result = await response.json();
      const dialog = result.data || result;

      alert(`Диалог успешно создан!\nDialog ID: ${dialog.dialogId || dialog._id}`);

      createDialogModal.close();

      loadDialogsWithFilter(currentFilter.value || '');
    } catch (error) {
      console.error('Error creating dialog:', error);
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      alert(`Ошибка при создании диалога: ${errorMessage}`);
    }
  }

  async function showDialogInfo(dialogId: string) {
    try {
      getApiKey(); // Проверка наличия ключа
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const url = `${baseUrl}/api/dialogs/${dialogId}`;

      const response = await fetch(url, {
        headers: credentialsStore.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const dialog = await response.json();
      const dialogData = dialog.data || dialog;

      const dialogName = dialogData.dialogId || 'Диалог';

      const formattedJson = JSON.stringify(dialog, null, 2);
      showModal(
        `Информация о диалоге: ${dialogName}`,
        `<div class="json-content">${formattedJson}</div>`,
        url,
        dialogData,
      );
    } catch (error) {
      console.error('Error loading dialog info:', error);
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const url = `${baseUrl}/api/dialogs/${dialogId}`;
      showModal('Ошибка', `Не удалось загрузить информацию о диалоге: ${error instanceof Error ? error.message : 'Unknown error'}`, url);
    }
  }

  function showMessageInfo(message: any) {
    try {
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const url = `${baseUrl}/api/messages/${message.messageId}`;

      // Формируем упрощенный объект из данных сообщения, как в оригинале
      const messageInfo = {
        id: message.messageId,
        sender: message.senderId,
        time: formatMessageTime(message.createdAt),
        content: message.content,
        type: message.type,
      };

      showModal('Информация о сообщении', `<div class="json-content">${JSON.stringify(messageInfo, null, 2)}</div>`, url, messageInfo);
    } catch (error) {
      console.error('Error showing message info:', error);
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const url = `${baseUrl}/api/messages/${message.messageId}`;
      showModal('Ошибка', `Не удалось загрузить информацию о сообщении: ${error instanceof Error ? error.message : 'Unknown error'}`, url);
    }
  }

  function showModal(title: string, content: string, url: string | null = null, jsonContent: any = null) {
    modalTitle.value = title;

    let modalContent = '';

    if (url) {
      modalContent += `<div class="info-url" style="margin-bottom: 15px; padding: 8px; background: #f8f9fa; border-radius: 4px; font-family: monospace; font-size: 12px; word-break: break-all; color: #495057;">${escapeHtml(url)}</div>`;
    }

    modalContent += content;

    if (jsonContent) {
      const jsonStr = typeof jsonContent === 'string' ? jsonContent : JSON.stringify(jsonContent, null, 2);
      currentModalJsonForCopy.value = jsonStr;
      modalContent += `<div class="form-actions" style="margin-top: 15px;">
      <button type="button" class="btn-primary" onclick="copyJsonToClipboardFromModal()" style="margin-right: 10px;">📋 Копировать JSON</button>
    </div>`;
    }

    modalBody.value = modalContent;
    modalUrl.value = url || '';
    infoModal.open();
  }

  function copyJsonToClipboardFromModal() {
    const jsonText = currentModalJsonForCopy.value;

    if (!jsonText) {
      alert('Нет данных для копирования');
      return;
    }

    navigator.clipboard.writeText(jsonText).then(
      () => {
        const button = document.querySelector('.modal-body .btn-primary');
        if (button && 'style' in button && 'textContent' in button) {
          const originalText = button.textContent;
          button.textContent = '✅ Скопировано!';
          (button as any).style.background = '#28a745';
          setTimeout(() => {
            button.textContent = originalText;
            (button as any).style.background = '';
          }, 2000);
        }
      },
      (err) => {
        console.error('Failed to copy JSON:', err);
        alert('Не удалось скопировать JSON');
      },
    );
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

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' || event.key === 'Esc') {
        if (infoModal.isOpen.value) {
          infoModal.close();
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
    totalPages: dialogsPagination.totalPages,
    totalDialogs: dialogsPagination.totalItems,
    currentPageInput: dialogsPagination.currentPageInput,
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
    totalMessagePages: messagesPagination.totalPages,
    totalMessages: messagesPagination.totalItems,
    currentMessagePageInput: messagesPagination.currentPageInput,
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
    modalBody,
    modalUrl,
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
    changePage,
    formatUpdatedAt,
    formatMembers,
    selectDialog,
    changeMessagePage,
    formatMessageTime,
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
    closeModal: infoModal.close,
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
