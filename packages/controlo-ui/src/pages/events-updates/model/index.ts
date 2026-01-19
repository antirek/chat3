import { ref, onMounted } from 'vue';
import { useCredentialsStore } from '@/app/stores/credentials';
import { usePagination } from '@/shared/lib/composables/usePagination';
import { formatTimestamp } from './useUtils';
import { useEvents } from './useEvents';
import { useUpdates } from './useUpdates';
import { useFilters } from './useFilters';
import { useModals } from './useModals';
import { useNavigation } from './useNavigation';

export function useEventsUpdatesPage() {
  // Конфигурация
  const credentialsStore = useCredentialsStore();

  // Фильтры для событий
  const currentEventsFilter = ref('');
  const eventsFilterInput = ref('');
  const eventsFilterApplied = ref(false);

  // Пагинация для событий
  let loadEventsFn: () => Promise<void> = async () => {};
  const eventsPagination = usePagination({
    initialPage: 1,
    initialLimit: 50,
    onPageChange: () => {
      loadEventsFn();
    },
  });

  // Модуль событий
  const eventsModule = useEvents({
    credentialsStore,
    pagination: {
      currentPage: eventsPagination.currentPage,
      currentLimit: eventsPagination.currentLimit,
      totalPages: eventsPagination.totalPages,
      setPaginationData: eventsPagination.setPaginationData,
    },
    currentFilter: currentEventsFilter,
  });

  loadEventsFn = eventsModule.loadEvents;

  // Фильтры для обновлений
  const currentUpdatesFilter = ref('');
  const updatesFilterInput = ref('');
  const updatesFilterApplied = ref(false);

  // Пагинация для обновлений
  let loadUpdatesFn: () => Promise<void> = async () => {};
  const updatesPagination = usePagination({
    initialPage: 1,
    initialLimit: 50,
    onPageChange: () => {
      loadUpdatesFn();
    },
  });

  // Модуль обновлений
  const updatesModule = useUpdates({
    credentialsStore,
    pagination: {
      currentPage: updatesPagination.currentPage,
      currentLimit: updatesPagination.currentLimit,
      totalPages: updatesPagination.totalPages,
      setPaginationData: updatesPagination.setPaginationData,
    },
    currentFilter: currentUpdatesFilter,
    selectedEventId: eventsModule.selectedEventId,
  });

  loadUpdatesFn = updatesModule.loadUpdates;

  // Модуль фильтров
  const filtersModule = useFilters({
    eventsFilter: {
      currentFilter: currentEventsFilter,
      filterInput: eventsFilterInput,
      filterApplied: eventsFilterApplied,
    },
    updatesFilter: {
      currentFilter: currentUpdatesFilter,
      filterInput: updatesFilterInput,
      filterApplied: updatesFilterApplied,
    },
    eventsPagination: {
      setPage: eventsPagination.setPage,
    },
    updatesPagination: {
      setPage: updatesPagination.setPage,
    },
    loadEvents: eventsModule.loadEvents,
    loadUpdates: updatesModule.loadUpdates,
  });

  // Модуль модальных окон
  const modalsModule = useModals({
    credentialsStore,
    eventsPagination: {
      currentPage: eventsPagination.currentPage,
      currentLimit: eventsPagination.currentLimit,
    },
    updatesPagination: {
      currentPage: updatesPagination.currentPage,
      currentLimit: updatesPagination.currentLimit,
    },
    currentEventsFilter,
    currentUpdatesFilter,
    selectedEventId: eventsModule.selectedEventId,
  });

  // Модуль навигации
  const navigationModule = useNavigation({
    eventsPagination: {
      goToPage: eventsPagination.goToPage,
      setPage: eventsPagination.setPage,
    },
    updatesPagination: {
      goToPage: updatesPagination.goToPage,
      setPage: updatesPagination.setPage,
    },
    loadEvents: eventsModule.loadEvents,
    loadUpdates: updatesModule.loadUpdates,
  });

  // Выбрать событие и загрузить связанные обновления
  function selectEvent(eventId: string) {
    eventsModule.selectEvent(eventId);
    updatesPagination.setPage(1);
    updatesModule.loadUpdates();
  }

  // Показать обновления для события
  function showEventUpdates(eventId: string) {
    selectEvent(eventId);
  }

  // Инициализация
  onMounted(() => {
    credentialsStore.loadFromStorage();
    eventsModule.loadEvents();
    updatesModule.loadUpdates();
    modalsModule.initEscHandler();
  });

  return {
    // События
    events: eventsModule.events,
    loadingEvents: eventsModule.loadingEvents,
    eventsError: eventsModule.eventsError,
    currentEventsPage: eventsPagination.currentPage,
    currentEventsPageInput: eventsPagination.currentPageInput,
    eventsTotalPages: eventsPagination.totalPages,
    currentEventsLimit: eventsPagination.currentLimit,
    eventsTotal: eventsModule.eventsTotal,
    eventsPaginationInfo: eventsModule.eventsPaginationInfo,
    currentEventsFilter,
    eventsFilterInput,
    eventsFilterApplied,
    selectedEventId: eventsModule.selectedEventId,
    // Обновления
    updates: updatesModule.updates,
    loadingUpdates: updatesModule.loadingUpdates,
    updatesError: updatesModule.updatesError,
    currentUpdatesPage: updatesPagination.currentPage,
    currentUpdatesPageInput: updatesPagination.currentPageInput,
    updatesTotalPages: updatesPagination.totalPages,
    currentUpdatesLimit: updatesPagination.currentLimit,
    updatesTotal: updatesModule.updatesTotal,
    updatesPaginationInfo: updatesModule.updatesPaginationInfo,
    currentUpdatesFilter,
    updatesFilterInput,
    updatesFilterApplied,
    // Модальные окна
    showUrlModalFlag: modalsModule.urlModal.isOpen,
    showJsonModalFlag: modalsModule.jsonModal.isOpen,
    urlModalContent: modalsModule.urlModalContent,
    jsonModalUrl: modalsModule.jsonModalUrl,
    jsonModalContent: modalsModule.jsonModalContent,
    // Функции
    goToPage: navigationModule.goToPage,
    changeLimit: navigationModule.changeLimit,
    setFilterExample: filtersModule.setFilterExample,
    clearFilter: filtersModule.clearFilter,
    applyFilter: filtersModule.applyFilter,
    sortEvents: eventsModule.sortEvents,
    sortUpdates: updatesModule.sortUpdates,
    selectEvent,
    showEventUpdates,
    showEventJson: modalsModule.showEventJson,
    showUpdateJson: modalsModule.showUpdateJson,
    showUrlModal: modalsModule.showUrlModal,
    closeUrlModal: modalsModule.urlModal.close,
    closeJsonModal: modalsModule.jsonModal.close,
    copyUrl: modalsModule.copyUrl,
    copyJson: modalsModule.copyJson,
    formatTimestamp,
  };
}
