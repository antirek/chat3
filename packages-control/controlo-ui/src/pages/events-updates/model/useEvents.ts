/**
 * Модуль работы с событиями
 * Отвечает за: загрузку событий, выбор события, пагинацию событий, сортировку
 */
import { ref, computed, Ref } from 'vue';
import { getControlApiUrl, getTenantId } from './useUtils';
import { useCredentialsStore } from '@/app/stores/credentials';
import { useApiSort } from '@/shared/lib/composables/useApiSort';

interface UseEventsDependencies {
  credentialsStore: ReturnType<typeof useCredentialsStore>;
  pagination: {
    currentPage: Ref<number>;
    currentLimit: Ref<number>;
    totalPages: Ref<number>;
    setPaginationData: (total: number, pages: number) => void;
  };
  currentFilter: Ref<string>;
}

export function useEvents(deps: UseEventsDependencies) {
  const { credentialsStore, pagination, currentFilter } = deps;

  // Функция загрузки данных (нужна для callbacks)
  let loadEventsFn: () => Promise<void> = async () => {};

  // Сортировка для событий
  const eventsSort = useApiSort({
    initialSort: null,
    onSortChange: () => {
      // При изменении сортировки перезагружаем данные
      pagination.currentPage.value = 1;
      if (loadEventsFn) {
        loadEventsFn();
      }
    },
  });

  // State для событий
  const events = ref<any[]>([]);
  const loadingEvents = ref(false);
  const eventsError = ref<string | null>(null);
  const selectedEventId = ref<string | null>(null);

  // Computed
  const eventsTotal = computed(() => pagination.totalPages.value * pagination.currentLimit.value);
  const eventsPaginationInfo = computed(() => {
    const total = eventsTotal.value;
    const start = (pagination.currentPage.value - 1) * pagination.currentLimit.value + 1;
    const end = Math.min(pagination.currentPage.value * pagination.currentLimit.value, total);
    return `${start}-${end} из ${total}`;
  });

  // Загрузить события
  async function loadEvents() {
    loadingEvents.value = true;
    eventsError.value = null;

    try {
      const params = new URLSearchParams({
        tenantId: getTenantId(credentialsStore),
        page: pagination.currentPage.value.toString(),
        limit: pagination.currentLimit.value.toString(),
      });

      // Добавить фильтры
      if (currentFilter.value) {
        const filterParts = currentFilter.value.split('=');
        if (filterParts.length === 2) {
          params.append(filterParts[0].trim(), filterParts[1].trim());
        }
      }

      // Добавить сортировку
      if (eventsSort.currentSort.value) {
        params.append('sort', eventsSort.currentSort.value);
      }

      const url = getControlApiUrl(`/api/events?${params.toString()}`);
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const result = await response.json();
      const eventsData = result.data || [];
      const paginationData = result.pagination || {};

      pagination.setPaginationData(
        (paginationData.total || eventsData.length),
        paginationData.pages || 1
      );
      events.value = eventsData;
    } catch (error) {
      eventsError.value = error instanceof Error ? error.message : 'Unknown error';
      events.value = [];
    } finally {
      loadingEvents.value = false;
    }
  }

  // Выбрать событие
  function selectEvent(eventId: string) {
    selectedEventId.value = eventId;
  }

  // Показать обновления для события
  function showEventUpdates(eventId: string) {
    selectEvent(eventId);
  }

  // Сортировка
  function sortEvents(field: string) {
    eventsSort.toggleSort(field);
  }

  // Сохраняем ссылку на функцию для callbacks
  loadEventsFn = loadEvents;

  return {
    events,
    loadingEvents,
    eventsError,
    selectedEventId,
    eventsTotal,
    eventsPaginationInfo,
    loadEvents,
    selectEvent,
    showEventUpdates,
    sortEvents,
    getSortIndicator: eventsSort.getSortIndicator,
  };
}
