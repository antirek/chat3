/* eslint-env browser */
/* global alert */
import { ref, computed, onMounted, watch, toRef } from 'vue';
import { useConfigStore } from '@/app/stores/config';
import { useCredentialsStore } from '@/app/stores/credentials';
import { usePagination } from '@/shared/lib/composables/usePagination';
import { useModal } from '@/shared/lib/composables/useModal';

export function useEventsUpdatesPage() {
  // Конфигурация
  const configStore = useConfigStore();
  const credentialsStore = useCredentialsStore();

  // Используем credentials из store
  const tenantId = toRef(credentialsStore, 'tenantId');

  // Состояние событий
  const events = ref<any[]>([]);
  const loadingEvents = ref(false);
  const eventsError = ref<string | null>(null);
  const currentEventsFilter = ref('');
  const eventsFilterInput = ref('');
  const eventsFilterApplied = ref(false);
  const selectedEventId = ref<string | null>(null);

  // Пагинация для событий
  const eventsPagination = usePagination({
    initialPage: 1,
    initialLimit: 50,
    onPageChange: () => {
      loadEvents();
    },
  });

  // Состояние обновлений
  const updates = ref<any[]>([]);
  const loadingUpdates = ref(false);
  const updatesError = ref<string | null>(null);
  const currentUpdatesFilter = ref('');
  const updatesFilterInput = ref('');
  const updatesFilterApplied = ref(false);

  // Пагинация для обновлений
  const updatesPagination = usePagination({
    initialPage: 1,
    initialLimit: 50,
    onPageChange: () => {
      loadUpdates();
    },
  });

  // Модальные окна
  const urlModal = useModal();
  const jsonModal = useModal();
  const urlModalContent = ref('');
  const jsonModalUrl = ref('');
  const jsonModalContent = ref('');

  // Computed
  const eventsTotal = computed(() => eventsPagination.totalPages.value * eventsPagination.currentLimit.value);
  const eventsPaginationInfo = computed(() => {
    const total = eventsTotal.value;
    const start = (eventsPagination.currentPage.value - 1) * eventsPagination.currentLimit.value + 1;
    const end = Math.min(eventsPagination.currentPage.value * eventsPagination.currentLimit.value, total);
    return `${start}-${end} из ${total}`;
  });

  const updatesTotal = computed(() => updatesPagination.totalPages.value * updatesPagination.currentLimit.value);
  const updatesPaginationInfo = computed(() => {
    const total = updatesTotal.value;
    const start = (updatesPagination.currentPage.value - 1) * updatesPagination.currentLimit.value + 1;
    const end = Math.min(updatesPagination.currentPage.value * updatesPagination.currentLimit.value, total);
    return `${start}-${end} из ${total}`;
  });

  // Получить URL для control-api
  function getControlApiUrl(path = '') {
    if (typeof window !== 'undefined' && (window as any).CHAT3_CONFIG && (window as any).CHAT3_CONFIG.getControlApiUrl) {
      return (window as any).CHAT3_CONFIG.getControlApiUrl(path);
    }
    const controlApiUrl = configStore.config.CONTROL_APP_URL || 'http://localhost:3001';
    return `${controlApiUrl}${path}`;
  }

  // Получить tenantId
  function getTenantId() {
    return tenantId.value || 'tnt_default';
  }

  // Загрузить события
  async function loadEvents() {
    loadingEvents.value = true;
    eventsError.value = null;

    try {
      const params = new URLSearchParams({
        tenantId: getTenantId(),
        page: eventsPagination.currentPage.value.toString(),
        limit: eventsPagination.currentLimit.value.toString(),
      });

      // Добавить фильтры
      if (currentEventsFilter.value) {
        const filterParts = currentEventsFilter.value.split('=');
        if (filterParts.length === 2) {
          params.append(filterParts[0].trim(), filterParts[1].trim());
        }
      }

      const url = getControlApiUrl(`/api/events?${params.toString()}`);
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const result = await response.json();
      const eventsData = result.data || [];
      const pagination = result.pagination || {};

      eventsPagination.setPaginationData(
        (pagination.total || eventsData.length),
        pagination.pages || 1
      );
      events.value = eventsData;
    } catch (error) {
      eventsError.value = error instanceof Error ? error.message : 'Unknown error';
      events.value = [];
    } finally {
      loadingEvents.value = false;
    }
  }

  // Загрузить обновления
  async function loadUpdates() {
    loadingUpdates.value = true;
    updatesError.value = null;

    try {
      const params = new URLSearchParams({
        tenantId: getTenantId(),
        page: updatesPagination.currentPage.value.toString(),
        limit: updatesPagination.currentLimit.value.toString(),
      });

      // Если выбрано событие, фильтруем по eventId
      if (selectedEventId.value) {
        params.append('eventId', selectedEventId.value);
      }

      // Добавить фильтры
      if (currentUpdatesFilter.value) {
        const filterParts = currentUpdatesFilter.value.split('=');
        if (filterParts.length === 2) {
          params.append(filterParts[0].trim(), filterParts[1].trim());
        }
      }

      const url = getControlApiUrl(`/api/updates?${params.toString()}`);
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const result = await response.json();
      const updatesData = result.data || [];
      const pagination = result.pagination || {};

      updatesPagination.setPaginationData(
        (pagination.total || updatesData.length),
        pagination.pages || 1
      );
      updates.value = updatesData;
    } catch (error) {
      updatesError.value = error instanceof Error ? error.message : 'Unknown error';
      updates.value = [];
    } finally {
      loadingUpdates.value = false;
    }
  }

  // Выбрать событие и загрузить связанные обновления
  function selectEvent(eventId: string) {
    selectedEventId.value = eventId;
    updatesPagination.setPage(1);
    loadUpdates();
  }

  // Показать обновления для события
  function showEventUpdates(eventId: string) {
    selectEvent(eventId);
  }

  // Перейти на страницу
  function goToPage(type: 'events' | 'updates', page: number) {
    if (type === 'events') {
      eventsPagination.goToPage(page);
      loadEvents();
    } else {
      updatesPagination.goToPage(page);
      loadUpdates();
    }
  }

  // Изменить лимит
  function changeLimit(type: 'events' | 'updates') {
    if (type === 'events') {
      // Лимит уже обновлен через v-model, просто обновляем страницу и загружаем данные
      eventsPagination.setPage(1);
      loadEvents();
    } else {
      // Лимит уже обновлен через v-model, просто обновляем страницу и загружаем данные
      updatesPagination.setPage(1);
      loadUpdates();
    }
  }

  // Установить пример фильтра
  function setFilterExample(type: 'events' | 'updates', field: string, value: string) {
    if (type === 'events') {
      eventsFilterInput.value = `${field}=${value}`;
    } else {
      updatesFilterInput.value = `${field}=${value}`;
    }
  }

  // Очистить фильтр
  function clearFilter(type: 'events' | 'updates') {
    if (type === 'events') {
      eventsFilterInput.value = '';
      currentEventsFilter.value = '';
      eventsFilterApplied.value = false;
      eventsPagination.setPage(1);
      loadEvents();
    } else {
      updatesFilterInput.value = '';
      currentUpdatesFilter.value = '';
      updatesFilterApplied.value = false;
      updatesPagination.setPage(1);
      loadUpdates();
    }
  }

  // Применить фильтр
  function applyFilter(type: 'events' | 'updates') {
    if (type === 'events') {
      currentEventsFilter.value = eventsFilterInput.value.trim();
      eventsFilterApplied.value = true;
      eventsPagination.setPage(1);
      loadEvents();
      setTimeout(() => {
        eventsFilterApplied.value = false;
      }, 1000);
    } else {
      currentUpdatesFilter.value = updatesFilterInput.value.trim();
      updatesFilterApplied.value = true;
      updatesPagination.setPage(1);
      loadUpdates();
      setTimeout(() => {
        updatesFilterApplied.value = false;
      }, 1000);
    }
  }

  // Сортировка (заглушка)
  function sortEvents(field: string) {
    // TODO: реализовать сортировку
  }

  function sortUpdates(field: string) {
    // TODO: реализовать сортировку
  }

  // Показать JSON события
  function showEventJson(eventId: string, eventJson: any) {
    const params = new URLSearchParams({
      tenantId: getTenantId(),
      page: eventsPagination.currentPage.value.toString(),
      limit: eventsPagination.currentLimit.value.toString(),
    });
    jsonModalUrl.value = getControlApiUrl(`/api/events?${params.toString()}`);
    jsonModalContent.value = JSON.stringify(eventJson, null, 2);
    jsonModal.open();
  }

  // Показать JSON обновления
  function showUpdateJson(updateId: string, updateJson: any) {
    const params = new URLSearchParams({
      tenantId: getTenantId(),
      page: updatesPagination.currentPage.value.toString(),
      limit: updatesPagination.currentLimit.value.toString(),
    });
    if (selectedEventId.value) {
      params.append('eventId', selectedEventId.value);
    }
    jsonModalUrl.value = getControlApiUrl(`/api/updates?${params.toString()}`);
    jsonModalContent.value = JSON.stringify(updateJson, null, 2);
    jsonModal.open();
  }

  // Показать модальное окно URL
  function showUrlModal(type: 'events' | 'updates') {
    let url = '';

    if (type === 'events') {
      const params = new URLSearchParams({
        tenantId: getTenantId(),
        page: eventsPagination.currentPage.value.toString(),
        limit: eventsPagination.currentLimit.value.toString(),
      });
      if (currentEventsFilter.value) {
        const filterParts = currentEventsFilter.value.split('=');
        if (filterParts.length === 2) {
          params.append(filterParts[0].trim(), filterParts[1].trim());
        }
      }
      url = getControlApiUrl(`/api/events?${params.toString()}`);
    } else {
      const params = new URLSearchParams({
        tenantId: getTenantId(),
        page: updatesPagination.currentPage.value.toString(),
        limit: updatesPagination.currentLimit.value.toString(),
      });
      if (selectedEventId.value) {
        params.append('eventId', selectedEventId.value);
      }
      if (currentUpdatesFilter.value) {
        const filterParts = currentUpdatesFilter.value.split('=');
        if (filterParts.length === 2) {
          params.append(filterParts[0].trim(), filterParts[1].trim());
        }
      }
      url = getControlApiUrl(`/api/updates?${params.toString()}`);
    }

    urlModalContent.value = url;
    urlModal.open();
  }

  // Копировать URL
  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(urlModalContent.value);
      alert('URL скопирован в буфер обмена');
    } catch (error) {
      console.error('Error copying URL:', error);
    }
  }

  // Копировать JSON
  async function copyJson() {
    try {
      await navigator.clipboard.writeText(jsonModalContent.value);
      alert('JSON скопирован в буфер обмена');
    } catch (error) {
      console.error('Error copying JSON:', error);
    }
  }

  // Форматировать timestamp
  function formatTimestamp(ts: string | number | null | undefined) {
    if (!ts) return '-';
    const timestamp = typeof ts === 'string' ? parseFloat(ts) : ts;
    const date = new Date(Math.floor(timestamp));
    return date.toLocaleString('ru-RU');
  }

  // Инициализация
  onMounted(() => {
    credentialsStore.loadFromStorage();
    loadEvents();
    loadUpdates();

    // Закрытие модальных окон по Esc
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        urlModal.close();
        jsonModal.close();
      }
    });
  });

  return {
    // События
    events,
    loadingEvents,
    eventsError,
    currentEventsPage: eventsPagination.currentPage,
    currentEventsPageInput: eventsPagination.currentPageInput,
    eventsTotalPages: eventsPagination.totalPages,
    currentEventsLimit: eventsPagination.currentLimit,
    eventsTotal,
    eventsPaginationInfo,
    currentEventsFilter,
    eventsFilterInput,
    eventsFilterApplied,
    selectedEventId,
    // Обновления
    updates,
    loadingUpdates,
    updatesError,
    currentUpdatesPage: updatesPagination.currentPage,
    currentUpdatesPageInput: updatesPagination.currentPageInput,
    updatesTotalPages: updatesPagination.totalPages,
    currentUpdatesLimit: updatesPagination.currentLimit,
    updatesTotal,
    updatesPaginationInfo,
    currentUpdatesFilter,
    updatesFilterInput,
    updatesFilterApplied,
    // Модальные окна
    showUrlModalFlag: urlModal.isOpen,
    showJsonModalFlag: jsonModal.isOpen,
    urlModalContent,
    jsonModalUrl,
    jsonModalContent,
    // Функции
    goToPage,
    changeLimit,
    setFilterExample,
    clearFilter,
    applyFilter,
    sortEvents,
    sortUpdates,
    selectEvent,
    showEventUpdates,
    showEventJson,
    showUpdateJson,
    showUrlModal,
    closeUrlModal: urlModal.close,
    closeJsonModal: jsonModal.close,
    copyUrl,
    copyJson,
    formatTimestamp,
  };
}
