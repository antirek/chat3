/* eslint-env browser */
/* global alert, confirm */
import { ref, computed, onMounted, toRef, nextTick } from 'vue';
import { useConfigStore } from '@/app/stores/config';
import { useCredentialsStore } from '@/app/stores/credentials';
import { usePagination } from '@/shared/lib/composables/usePagination';
import { useFilter } from '@/shared/lib/composables/useFilter';
import { useModal } from '@/shared/lib/composables/useModal';

export function useUserDialogsPage() {
  // Конфигурация
  const configStore = useConfigStore();
  const credentialsStore = useCredentialsStore();

  // Используем credentials из store
  const apiKey = toRef(credentialsStore, 'apiKey');
  const tenantId = toRef(credentialsStore, 'tenantId');

  // Состояние пользователей
  const loadingUsers = ref(false);
  const usersError = ref<string | null>(null);
  const users = ref<any[]>([]);
  const currentUserId = ref<string | null>(null);
  const currentUserName = ref<string>('');
  const isLoadingUsersInternal = ref(false); // Флаг для предотвращения рекурсии

  // Пагинация для пользователей
  const usersPagination = usePagination({
    initialPage: 1,
    initialLimit: 100,
    onPageChange: (page, limit) => {
      // Предотвращаем рекурсию
      if (!isLoadingUsersInternal.value) {
        loadUsers(page, limit);
      }
    },
  });

  // Фильтр для пользователей
  const usersFilter = useFilter({
    initialFilter: '',
  });

  // Состояние диалогов
  const loadingDialogs = ref(false);
  const dialogsError = ref<string | null>(null);
  const dialogs = ref<any[]>([]);
  const currentDialogId = ref<string | null>(null);
  const isLoadingDialogsInternal = ref(false); // Флаг для предотвращения рекурсии

  // Пагинация для диалогов
  const dialogsPagination = usePagination({
    initialPage: 1,
    initialLimit: 10,
    onPageChange: (page) => {
      // Предотвращаем рекурсию
      if (!isLoadingDialogsInternal.value && currentUserId.value) {
        loadUserDialogs(currentUserId.value, page);
      }
    },
  });

  // Фильтр для диалогов
  const dialogsFilter = useFilter({
    initialFilter: '',
  });

  // Состояние сообщений
  const loadingMessages = ref(false);
  const messagesError = ref<string | null>(null);
  const messages = ref<any[]>([]);
  const isLoadingMessagesInternal = ref(false); // Флаг для предотвращения рекурсии

  // Пагинация для сообщений
  const messagesPagination = usePagination({
    initialPage: 1,
    initialLimit: 10,
    onPageChange: (page) => {
      // Предотвращаем рекурсию
      if (!isLoadingMessagesInternal.value && currentDialogId.value) {
        loadDialogMessages(currentDialogId.value, page);
      }
    },
  });

  // Фильтр для сообщений
  const messagesFilter = useFilter({
    initialFilter: '',
  });

  // Состояние участников
  const loadingMembers = ref(false);
  const membersError = ref<string | null>(null);
  const members = ref<any[]>([]);
  const isLoadingMembersInternal = ref(false); // Флаг для предотвращения рекурсии

  // Пагинация для участников
  const membersPagination = usePagination({
    initialPage: 1,
    initialLimit: 10,
    onPageChange: (page) => {
      // Предотвращаем рекурсию
      if (!isLoadingMembersInternal.value && currentDialogId.value) {
        loadDialogMembers(currentDialogId.value, page);
      }
    },
  });

  // Фильтр для участников
  const membersFilter = useFilter({
    initialFilter: '',
  });

  // Состояние топиков
  const loadingTopics = ref(false);
  const topicsError = ref<string | null>(null);
  const topics = ref<any[]>([]);

  // Пагинация для топиков
  const topicsPagination = usePagination({
    initialPage: 1,
    initialLimit: 20,
    onPageChange: (page) => {
      if (currentDialogId.value) {
        loadDialogTopics(currentDialogId.value, page);
      }
    },
  });

  // Режим просмотра (messages, members, topics)
  const currentViewMode = ref<'messages' | 'members' | 'topics'>('messages');

  // Модальные окна
  const infoModal = useModal();
  const addMessageModal = useModal();
  const reactionModal = useModal();
  const eventsModal = useModal();
  const statusMatrixModal = useModal();
  const statusesModal = useModal();
  const setStatusModal = useModal();
  const dialogEventsModal = useModal();
  const dialogMetaModal = useModal();
  const addMemberModal = useModal();
  const addTopicModal = useModal();
  const memberMetaModal = useModal();
  const messageMetaModal = useModal();
  const topicMetaModal = useModal();
  const urlModal = useModal();

  // URL модалка - данные
  const urlModalTitle = ref('');
  const urlModalUrl = ref('');
  const urlCopyButtonText = ref('📋 Скопировать URL');

  // Модальные окна - данные
  const modalTitle = ref('Информация');
  const modalBody = ref('');
  const modalUrl = ref('');
  const currentModalJsonForCopy = ref<string | null>(null);

  // Добавление сообщения
  const messageSender = ref('carl');
  const messageType = ref('internal.text');
  const messageContent = ref('тест тест');
  const messageTopicId = ref('');
  const quotedMessageId = ref('');
  const messageMetaTags = ref<Array<{ key: string; value: string }>>([{ key: '', value: '' }]);
  const availableTopics = ref<any[]>([]);
  const payloadJson = ref('{}');

  // Реакции
  const currentMessageIdForReaction = ref<string | null>(null);
  const existingReactions = ref<any[]>([]);
  const selectedReaction = ref<string | null>(null);

  // События
  const currentMessageIdForEvents = ref<string | null>(null);
  const events = ref<any[]>([]);
  const loadingEvents = ref(false);
  const eventsError = ref<string | null>(null);
  const selectedEventId = ref<string | null>(null);
  const eventUpdates = ref<any[]>([]);

  // Статусы
  const loadingStatusMatrix = ref(false);
  const statusMatrixError = ref<string | null>(null);
  const loadingStatuses = ref(false);
  const statusesError = ref<string | null>(null);
  const totalStatuses = ref(0);
  const currentMessageIdForSetStatus = ref<string | null>(null);
  const setStatusResult = ref('');
  const currentMessageIdForStatuses = ref<string | null>(null);
  const statusesUrl = ref('');
  const statusMatrixUrl = ref('');
  const statusMatrix = ref<any[]>([]);
  const statuses = ref<any[]>([]);
  const currentStatusesPage = ref(1);
  const currentStatusesLimit = ref(50);
  const totalStatusesPages = ref(1);

  // Мета-теги диалога
  const dialogMetaDialogId = ref('');
  const dialogMetaTags = ref<Record<string, any>>({});
  const loadingDialogMeta = ref(false);
  const newDialogMetaKey = ref('');
  const newDialogMetaValue = ref('');

  // Добавление участника
  const newMemberSelect = ref('');
  const newMemberType = ref('');
  const newMemberMetaTags = ref<Array<{ key: string; value: string }>>([{ key: '', value: '' }]);
  const availableUsersForMember = ref<any[]>([]);

  // События диалога
  const currentDialogIdForEvents = ref<string | null>(null);
  const dialogEvents = ref<any[]>([]);
  const loadingDialogEvents = ref(false);
  const dialogEventsError = ref<string | null>(null);
  const dialogEventUpdates = ref<any[]>([]);
  const selectedDialogEventId = ref<string | null>(null);

  // Мета-теги участника
  const memberMetaModalDialogId = ref('');
  const memberMetaModalUserId = ref('');
  const memberMetaTags = ref<Array<{ key: string; value: string; isExisting: boolean }>>([]);
  const currentMemberMetaOriginal = ref<Record<string, any>>({});
  const memberMetaStatus = ref('');

  // Мета-теги сообщения
  const messageMetaMessageId = ref('');
  const messageMetaTagsData = ref<Record<string, any>>({});
  const newMessageMetaKey = ref('');
  const newMessageMetaValue = ref('');
  const loadingMessageMeta = ref(false);

  // Мета-теги топика
  const topicMetaDialogId = ref('');
  const topicMetaTopicId = ref('');
  const topicMetaTags = ref<Record<string, any>>({});
  const newTopicMetaKey = ref('');
  const newTopicMetaValue = ref('');
  const loadingTopicMeta = ref(false);

  // Топики - мета-теги для создания
  const newTopicMetaTags = ref<Array<{ key: string; value: string }>>([{ key: '', value: '' }]);

  // Computed
  const userPaginationStart = computed(() => {
    return usersPagination.paginationStart.value;
  });

  const userPaginationEnd = computed(() => {
    return usersPagination.paginationEnd.value;
  });

  const showDialogsPagination = computed(() => {
    return dialogsPagination.totalItems.value > 0 && currentUserId.value !== null;
  });

  const showMessagesPagination = computed(() => {
    return messagesPagination.totalItems.value > 0 && currentDialogId.value !== null;
  });

  const visibleDialogPages = computed(() => {
    const pages: number[] = [];
    const total = dialogsPagination.totalPages.value;
    const current = dialogsPagination.currentPage.value;
    const maxVisible = 10;

    let start = Math.max(1, current - Math.floor(maxVisible / 2));
    let end = Math.min(total, start + maxVisible - 1);

    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  });

  const visibleMessagePages = computed(() => {
    const pages: number[] = [];
    const total = messagesPagination.totalPages.value;
    const current = messagesPagination.currentPage.value;
    const maxVisible = 10;

    let start = Math.max(1, current - Math.floor(maxVisible / 2));
    let end = Math.min(total, start + maxVisible - 1);

    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  });

  const visibleMemberPages = computed(() => {
    const pages: number[] = [];
    const total = membersPagination.totalPages.value;
    const current = membersPagination.currentPage.value;
    const maxVisible = 10;

    let start = Math.max(1, current - Math.floor(maxVisible / 2));
    let end = Math.min(total, start + maxVisible - 1);

    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  });

  // Функции для пользователей
  async function loadUsers(page = usersPagination.currentPage.value, limit = usersPagination.currentLimit.value) {
    // Предотвращаем рекурсию
    if (isLoadingUsersInternal.value) {
      return;
    }

    try {
      const key = apiKey.value;
      if (!key) {
        throw new Error('API Key не указан');
      }

      isLoadingUsersInternal.value = true;
      
      // Обновляем пагинацию напрямую, без вызова onPageChange
      // чтобы избежать рекурсии
      if (usersPagination.currentPage.value !== page) {
        usersPagination.currentPage.value = page;
        usersPagination.currentPageInput.value = page;
      }
      if (usersPagination.currentLimit.value !== limit) {
        usersPagination.currentLimit.value = limit;
        // Если изменился лимит, сбрасываем на первую страницу
        if (usersPagination.currentPage.value !== 1) {
          usersPagination.currentPage.value = 1;
          usersPagination.currentPageInput.value = 1;
        }
      }
      
      loadingUsers.value = true;
      usersError.value = null;

      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (usersFilter.currentFilter.value) {
        params.append('filter', usersFilter.currentFilter.value);
      }

      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const response = await fetch(`${baseUrl}/api/users?${params.toString()}`, {
        headers: credentialsStore.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      usersPagination.setPaginationData(data.pagination?.total || 0, data.pagination?.pages || 1);

      if (data.data && data.data.length > 0) {
        const usersData = data.data.map((user: any) => ({
          ...user,
          displayName: user.displayName || user.userId,
          dialogCount: Number.isFinite(user.dialogCount) ? user.dialogCount : 0
        }));
        
        users.value = usersData.sort((a: any, b: any) => {
          // Сначала по dialogCount (по убыванию)
          if (b.dialogCount !== a.dialogCount) {
            return b.dialogCount - a.dialogCount;
          }
          // Затем по displayName (по алфавиту)
          const nameA = (a.displayName || '').toLowerCase();
          const nameB = (b.displayName || '').toLowerCase();
          if (nameA === nameB) {
            // Если displayName одинаковые, то по userId
            return a.userId.localeCompare(b.userId);
          }
          return nameA.localeCompare(nameB);
        });
      } else {
        users.value = [];
      }
    } catch (err) {
      console.error('Error loading users:', err);
      usersError.value = err instanceof Error ? err.message : 'Ошибка загрузки';
      users.value = [];
    } finally {
      loadingUsers.value = false;
      isLoadingUsersInternal.value = false;
    }
  }

  function selectUserFilterExample() {
    // selectedFilterExample уже обновлен через v-model
    if (usersFilter.selectedFilterExample.value && usersFilter.selectedFilterExample.value !== 'custom') {
      usersFilter.filterInput.value = usersFilter.selectedFilterExample.value;
    } else if (usersFilter.selectedFilterExample.value === 'custom') {
      usersFilter.filterInput.value = '';
    }
  }

  function clearUserFilter() {
    usersFilter.clearFilter();
    loadUsers(1, usersPagination.currentLimit.value);
  }

  function applyUserFilter() {
    usersFilter.applyFilter();
    loadUsers(1, usersPagination.currentLimit.value);
  }

  async function selectUser(userId: string, userName: string) {
    currentUserId.value = userId;
    currentUserName.value = userName;
    currentDialogId.value = null;
    dialogs.value = [];
    messages.value = [];
    await loadUserDialogs(userId, 1);
  }

  // Функции для диалогов
  async function loadUserDialogs(userId: string, page = 1) {
    // Предотвращаем рекурсию
    if (isLoadingDialogsInternal.value) {
      return;
    }

    try {
      if (!userId) {
        return;
      }

      isLoadingDialogsInternal.value = true;
      loadingDialogs.value = true;
      dialogsError.value = null;

      let url = `/api/users/${userId}/dialogs?page=${page}&limit=10`;

      if (dialogsFilter.currentFilter.value) {
        url += `&filter=${encodeURIComponent(dialogsFilter.currentFilter.value)}`;
      }

      const response = await fetch(url, {
        headers: credentialsStore.getHeaders(),
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        } else {
          const errorText = await response.text();
          throw new Error(`Сервер вернул не JSON. Status: ${response.status}. Ответ: ${errorText.substring(0, 200)}`);
        }
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Сервер вернул не JSON. Status: ${response.status}. Content-Type: ${contentType}. Ответ: ${text.substring(0, 200)}`);
      }

      const data = await response.json();
      dialogsPagination.setPaginationData(data.pagination?.total || 0, data.pagination?.pages || 1);
      
      // Обновляем пагинацию напрямую, без вызова onPageChange
      if (dialogsPagination.currentPage.value !== page) {
        dialogsPagination.currentPage.value = page;
        dialogsPagination.currentPageInput.value = page;
      }

      if (data.data && data.data.length > 0) {
        dialogs.value = data.data;
      } else {
        dialogs.value = [];
      }
    } catch (err) {
      console.error('Error loading dialogs:', err);
      dialogsError.value = err instanceof Error ? err.message : 'Ошибка загрузки';
      dialogs.value = [];
    } finally {
      loadingDialogs.value = false;
      isLoadingDialogsInternal.value = false;
    }
  }

  function selectFilterExample() {
    if (dialogsFilter.selectedFilterExample.value && dialogsFilter.selectedFilterExample.value !== 'custom') {
      dialogsFilter.filterInput.value = dialogsFilter.selectedFilterExample.value;
    } else if (dialogsFilter.selectedFilterExample.value === 'custom') {
      dialogsFilter.filterInput.value = '';
    }
  }

  function clearFilter() {
    dialogsFilter.clearFilter();
    if (currentUserId.value) {
      loadUserDialogs(currentUserId.value, 1);
    }
  }

  function applyFilter() {
    dialogsFilter.applyFilter();
    if (currentUserId.value) {
      loadUserDialogs(currentUserId.value, 1);
    }
  }

  function changeDialogPage(page: number) {
    if (currentUserId.value) {
      loadUserDialogs(currentUserId.value, page);
    }
  }

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

  // Функции для сообщений
  async function loadDialogMessages(dialogId: string, page = 1) {
    // Предотвращаем рекурсию
    if (isLoadingMessagesInternal.value) {
      return;
    }

    try {
      if (!dialogId || !currentUserId.value) {
        return;
      }

      isLoadingMessagesInternal.value = true;
      loadingMessages.value = true;
      messagesError.value = null;

      let url = `/api/users/${currentUserId.value}/dialogs/${dialogId}/messages?page=${page}&limit=10`;

      if (messagesFilter.currentFilter.value) {
        url += `&filter=${encodeURIComponent(messagesFilter.currentFilter.value)}`;
      }

      const response = await fetch(url, {
        headers: credentialsStore.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      messagesPagination.setPaginationData(data.pagination?.total || 0, data.pagination?.pages || 1);
      
      // Обновляем пагинацию напрямую, без вызова onPageChange
      if (messagesPagination.currentPage.value !== page) {
        messagesPagination.currentPage.value = page;
        messagesPagination.currentPageInput.value = page;
      }

      if (data.data && data.data.length > 0) {
        messages.value = data.data;
      } else {
        messages.value = [];
      }
    } catch (err) {
      console.error('Error loading messages:', err);
      messagesError.value = err instanceof Error ? err.message : 'Ошибка загрузки';
      messages.value = [];
    } finally {
      loadingMessages.value = false;
      isLoadingMessagesInternal.value = false;
    }
  }

  function selectMessageFilterExample() {
    if (messagesFilter.selectedFilterExample.value && messagesFilter.selectedFilterExample.value !== 'custom') {
      messagesFilter.filterInput.value = messagesFilter.selectedFilterExample.value;
    } else if (messagesFilter.selectedFilterExample.value === 'custom') {
      messagesFilter.filterInput.value = '';
    }
  }

  function clearMessageFilter() {
    messagesFilter.clearFilter();
    if (currentDialogId.value) {
      loadDialogMessages(currentDialogId.value, 1);
    }
  }

  function applyMessageFilter() {
    messagesFilter.applyFilter();
    if (currentDialogId.value) {
      loadDialogMessages(currentDialogId.value, 1);
    }
  }

  function changeMessagePage(page: number) {
    if (currentDialogId.value) {
      loadDialogMessages(currentDialogId.value, page);
    }
  }

  // Функции для участников
  async function loadDialogMembers(dialogId: string, page = 1) {
    // Предотвращаем рекурсию
    if (isLoadingMembersInternal.value) {
      return;
    }

    try {
      if (!dialogId) {
        return;
      }

      isLoadingMembersInternal.value = true;
      loadingMembers.value = true;
      membersError.value = null;

      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        sort: '(joinedAt,asc)',
      });

      if (membersFilter.currentFilter.value) {
        params.append('filter', membersFilter.currentFilter.value);
      }

      const response = await fetch(`/api/dialogs/${dialogId}/members?${params.toString()}`, {
        headers: credentialsStore.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      membersPagination.setPaginationData(data.pagination?.total || 0, data.pagination?.pages || 1);
      
      // Обновляем пагинацию напрямую, без вызова onPageChange
      if (membersPagination.currentPage.value !== page) {
        membersPagination.currentPage.value = page;
        membersPagination.currentPageInput.value = page;
      }

      if (data.data && data.data.length > 0) {
        members.value = data.data;
      } else {
        members.value = [];
      }
    } catch (err) {
      console.error('Error loading members:', err);
      membersError.value = err instanceof Error ? err.message : 'Ошибка загрузки';
      members.value = [];
    } finally {
      loadingMembers.value = false;
      isLoadingMembersInternal.value = false;
    }
  }

  function selectMemberFilterExamplePanel() {
    if (membersFilter.selectedFilterExample.value && membersFilter.selectedFilterExample.value !== 'custom') {
      membersFilter.filterInput.value = membersFilter.selectedFilterExample.value;
    } else if (membersFilter.selectedFilterExample.value === 'custom') {
      membersFilter.filterInput.value = '';
    }
  }

  async function clearMemberFilterFieldPanel() {
    membersFilter.clearFilter();
    if (currentDialogId.value) {
      // Обновляем пагинацию напрямую, без вызова onPageChange
      membersPagination.currentPage.value = 1;
      membersPagination.currentPageInput.value = 1;
      await loadDialogMembers(currentDialogId.value, 1);
    }
  }

  async function applyMemberFilterPanel() {
    if (!currentDialogId.value) {
      alert('Сначала выберите диалог');
      return;
    }
    membersFilter.applyFilter();
    // Обновляем пагинацию напрямую, без вызова onPageChange
    membersPagination.currentPage.value = 1;
    membersPagination.currentPageInput.value = 1;
    await loadDialogMembers(currentDialogId.value, 1);
  }

  function changeMemberPage(page: number) {
    if (currentDialogId.value) {
      loadDialogMembers(currentDialogId.value, page);
    }
  }

  // Функции для топиков
  async function loadDialogTopics(dialogId: string, page = 1) {
    try {
      if (!dialogId || !currentUserId.value) {
        return;
      }

      loadingTopics.value = true;
      topicsError.value = null;

      const url = `/api/users/${currentUserId.value}/dialogs/${dialogId}/topics?page=${page}&limit=20`;

      const response = await fetch(url, {
        headers: credentialsStore.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      topicsPagination.setPaginationData(data.pagination?.total || 0, data.pagination?.pages || 1);
      topicsPagination.setPage(page);

      if (data.data && data.data.length > 0) {
        topics.value = data.data;
      } else {
        topics.value = [];
      }
    } catch (err) {
      console.error('Error loading topics:', err);
      topicsError.value = err instanceof Error ? err.message : 'Ошибка загрузки';
      topics.value = [];
    } finally {
      loadingTopics.value = false;
    }
  }

  // Утилиты
  function formatLastSeen(timestamp: string | number | null | undefined) {
    if (!timestamp) return '-';
    const ts = typeof timestamp === 'string' ? parseFloat(timestamp) : timestamp;
    const date = new Date(ts);
    return date.toLocaleString('ru-RU');
  }

  function formatMessageTime(timestamp: string | number) {
    if (!timestamp) return '';
    const ts = typeof timestamp === 'string' ? parseFloat(timestamp) : timestamp;
    const date = new Date(ts);
    return date.toLocaleString('ru-RU');
  }

  function shortenDialogId(dialogId: string) {
    if (!dialogId) return '-';
    if (dialogId.startsWith('dlg_')) {
      return `dlg_${dialogId.substring(4, 8)}...`;
    }
    return dialogId.length > 20 ? dialogId.substring(0, 20) + '...' : dialogId;
  }

  function shortenTopicId(topicId: string) {
    if (!topicId) return '-';
    if (topicId.startsWith('topic_')) {
      return `topic_${topicId.substring(6, 10)}...`;
    }
    return topicId;
  }

  function escapeHtml(value: any): string {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getMessageStatus(message: any): string | null {
    if (!message.context?.isMine) return null;
    const statusMatrix = message.statusMessageMatrix || [];
    const readStatus = statusMatrix.find(
      (item: any) => item.userType === 'user' && item.status === 'read' && item.count >= 1
    );
    return readStatus ? 'read' : 'sent';
  }

  function getStatusIcon(status: string | null): string {
    if (!status) return '?';
    const icons: Record<string, string> = {
      sent: '✓',
      delivered: '✓✓',
      read: '✓✓',
      unread: '◯',
    };
    return icons[status] || '?';
  }

  function getStatusColor(status: string | null): string {
    if (!status) return '#999';
    const colors: Record<string, string> = {
      sent: '#999',
      delivered: '#999',
      read: '#4fc3f7',
      unread: '#ccc',
    };
    return colors[status] || '#999';
  }

  // Модальные окна - базовые функции
  function showModal(title: string, content: string, url: string | null = null, jsonContent: any = null) {
    modalTitle.value = title;

    let modalContent = '';

    if (url) {
      modalContent += `<div class="info-url" style="margin-bottom: 15px; padding: 8px; background: #f8f9fa; border-radius: 4px; font-family: monospace; font-size: 12px; word-break: break-all; color: #495057;">${escapeHtml(url)}</div>`;
    }

    modalContent += content;

    if (jsonContent) {
      const jsonStr = JSON.stringify(jsonContent, null, 2);
      currentModalJsonForCopy.value = jsonStr;
      modalContent += `<div class="form-actions" style="margin-top: 15px; justify-content: flex-end;">
        <button type="button" class="btn-primary" onclick="copyJsonToClipboardFromModal()" style="margin-right: 10px;">📋 Копировать JSON</button>
      </div>`;
    }

    modalBody.value = modalContent;
    modalUrl.value = url || '';
    infoModal.open();
  }

  function closeModal() {
    infoModal.close();
    modalBody.value = '';
    currentModalJsonForCopy.value = null;
  }

  // Функция для копирования JSON из модального окна (будет вызвана из v-html)
  function copyJsonToClipboardFromModal() {
    const jsonText = currentModalJsonForCopy.value;

    if (!jsonText) {
      alert('Нет данных для копирования');
      return;
    }

    navigator.clipboard.writeText(jsonText).then(
      () => {
        const modalBodyEl = document.querySelector('.modal-body');
        if (modalBodyEl) {
          const button = modalBodyEl.querySelector('.btn-primary') as any;
          if (button) {
            const originalText = button.textContent;
            button.textContent = '✅ Скопировано!';
            button.style.background = '#28a745';
            setTimeout(() => {
              button.textContent = originalText;
              button.style.background = '';
            }, 2000);
          }
        }
      },
      (err) => {
        console.error('Failed to copy JSON:', err);
        alert('Не удалось скопировать JSON');
      }
    );
  }

  // Функция для копирования URL в буфер обмена
  function copyToClipboardFromModal(text: string) {
    navigator.clipboard.writeText(text).then(
      () => {
        const button = document.querySelector('.url-copy button') as any;
        if (button) {
          const originalText = button.textContent;
          button.textContent = '✅ Скопировано!';
          button.style.background = '#28a745';
          setTimeout(() => {
            button.textContent = originalText;
            button.style.background = '#28a745';
          }, 2000);
        }
      },
      (err) => {
        console.error('Failed to copy URL:', err);
        alert('Не удалось скопировать URL');
      }
    );
  }

  // Добавляем функции в window для вызова из v-html
  if (typeof window !== 'undefined') {
    (window as any).copyJsonToClipboardFromModal = copyJsonToClipboardFromModal;
    (window as any).copyToClipboardFromModal = copyToClipboardFromModal;
  }

  // Функции для модальных окон
  async function showUserInfoModal(userId: string) {
    const url = `/api/users/${userId}`;
    showModal('JSON пользователя', '<div class="loading">Загрузка данных пользователя...</div>', url);
    
    try {
      const response = await fetch(url, {
        headers: credentialsStore.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.data) {
        const jsonStr = JSON.stringify(data.data, null, 2);
        showModal(`JSON пользователя: ${escapeHtml(userId)}`, 
          `<div style="max-height: 500px; overflow: auto;">
            <pre class="json-content">${escapeHtml(jsonStr)}</pre>
          </div>`,
          url,
          data.data
        );
      } else {
        showModal('Ошибка', 'Данные пользователя не найдены', url);
      }
    } catch (error) {
      console.error('Error loading user JSON:', error);
      showModal('Ошибка', `Ошибка загрузки: ${escapeHtml(error instanceof Error ? error.message : 'Unknown error')}`, url);
    }
  }

  async function showUsersUrl() {
    const key = apiKey.value;
    if (!key) {
      alert('API Key не указан');
      return;
    }

    const params = new URLSearchParams({
      page: usersPagination.currentPage.value.toString(),
      limit: usersPagination.currentLimit.value.toString(),
    });

    if (usersFilter.currentFilter.value) {
      params.append('filter', usersFilter.currentFilter.value);
    }

    const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
    const url = `${baseUrl}/api/users?${params.toString()}`;
    urlModalTitle.value = 'URL запроса пользователей';
    urlModalUrl.value = url;
    urlCopyButtonText.value = '📋 Скопировать URL';
    urlModal.open();
  }

  async function showCurrentUrl() {
    if (!currentUserId.value) {
      alert('Сначала выберите пользователя');
      return;
    }

    let url = `/api/users/${currentUserId.value}/dialogs`;
    const params = new URLSearchParams();
    
    params.append('page', dialogsPagination.currentPage.value.toString());
    params.append('limit', '10');
    
    if (dialogsFilter.currentFilter.value) {
      params.append('filter', dialogsFilter.currentFilter.value);
    }
    
    const fullUrl = url + (params.toString() ? '?' + params.toString() : '');
    const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
    const fullUrlWithOrigin = `${baseUrl}${fullUrl}`;
    
    urlModalTitle.value = 'Текущий URL запроса диалогов';
    urlModalUrl.value = fullUrlWithOrigin;
    urlCopyButtonText.value = '📋 Скопировать URL';
    urlModal.open();
  }

  async function showCurrentMessageUrl() {
    if (!currentDialogId.value || !currentUserId.value) {
      alert('Сначала выберите диалог');
      return;
    }

    let url = `/api/users/${currentUserId.value}/dialogs/${currentDialogId.value}/messages?page=${messagesPagination.currentPage.value}&limit=10`;

    if (messagesFilter.currentFilter.value) {
      url += `&filter=${encodeURIComponent(messagesFilter.currentFilter.value)}`;
    }

    const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
    const fullUrl = `${baseUrl}${url}`;
    urlModalTitle.value = 'URL запроса сообщений';
    urlModalUrl.value = fullUrl;
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

  async function showDialogInfo(dialogId: string) {
    try {
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

      showModal(
        'Информация о диалоге',
        `<div class="json-content">${JSON.stringify(dialog, null, 2)}</div>`,
        url,
        dialogData
      );
    } catch (error) {
      console.error('Error loading dialog info:', error);
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const url = `${baseUrl}/api/dialogs/${dialogId}`;
      showModal('Ошибка', `Не удалось загрузить информацию о диалоге: ${error instanceof Error ? error.message : 'Unknown error'}`, url);
    }
  }

  async function showMessageInfo(messageId: string) {
    try {
      if (!currentUserId.value || !currentDialogId.value) {
        alert('Сначала выберите пользователя и диалог');
        return;
      }

      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const url = `${baseUrl}/api/users/${currentUserId.value}/dialogs/${currentDialogId.value}/messages/${messageId}`;

      const response = await fetch(url, {
        headers: credentialsStore.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const message = await response.json();
      const messageData = message.data || message;

      showModal(
        `Информация о сообщении (контекст: ${currentUserId.value})`,
        `<div class="json-content">${JSON.stringify(message, null, 2)}</div>`,
        url,
        messageData
      );
    } catch (error) {
      console.error('Error loading message info:', error);
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const url = `${baseUrl}/api/messages/${messageId}`;
      showModal('Ошибка', `Не удалось загрузить информацию о сообщении: ${error instanceof Error ? error.message : 'Unknown error'}`, url);
    }
  }

  // Функции для модального окна добавления сообщения
  async function showAddMessageModal() {
    if (!currentDialogId.value) {
      alert('Сначала выберите диалог');
      return;
    }
    
    if (!currentUserId.value) {
      alert('Сначала выберите пользователя');
      return;
    }
    
    messageSender.value = 'carl';
    messageType.value = 'internal.text';
    messageContent.value = 'тест тест';
    messageTopicId.value = '';
    quotedMessageId.value = '';
    messageMetaTags.value = [{ key: '', value: '' }];
    availableTopics.value = [];
    
    try {
      const topicsResponse = await fetch(
        `/api/users/${currentUserId.value}/dialogs/${currentDialogId.value}/topics?page=1&limit=100`,
        {
          headers: credentialsStore.getHeaders(),
        }
      );
      
      if (topicsResponse.ok) {
        const topicsData = await topicsResponse.json();
        if (topicsData.data && topicsData.data.length > 0) {
          availableTopics.value = topicsData.data;
        }
      }
    } catch (error) {
      console.error('Ошибка при загрузке топиков:', error);
    }
    
    addMessageModal.open();
    updatePayloadJson();
  }

  function closeAddMessageModal() {
    addMessageModal.close();
  }

  function addMetaTagRow() {
    messageMetaTags.value.push({ key: '', value: '' });
    updatePayloadJson();
  }

  function removeMetaTagRow(index: number) {
    if (messageMetaTags.value.length > 1) {
      messageMetaTags.value.splice(index, 1);
      updatePayloadJson();
    }
  }

  function collectMetaTags(): Record<string, string> | null {
    const metaTags: Record<string, string> = {};
    messageMetaTags.value.forEach((tag) => {
      if (tag.key.trim() && tag.value.trim()) {
        metaTags[tag.key.trim()] = tag.value.trim();
      }
    });
    return Object.keys(metaTags).length > 0 ? metaTags : null;
  }

  function updatePayloadJson() {
    const meta = collectMetaTags();
    
    const payload: any = {
      senderId: messageSender.value,
      type: messageType.value,
      content: messageContent.value,
    };
    
    if (quotedMessageId.value.trim()) {
      payload.quotedMessageId = quotedMessageId.value.trim();
    }
    
    if (messageTopicId.value.trim()) {
      payload.topicId = messageTopicId.value.trim();
    }
    
    if (meta) {
      payload.meta = meta;
    }
    
    payloadJson.value = JSON.stringify(payload, null, 2);
  }

  async function submitAddMessage() {
    if (!currentDialogId.value || !currentUserId.value) {
      alert('Ошибка: не выбран диалог или пользователь');
      return;
    }

    const meta = collectMetaTags();

    try {
      const payload: any = {
        senderId: messageSender.value,
        type: messageType.value,
        content: messageContent.value,
      };
      
      if (quotedMessageId.value.trim()) {
        payload.quotedMessageId = quotedMessageId.value.trim();
      }
      
      if (messageTopicId.value.trim()) {
        payload.topicId = messageTopicId.value.trim();
      }
      
      if (meta) {
        payload.meta = meta;
      }

      const response = await fetch(`/api/dialogs/${currentDialogId.value}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...credentialsStore.getHeaders(),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Message added successfully:', result);
      
      alert('Сообщение успешно добавлено!');
      
      closeAddMessageModal();
      
      if (currentDialogId.value) {
        loadDialogMessages(currentDialogId.value, messagesPagination.currentPage.value);
      }
    } catch (error) {
      console.error('Error adding message:', error);
      alert(`Ошибка при добавлении сообщения: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Функции для модального окна реакций
  async function showReactionModal(messageId: string) {
    if (!currentUserId.value) {
      alert('Сначала выберите пользователя');
      return;
    }
    
    if (!currentDialogId.value) {
      alert('Сначала выберите диалог');
      return;
    }
    
    currentMessageIdForReaction.value = messageId;
    reactionModal.open();
    await loadExistingReactions(messageId);
  }

  function closeReactionModal() {
    reactionModal.close();
    currentMessageIdForReaction.value = null;
    existingReactions.value = [];
  }

  async function loadExistingReactions(messageId: string) {
    try {
      const response = await fetch(
        `/api/users/${currentUserId.value}/dialogs/${currentDialogId.value}/messages/${messageId}`,
        {
          headers: credentialsStore.getHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const message = data.data || {};
      const reactionSet = message.reactionSet || [];
      
      existingReactions.value = reactionSet;
    } catch (error) {
      console.error('Error loading reactions:', error);
      existingReactions.value = [];
    }
  }

  async function toggleReaction(reaction: string) {
    if (!currentMessageIdForReaction.value || !currentUserId.value || !currentDialogId.value) {
      alert('Ошибка: не выбран сообщение, пользователь или диалог');
      return;
    }

    const existingReaction = existingReactions.value.find((r: any) => r.reaction === reaction);
    const isActive = existingReaction && existingReaction.me;

    try {
      const action = isActive ? 'unset' : 'set';
      
      const response = await fetch(
        `/api/users/${currentUserId.value}/dialogs/${currentDialogId.value}/messages/${currentMessageIdForReaction.value}/reactions/${action}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...credentialsStore.getHeaders(),
          },
          body: JSON.stringify({
            reaction: reaction,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      await loadExistingReactions(currentMessageIdForReaction.value);
      
      if (currentDialogId.value) {
        loadDialogMessages(currentDialogId.value, messagesPagination.currentPage.value);
      }
    } catch (error) {
      console.error('Error toggling reaction:', error);
      alert(`Ошибка при ${isActive ? 'снятии' : 'установке'} реакции: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Функции для модального окна событий сообщения
  async function showEventsModal(messageId: string) {
    if (!currentUserId.value) {
      alert('Сначала выберите пользователя');
      return;
    }
    
    if (!currentDialogId.value) {
      alert('Сначала выберите диалог');
      return;
    }
    
    currentMessageIdForEvents.value = messageId;
    eventsModal.open();
    eventUpdates.value = [];
    await loadMessageEvents(messageId);
  }

  function closeEventsModal() {
    eventsModal.close();
    currentMessageIdForEvents.value = null;
    events.value = [];
    eventUpdates.value = [];
    selectedEventId.value = null;
  }

  async function loadMessageEvents(messageId: string) {
    try {
      loadingEvents.value = true;
      eventsError.value = null;
      
      const url = `/api/messages/${messageId}/events?tenantId=${encodeURIComponent(tenantId.value)}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-Tenant-Id': tenantId.value,
        },
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          events.value = [];
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      const eventsList = Array.isArray(data.data) ? data.data : (Array.isArray(data.events) ? data.events : []);
      events.value = eventsList;
    } catch (error) {
      console.error('Error loading events:', error);
      eventsError.value = error instanceof Error ? error.message : 'Ошибка загрузки';
      events.value = [];
    } finally {
      loadingEvents.value = false;
    }
  }

  function getEventId(event: any): string {
    if (event._id) {
      if (typeof event._id === 'object') {
        if (event._id.toString && typeof event._id.toString === 'function') {
          return event._id.toString();
        } else if (event._id.$oid) {
          return event._id.$oid;
        }
        return String(event._id);
      }
      return String(event._id);
    }
    return String(event.id || '');
  }

  function formatEventTime(timestamp: any): string {
    if (!timestamp) return '-';
    const ts = typeof timestamp === 'string' ? parseFloat(timestamp) : timestamp;
    return new Date(ts).toLocaleString('ru-RU');
  }

  function getEventDescription(eventType: string, data: any): string {
    const descriptions: Record<string, string> = {
      'dialog.create': 'Создан диалог',
      'dialog.update': 'Обновлен диалог',
      'dialog.delete': 'Удален диалог',
      'message.create': 'Создано сообщение',
      'message.update': 'Обновлено сообщение',
      'dialog.member.add': 'Добавлен участник диалога',
      'dialog.member.remove': 'Удален участник диалога',
      'dialog.member.update': 'Обновлен участник диалога',
      'message.status.update': 'Обновлен статус сообщения',
      'message.reaction.update': 'Обновлена реакция на сообщение',
      'dialog.typing': 'Пользователь печатает в диалоге',
    };
    
    let description = descriptions[eventType] || eventType;
    
    if (data) {
      if (data.message?.content) {
        description += `: "${data.message.content.substring(0, 50)}${data.message.content.length > 50 ? '...' : ''}"`;
      } else if (data.member?.userId) {
        description += `: пользователь ${data.member.userId}`;
      } else if (data.statusUpdate?.status) {
        description += `: статус "${data.statusUpdate.status}"`;
      } else if (data.reactionUpdate?.reaction) {
        description += `: реакция "${data.reactionUpdate.reaction}"`;
      }
    }
    
    return description;
  }

  async function loadEventUpdates(eventId: string) {
    if (!currentMessageIdForEvents.value) return;
    
    try {
      const url = `/api/messages/${currentMessageIdForEvents.value}/updates?tenantId=${encodeURIComponent(tenantId.value)}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-Tenant-Id': tenantId.value,
        },
      });
      
      if (!response.ok) {
        eventUpdates.value = [];
        return;
      }
      
      const data = await response.json();
      const allUpdates = Array.isArray(data.data) ? data.data : [];
      
      const eventIdStr = String(eventId).trim();
      const filteredUpdates = allUpdates.filter((update: any) => {
        if (!update.eventId) return false;
        let updateEventId: string;
        if (typeof update.eventId === 'object') {
          if (update.eventId.toString && typeof update.eventId.toString === 'function') {
            updateEventId = update.eventId.toString();
          } else if (update.eventId.$oid) {
            updateEventId = update.eventId.$oid;
          } else {
            updateEventId = String(update.eventId);
          }
        } else {
          updateEventId = String(update.eventId);
        }
        return updateEventId.trim() === eventIdStr;
      });
      
      eventUpdates.value = filteredUpdates;
      selectedEventId.value = eventId;
    } catch (error) {
      console.error('Error loading event updates:', error);
      eventUpdates.value = [];
    }
  }

  // Функции для модального окна матрицы статусов
  async function showStatusMatrixModal(messageId: string) {
    if (!currentUserId.value) {
      alert('Сначала выберите пользователя');
      return;
    }
    
    if (!currentDialogId.value) {
      alert('Сначала выберите диалог');
      return;
    }
    
    statusMatrixModal.open();
    
    await nextTick();
    
    const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
    statusMatrixUrl.value = `${baseUrl}/api/users/${currentUserId.value}/dialogs/${currentDialogId.value}/messages/${messageId}`;
    
    loadingStatusMatrix.value = true;
    statusMatrixError.value = null;
    
    try {
      const response = await fetch(
        `/api/users/${currentUserId.value}/dialogs/${currentDialogId.value}/messages/${messageId}`,
        {
          headers: credentialsStore.getHeaders(),
        }
      );
      
      if (!response.ok) {
        if (response.status === 404) {
          statusMatrix.value = [];
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      const message = data.data || {};
      statusMatrix.value = message.statusMessageMatrix || [];
    } catch (error) {
      console.error('Error loading status matrix:', error);
      statusMatrixError.value = error instanceof Error ? error.message : 'Ошибка загрузки';
      statusMatrix.value = [];
    } finally {
      loadingStatusMatrix.value = false;
    }
  }

  function closeStatusMatrixModal() {
    statusMatrixModal.close();
    statusMatrix.value = [];
  }

  // Функции для модального окна статусов
  async function showStatusesModal(messageId: string) {
    if (!currentUserId.value) {
      alert('Сначала выберите пользователя');
      return;
    }
    
    if (!currentDialogId.value) {
      alert('Сначала выберите диалог');
      return;
    }
    
    currentMessageIdForStatuses.value = messageId;
    currentStatusesPage.value = 1;
    currentStatusesLimit.value = 50;
    
    statusesModal.open();
    
    await nextTick();
    
    const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
    statusesUrl.value = `${baseUrl}/api/users/${currentUserId.value}/dialogs/${currentDialogId.value}/messages/${messageId}/statuses?page=${currentStatusesPage.value}&limit=${currentStatusesLimit.value}`;
    
    await loadStatuses(messageId, currentStatusesPage.value, currentStatusesLimit.value);
  }

  function closeStatusesModal() {
    statusesModal.close();
    currentMessageIdForStatuses.value = null;
    statuses.value = [];
    currentStatusesPage.value = 1;
  }

  async function loadStatuses(messageId: string, page: number, limit: number) {
    if (!currentUserId.value || !currentDialogId.value) {
      return;
    }
    
    loadingStatuses.value = true;
    statusesError.value = null;
    
    await nextTick();
    
    const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
    statusesUrl.value = `${baseUrl}/api/users/${currentUserId.value}/dialogs/${currentDialogId.value}/messages/${messageId}/statuses?page=${page}&limit=${limit}`;
    
    try {
      const response = await fetch(
        `/api/users/${currentUserId.value}/dialogs/${currentDialogId.value}/messages/${messageId}/statuses?page=${page}&limit=${limit}`,
        {
          headers: credentialsStore.getHeaders(),
        }
      );
      
      if (!response.ok) {
        if (response.status === 404) {
          statuses.value = [];
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      statuses.value = data.data || [];
      const pagination = data.pagination || {};
      totalStatuses.value = pagination.total || 0;
      totalStatusesPages.value = pagination.pages || 1;
      currentStatusesPage.value = page;
    } catch (error) {
      console.error('Error loading statuses:', error);
      statusesError.value = error instanceof Error ? error.message : 'Ошибка загрузки';
      statuses.value = [];
    } finally {
      loadingStatuses.value = false;
    }
  }

  function goToStatusesPage(page: number) {
    if (currentMessageIdForStatuses.value) {
      loadStatuses(currentMessageIdForStatuses.value, page, currentStatusesLimit.value);
    }
  }

  // Функции для модального окна установки статуса
  async function showSetStatusModal(messageId: string) {
    if (!currentUserId.value) {
      alert('Сначала выберите пользователя');
      return;
    }
    
    if (!currentDialogId.value) {
      alert('Сначала выберите диалог');
      return;
    }
    
    currentMessageIdForSetStatus.value = messageId;
    
    setStatusModal.open();
    
    await nextTick();
    
    setStatusResult.value = '';
  }

  function closeSetStatusModal() {
    setStatusModal.close();
    currentMessageIdForSetStatus.value = null;
    setStatusResult.value = '';
  }

  async function setMessageStatus(status: string) {
    if (!currentMessageIdForSetStatus.value || !currentUserId.value || !currentDialogId.value) {
      alert('Ошибка: не выбран сообщение, пользователь или диалог');
      return;
    }
    
    setStatusResult.value = 'Установка статуса...';
    
    try {
      const url = `/api/users/${currentUserId.value}/dialogs/${currentDialogId.value}/messages/${currentMessageIdForSetStatus.value}/status/${status}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: credentialsStore.getHeaders(),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Status set successfully:', data);
      
      setStatusResult.value = `✓ Статус успешно установлен!\nСтатус: **${status}**\nСообщение обновлено`;
      
      if (currentDialogId.value) {
        setTimeout(() => {
          loadDialogMessages(currentDialogId.value!, messagesPagination.currentPage.value);
        }, 500);
      }
      
      setTimeout(() => {
        closeSetStatusModal();
      }, 2000);
    } catch (error) {
      console.error('Error setting status:', error);
      setStatusResult.value = `✗ Ошибка: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  // Функции для модального окна событий диалога
  async function showDialogEventsModal(dialogId: string) {
    currentDialogIdForEvents.value = dialogId;
    dialogEventsModal.open();
    dialogEventUpdates.value = [];
    await loadDialogEvents(dialogId);
  }

  function closeDialogEventsModal() {
    dialogEventsModal.close();
    currentDialogIdForEvents.value = null;
    dialogEvents.value = [];
    dialogEventUpdates.value = [];
    selectedDialogEventId.value = null;
  }

  async function loadDialogEvents(dialogId: string) {
    try {
      loadingDialogEvents.value = true;
      dialogEventsError.value = null;
      
      let url = `/api/dialogs/${dialogId}/events?tenantId=${encodeURIComponent(tenantId.value)}`;
      
      console.log('Запрос событий диалога к:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-Tenant-Id': tenantId.value,
        },
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          dialogEvents.value = [];
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      dialogEvents.value = Array.isArray(data.data) ? data.data : [];
    } catch (error) {
      console.error('Error loading dialog events:', error);
      dialogEventsError.value = error instanceof Error ? error.message : 'Ошибка загрузки';
      dialogEvents.value = [];
    } finally {
      loadingDialogEvents.value = false;
    }
  }

  function getDialogEventId(event: any): string | null {
    if (event._id) {
      if (typeof event._id === 'object') {
        if (event._id.toString && typeof event._id.toString === 'function') {
          return event._id.toString().trim();
        } else if (event._id.$oid) {
          return String(event._id.$oid).trim();
        }
        return String(event._id).trim();
      }
      return String(event._id).trim();
    } else if (event.id) {
      return String(event.id).trim();
    }
    return null;
  }

  function getUpdateId(update: any): string {
    if (update._id) {
      if (typeof update._id === 'object') {
        if (update._id.toString && typeof update._id.toString === 'function') {
          return update._id.toString();
        } else if (update._id.$oid) {
          return String(update._id.$oid);
        }
        return String(update._id);
      }
      return String(update._id);
    } else if (update.id) {
      return String(update.id);
    }
    return `${update.createdAt}-${update.eventType}-${update.userId}`;
  }

  function getDialogEventDescription(eventType: string, data: any): string {
    const descriptions: Record<string, string> = {
      'dialog.create': 'Создан диалог',
      'dialog.update': 'Обновлен диалог',
      'dialog.delete': 'Удален диалог',
      'dialog.member.add': 'Добавлен участник диалога',
      'dialog.member.remove': 'Удален участник диалога',
      'dialog.member.update': 'Обновлен участник диалога',
      'message.create': 'Создано сообщение',
      'message.update': 'Обновлено сообщение',
      'message.delete': 'Удалено сообщение',
      'message.status.update': 'Обновлен статус сообщения',
      'message.reaction.update': 'Обновлена реакция на сообщение',
      'dialog.typing': 'Пользователь печатает в диалоге',
    };
    
    let description = descriptions[eventType] || eventType;
    
    if (data) {
      if (data.message?.content) {
        description += `: "${data.message.content.substring(0, 50)}${data.message.content.length > 50 ? '...' : ''}"`;
      } else if (data.member?.userId) {
        description += `: пользователь ${data.member.userId}`;
      } else if (data.dialog?.dialogId) {
        description += `: "${data.dialog.dialogId}"`;
      }
    }
    
    return description;
  }

  async function loadAllDialogUpdatesInModal(dialogId: string, eventId: string) {
    try {
      selectedDialogEventId.value = eventId;
      
      let url = `/api/dialogs/${dialogId}/updates?tenantId=${encodeURIComponent(tenantId.value)}`;
      
      console.log('Запрос обновлений диалога к:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-Tenant-Id': tenantId.value,
        },
      });
      
      if (!response.ok) {
        let errorMessage = '';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || '';
        } catch (_e) {
          errorMessage = `HTTP ${response.status}`;
        }
        dialogEventUpdates.value = [];
        console.error('Ошибка загрузки обновлений диалога:', errorMessage);
        return;
      }
      
      const data = await response.json();
      const updates = Array.isArray(data.data) ? data.data : [];
      
      if (updates.length === 0) {
        dialogEventUpdates.value = [];
        return;
      }
      
      dialogEventUpdates.value = updates;
    } catch (error) {
      console.error('Error loading dialog event updates:', error);
      dialogEventUpdates.value = [];
    }
  }

  // Функции для модального окна мета-тегов диалога
  async function showDialogMetaModal(dialogId: string) {
    dialogMetaDialogId.value = dialogId;
    dialogMetaModal.open();
    await loadDialogMetaTags(dialogId);
  }

  function closeDialogMetaModal() {
    dialogMetaModal.close();
    dialogMetaDialogId.value = '';
    dialogMetaTags.value = {};
    newDialogMetaKey.value = '';
    newDialogMetaValue.value = '';
  }

  async function loadDialogMetaTags(dialogId: string) {
    try {
      loadingDialogMeta.value = true;
      const response = await fetch(`/api/meta/dialog/${dialogId}`, {
        headers: credentialsStore.getHeaders(),
      });
      
      if (!response.ok) {
        throw new Error('Failed to load dialog meta');
      }
      
      const { data: meta } = await response.json();
      dialogMetaTags.value = meta || {};
    } catch (error) {
      console.error('Error loading dialog meta tags:', error);
      dialogMetaTags.value = {};
    } finally {
      loadingDialogMeta.value = false;
    }
  }

  async function addDialogMetaTag() {
    const dialogId = dialogMetaDialogId.value;
    const key = newDialogMetaKey.value.trim();
    const valueStr = newDialogMetaValue.value.trim();
    
    if (!key || !valueStr) {
      alert('Заполните ключ и значение');
      return;
    }
    
    let value: any;
    try {
      value = JSON.parse(valueStr);
    } catch (_e) {
      value = valueStr;
    }
    
    try {
      const response = await fetch(`/api/meta/dialog/${dialogId}/${key}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...credentialsStore.getHeaders(),
        },
        body: JSON.stringify({ value }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to set meta tag');
      }
      
      newDialogMetaKey.value = '';
      newDialogMetaValue.value = '';
      await loadDialogMetaTags(dialogId);
      alert('Meta тег успешно добавлен!');
    } catch (error) {
      console.error('Error adding dialog meta tag:', error);
      alert(`Ошибка добавления meta тега: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async function deleteDialogMetaTag(key: string) {
    if (!confirm(`Удалить meta тег "${key}"?`)) {
      return;
    }
    
    const dialogId = dialogMetaDialogId.value;
    try {
      const response = await fetch(`/api/meta/dialog/${dialogId}/${key}`, {
        method: 'DELETE',
        headers: credentialsStore.getHeaders(),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete meta tag');
      }
      
      await loadDialogMetaTags(dialogId);
      alert('Meta тег успешно удален!');
    } catch (error) {
      console.error('Error deleting dialog meta tag:', error);
      alert(`Ошибка удаления meta тега: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Функции для модального окна добавления участника
  async function showAddMemberModal() {
    if (!currentDialogId.value) {
      alert('Ошибка: не выбран диалог');
      return;
    }
    
    newMemberSelect.value = '';
    newMemberType.value = '';
    newMemberMetaTags.value = [{ key: '', value: '' }];
    availableUsersForMember.value = [];
    
    try {
      const response = await fetch(`/api/users?limit=100`, {
        headers: credentialsStore.getHeaders(),
      });
      
      if (response.ok) {
        const data = await response.json();
        availableUsersForMember.value = Array.isArray(data.data) ? data.data : [];
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
    
    addMemberModal.open();
  }

  function closeAddMemberModal() {
    addMemberModal.close();
    newMemberSelect.value = '';
    newMemberType.value = '';
    newMemberMetaTags.value = [{ key: '', value: '' }];
  }

  function addMemberMetaRow() {
    newMemberMetaTags.value.push({ key: '', value: '' });
  }

  function removeMemberMetaRow(index: number) {
    if (newMemberMetaTags.value.length > 1) {
      newMemberMetaTags.value.splice(index, 1);
    } else {
      newMemberMetaTags.value[0] = { key: '', value: '' };
    }
  }

  function collectMemberMetaTags(): Record<string, string> {
    const meta: Record<string, string> = {};
    newMemberMetaTags.value.forEach((tag) => {
      if (tag.key.trim() && tag.value.trim()) {
        meta[tag.key.trim()] = tag.value.trim();
      }
    });
    return meta;
  }

  async function submitAddMember() {
    if (!currentDialogId.value) {
      alert('Ошибка: не выбран диалог');
      return;
    }
    
    const userId = newMemberSelect.value;
    const type = newMemberType.value;
    const meta = collectMemberMetaTags();
    
    if (!userId) {
      alert('Пожалуйста, выберите пользователя');
      return;
    }
    
    try {
      const requestBody: any = { userId };
      if (type) {
        requestBody.type = type;
      }

      const response = await fetch(`/api/dialogs/${currentDialogId.value}/members/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...credentialsStore.getHeaders(),
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            errorMessage = errorData.message || errorMessage;
          } else {
            const errorText = await response.text();
            if (errorText && !errorText.startsWith('<!DOCTYPE')) {
              errorMessage = errorText;
            }
          }
        } catch (parseError) {
          console.error('Error parsing error response:', parseError);
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('Member added successfully:', result);
      
      if (Object.keys(meta).length > 0) {
        try {
          const entityId = `${currentDialogId.value}:${userId}`;
          for (const [key, value] of Object.entries(meta)) {
            const metaResponse = await fetch(`/api/meta/dialogMember/${entityId}/${key}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                ...credentialsStore.getHeaders(),
              },
              body: JSON.stringify({ value, dataType: 'string' }),
            });
            
            if (!metaResponse.ok) {
              console.warn(`Failed to set meta tag ${key}:`, await metaResponse.text());
            }
          }
        } catch (metaError) {
          console.error('Error setting meta tags:', metaError);
        }
      }
      
      alert('Участник успешно добавлен!');
      closeAddMemberModal();
      
      if (currentViewMode.value === 'members') {
        await loadDialogMembers(currentDialogId.value, membersPagination.currentPage.value);
      }
    } catch (error) {
      console.error('Error adding member:', error);
      alert(`Ошибка при добавлении участника: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Функции для модального окна создания топика
  async function showAddTopicModal() {
    if (!currentDialogId.value) {
      alert('Ошибка: не выбран диалог');
      return;
    }
    
    newTopicMetaTags.value = [{ key: '', value: '' }];
    addTopicModal.open();
  }

  function closeAddTopicModal() {
    addTopicModal.close();
    newTopicMetaTags.value = [{ key: '', value: '' }];
  }

  function addTopicMetaRow() {
    newTopicMetaTags.value.push({ key: '', value: '' });
  }

  function removeTopicMetaRow(index: number) {
    if (newTopicMetaTags.value.length > 1) {
      newTopicMetaTags.value.splice(index, 1);
    } else {
      newTopicMetaTags.value[0] = { key: '', value: '' };
    }
  }

  function collectTopicMetaTags(): Record<string, string> {
    const meta: Record<string, string> = {};
    newTopicMetaTags.value.forEach((tag) => {
      if (tag.key.trim() && tag.value.trim()) {
        meta[tag.key.trim()] = tag.value.trim();
      }
    });
    return meta;
  }

  async function submitAddTopic() {
    if (!currentDialogId.value) {
      alert('Ошибка: не выбран диалог');
      return;
    }
    
    const meta = collectTopicMetaTags();
    
    try {
      const requestBody: any = {};
      if (Object.keys(meta).length > 0) {
        requestBody.meta = meta;
      }
      
      const response = await fetch(`/api/dialogs/${currentDialogId.value}/topics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...credentialsStore.getHeaders(),
        },
        body: JSON.stringify(requestBody),
      });
      
      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            errorMessage = errorData.message || errorData.error || errorMessage;
          } else {
            const errorText = await response.text();
            if (errorText) errorMessage = errorText;
          }
        } catch (parseError) {
          console.error('Error parsing error response:', parseError);
        }
        alert(`Ошибка при создании топика: ${errorMessage}`);
        return;
      }
      
      const result = await response.json();
      console.log('Topic created:', result);
      
      closeAddTopicModal();
      
      if (currentViewMode.value === 'topics' && currentDialogId.value) {
        await loadDialogTopics(currentDialogId.value, topicsPagination.currentPage.value);
      }
      
      alert('Топик успешно создан!');
    } catch (error) {
      console.error('Error creating topic:', error);
      alert(`Ошибка при создании топика: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Функции для модального окна мета-тегов участника
  async function showMemberMetaModal(dialogId: string, userId: string) {
    memberMetaModalDialogId.value = dialogId;
    memberMetaModalUserId.value = userId;
    memberMetaStatus.value = '';
    
    try {
      const response = await fetch(`/api/dialogs/${dialogId}/members?filter=(userId,eq,${userId})`, {
        headers: credentialsStore.getHeaders(),
      });
      
      if (response.ok) {
        const data = await response.json();
        const members = Array.isArray(data.data) ? data.data : [];
        const member = members.find((m: any) => m.userId === userId);
        const meta = member?.meta || {};
        currentMemberMetaOriginal.value = JSON.parse(JSON.stringify(meta));
        
        memberMetaTags.value = Object.keys(meta).map((key) => ({
          key,
          value: formatMetaValueForInput(meta[key]),
          isExisting: true,
        }));
      } else {
        currentMemberMetaOriginal.value = {};
        memberMetaTags.value = [];
      }
    } catch (error) {
      console.error('Error loading member meta:', error);
      currentMemberMetaOriginal.value = {};
      memberMetaTags.value = [];
    }
    
    memberMetaModal.open();
  }

  function closeMemberMetaModal() {
    memberMetaModal.close();
    memberMetaModalDialogId.value = '';
    memberMetaModalUserId.value = '';
    memberMetaTags.value = [];
    currentMemberMetaOriginal.value = {};
    memberMetaStatus.value = '';
  }

  function addMemberMetaRowModal() {
    memberMetaTags.value.push({ key: '', value: '', isExisting: false });
  }

  function removeMemberMetaRowModal(index: number) {
    memberMetaTags.value.splice(index, 1);
    if (memberMetaTags.value.length === 0) {
      memberMetaTags.value = [];
    }
  }

  function formatMetaValueForInput(value: any): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    return JSON.stringify(value);
  }

  function parseMetaValueFromInput(inputValue: string): any {
    if (!inputValue || inputValue.trim() === '') return null;
    const trimmed = inputValue.trim();
    try {
      return JSON.parse(trimmed);
    } catch (_e) {
      return trimmed;
    }
  }

  function collectMemberMetaTagsModal(): Record<string, any> {
    const meta: Record<string, any> = {};
    memberMetaTags.value.forEach((tag) => {
      if (tag.key.trim()) {
        meta[tag.key.trim()] = parseMetaValueFromInput(tag.value);
      }
    });
    return meta;
  }

  async function saveMemberMetaChangesModal() {
    if (!memberMetaModalDialogId.value || !memberMetaModalUserId.value) {
      alert('Ошибка: не выбран диалог или участник');
      return;
    }
    
    const newMeta = collectMemberMetaTagsModal();
    memberMetaStatus.value = '';
    
    try {
      const oldKeys = Object.keys(currentMemberMetaOriginal.value);
      for (const key of oldKeys) {
        if (!(key in newMeta)) {
          await fetch(`/api/dialogs/${memberMetaModalDialogId.value}/members/${memberMetaModalUserId.value}/meta/${key}`, {
            method: 'DELETE',
            headers: credentialsStore.getHeaders(),
          });
        }
      }
      
      for (const [key, value] of Object.entries(newMeta)) {
        const oldValue = currentMemberMetaOriginal.value[key];
        if (oldValue !== value) {
          await fetch(`/api/dialogs/${memberMetaModalDialogId.value}/members/${memberMetaModalUserId.value}/meta/${key}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              ...credentialsStore.getHeaders(),
            },
            body: JSON.stringify({ value }),
          });
        }
      }
      
      memberMetaStatus.value = 'Мета-теги успешно сохранены';
      
      if (currentDialogId.value === memberMetaModalDialogId.value) {
        await loadDialogMembers(currentDialogId.value, membersPagination.currentPage.value);
      }
      
      currentMemberMetaOriginal.value = JSON.parse(JSON.stringify(newMeta));
      
      setTimeout(() => {
        memberMetaStatus.value = '';
      }, 3000);
    } catch (error) {
      console.error('Error saving member meta:', error);
      memberMetaStatus.value = `Ошибка: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  // Функции для модального окна мета-тегов сообщения
  async function showMessageMetaModal(messageId: string) {
    if (!currentUserId.value || !currentDialogId.value) {
      alert('Сначала выберите пользователя и диалог');
      return;
    }
    
    messageMetaMessageId.value = messageId;
    messageMetaModal.open();
    await loadMessageMetaTags(messageId);
  }

  function closeMessageMetaModal() {
    messageMetaModal.close();
    messageMetaMessageId.value = '';
    messageMetaTagsData.value = {};
    newMessageMetaKey.value = '';
    newMessageMetaValue.value = '';
  }

  async function loadMessageMetaTags(messageId: string) {
    if (!currentUserId.value || !currentDialogId.value) {
      return;
    }
    
    try {
      loadingMessageMeta.value = true;
      const response = await fetch(
        `/api/users/${currentUserId.value}/dialogs/${currentDialogId.value}/messages/${messageId}`,
        {
          headers: credentialsStore.getHeaders(),
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to load message meta');
      }
      
      const { data: message } = await response.json();
      messageMetaTagsData.value = message.meta || {};
    } catch (error) {
      console.error('Error loading message meta tags:', error);
      messageMetaTagsData.value = {};
    } finally {
      loadingMessageMeta.value = false;
    }
  }

  async function addMessageMetaTag() {
    const messageId = messageMetaMessageId.value;
    const key = newMessageMetaKey.value.trim();
    const valueStr = newMessageMetaValue.value.trim();
    
    if (!key || !valueStr) {
      alert('Заполните ключ и значение');
      return;
    }
    
    let value: any;
    try {
      value = JSON.parse(valueStr);
    } catch (_e) {
      value = valueStr;
    }
    
    try {
      const response = await fetch(`/api/meta/message/${messageId}/${encodeURIComponent(key)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...credentialsStore.getHeaders(),
        },
        body: JSON.stringify({ value }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to set meta tag');
      }
      
      newMessageMetaKey.value = '';
      newMessageMetaValue.value = '';
      await loadMessageMetaTags(messageId);
      alert('Meta тег успешно добавлен!');
    } catch (error) {
      console.error('Error adding message meta tag:', error);
      alert(`Ошибка добавления meta тега: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async function deleteMessageMetaTag(key: string) {
    if (!confirm(`Удалить meta тег "${key}"?`)) {
      return;
    }
    
    const messageId = messageMetaMessageId.value;
    try {
      const response = await fetch(`/api/meta/message/${messageId}/${encodeURIComponent(key)}`, {
        method: 'DELETE',
        headers: credentialsStore.getHeaders(),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete meta tag');
      }
      
      await loadMessageMetaTags(messageId);
      alert('Meta тег успешно удален!');
    } catch (error) {
      console.error('Error deleting message meta tag:', error);
      alert(`Ошибка удаления meta тега: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Функции для модального окна мета-тегов топика
  async function showTopicMetaModal(dialogId: string, topicId: string) {
    topicMetaDialogId.value = dialogId;
    topicMetaTopicId.value = topicId;
    topicMetaModal.open();
    await loadTopicMetaTags(dialogId, topicId);
  }

  function closeTopicMetaModal() {
    topicMetaModal.close();
    topicMetaDialogId.value = '';
    topicMetaTopicId.value = '';
    topicMetaTags.value = {};
    newTopicMetaKey.value = '';
    newTopicMetaValue.value = '';
  }

  async function loadTopicMetaTags(dialogId: string, topicId: string) {
    try {
      loadingTopicMeta.value = true;
      const response = await fetch(`/api/dialogs/${dialogId}/topics/${topicId}`, {
        headers: credentialsStore.getHeaders(),
      });
      
      if (!response.ok) {
        throw new Error('Failed to load topic meta');
      }
      
      const { data: topic } = await response.json();
      topicMetaTags.value = topic.meta || {};
    } catch (error) {
      console.error('Error loading topic meta tags:', error);
      topicMetaTags.value = {};
    } finally {
      loadingTopicMeta.value = false;
    }
  }

  async function addTopicMetaTag() {
    const dialogId = topicMetaDialogId.value;
    const topicId = topicMetaTopicId.value;
    const key = newTopicMetaKey.value.trim();
    const valueStr = newTopicMetaValue.value.trim();
    
    if (!key || !valueStr) {
      alert('Заполните ключ и значение');
      return;
    }
    
    let value: any;
    try {
      value = JSON.parse(valueStr);
    } catch (_e) {
      value = valueStr;
    }
    
    try {
      const response = await fetch(`/api/meta/topic/${topicId}/${encodeURIComponent(key)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...credentialsStore.getHeaders(),
        },
        body: JSON.stringify({ value }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to set meta tag');
      }
      
      newTopicMetaKey.value = '';
      newTopicMetaValue.value = '';
      await loadTopicMetaTags(dialogId, topicId);
      if (currentViewMode.value === 'topics' && currentDialogId.value === dialogId) {
        await loadDialogTopics(dialogId, topicsPagination.currentPage.value);
      }
      alert('Meta тег успешно добавлен!');
    } catch (error) {
      console.error('Error adding topic meta tag:', error);
      alert(`Ошибка добавления meta тега: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async function deleteTopicMetaTag(key: string) {
    if (!confirm(`Удалить meta тег "${key}"?`)) {
      return;
    }
    
    const dialogId = topicMetaDialogId.value;
    const topicId = topicMetaTopicId.value;
    try {
      const response = await fetch(`/api/meta/topic/${topicId}/${encodeURIComponent(key)}`, {
        method: 'DELETE',
        headers: credentialsStore.getHeaders(),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete meta tag');
      }
      
      await loadTopicMetaTags(dialogId, topicId);
      if (currentViewMode.value === 'topics' && currentDialogId.value === dialogId) {
        await loadDialogTopics(dialogId, topicsPagination.currentPage.value);
      }
      alert('Meta тег успешно удален!');
    } catch (error) {
      console.error('Error deleting topic meta tag:', error);
      alert(`Ошибка удаления meta тега: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }


  async function removeMemberFromPanel(dialogId: string, userId: string) {
    if (!confirm(`Удалить участника ${userId} из диалога?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/dialogs/${dialogId}/members/${userId}/remove`, {
        method: 'POST',
        headers: credentialsStore.getHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      alert(`Пользователь ${userId} успешно удален из диалога!`);
      
      await loadDialogMembers(dialogId, membersPagination.currentPage.value);
    } catch (error) {
      console.error('Error removing member:', error);
      alert(`Ошибка при удалении участника: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  function generateMembersApiUrl(dialogId: string): string {
    const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
    const params = new URLSearchParams({
      page: membersPagination.currentPage.value.toString(),
      limit: '10',
      sort: '(joinedAt,asc)'
    });
    if (membersFilter.currentFilter.value) {
      params.append('filter', membersFilter.currentFilter.value);
    }
    return `${baseUrl}/api/dialogs/${dialogId}/members?${params.toString()}`;
  }

  async function showMembersUrlModal() {
    if (!currentDialogId.value) {
      alert('Ошибка: не выбран диалог');
      return;
    }
    
    const url = generateMembersApiUrl(currentDialogId.value);
    urlModalTitle.value = 'URL запроса участников';
    urlModalUrl.value = url;
    urlCopyButtonText.value = '📋 Скопировать URL';
    urlModal.open();
  }

  async function showTopicsUrlModal() {
    if (!currentDialogId.value) {
      alert('Сначала выберите диалог');
      return;
    }
    
    if (!currentUserId.value) {
      alert('Сначала выберите пользователя');
      return;
    }
    
    const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
    const url = `${baseUrl}/api/users/${currentUserId.value}/dialogs/${currentDialogId.value}/topics?page=${topicsPagination.currentPage.value}&limit=10`;
    
    urlModalTitle.value = 'URL запроса топиков';
    urlModalUrl.value = url;
    urlCopyButtonText.value = '📋 Скопировать URL';
    urlModal.open();
  }

  // Lifecycle
  onMounted(() => {
    if (apiKey.value) {
      loadUsers(1, usersPagination.currentLimit.value);
    }
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
    totalDialogPages: dialogsPagination.totalPages,
    totalDialogs: dialogsPagination.totalItems,
    // Dialogs Filter
    filterValue: dialogsFilter.filterInput,
    selectedFilterExample: dialogsFilter.selectedFilterExample,
    currentDialogFilter: dialogsFilter.currentFilter,
    // Messages
    loadingMessages,
    messagesError,
    messages,
    showMessagesPagination,
    visibleMessagePages,
    // Messages Pagination
    currentMessagePage: messagesPagination.currentPage,
    totalMessagePages: messagesPagination.totalPages,
    totalMessages: messagesPagination.totalItems,
    // Messages Filter
    messageFilterInput: messagesFilter.filterInput,
    selectedMessageFilterExample: messagesFilter.selectedFilterExample,
    currentMessageFilter: messagesFilter.currentFilter,
    // Members
    loadingMembers,
    membersError,
    members,
    visibleMemberPages,
    // Members Pagination
    currentMemberPage: membersPagination.currentPage,
    totalMemberPages: membersPagination.totalPages,
    totalMembers: membersPagination.totalItems,
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
    totalTopicsPages: topicsPagination.totalPages,
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
    isDialogEventsModalOpen: dialogEventsModal.isOpen,
    isDialogMetaModalOpen: dialogMetaModal.isOpen,
    isAddMemberModalOpen: addMemberModal.isOpen,
    isAddTopicModalOpen: addTopicModal.isOpen,
    isMemberMetaModalOpen: memberMetaModal.isOpen,
    isMessageMetaModalOpen: messageMetaModal.isOpen,
    isTopicMetaModalOpen: topicMetaModal.isOpen,
    modalTitle,
    modalBody,
    modalUrl,
    currentModalJsonForCopy,
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
    loadUserDialogs,
    selectFilterExample,
    clearFilter,
    applyFilter,
    changeDialogPage,
    selectDialog,
    selectDialogMembers,
    selectDialogTopics,
    loadDialogMessages,
    selectMessageFilterExample,
    clearMessageFilter,
    applyMessageFilter,
    changeMessagePage,
    loadDialogMembers,
    selectMemberFilterExamplePanel,
    clearMemberFilterFieldPanel,
    applyMemberFilterPanel,
    changeMemberPage,
    loadDialogTopics,
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
    copyJsonToClipboardFromModal,
    copyToClipboardFromModal,
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
    loadingStatusMatrix,
    statusMatrixError,
    loadingStatuses,
    statusesError,
    statusesUrl,
    totalStatuses,
    currentMessageIdForSetStatus,
    setStatusResult,
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
    newTopicMetaKey,
    newTopicMetaValue,
    // Участники
    removeMemberFromPanel,
    generateMembersApiUrl,
    showMembersUrlModal,
    showTopicsUrlModal,
    // URL модалка
    showUrlModal: urlModal.isOpen,
    urlModalTitle,
    urlModalUrl,
    urlCopyButtonText,
    closeUrlModal: urlModal.close,
    copyUrlToClipboard,
  };
}
