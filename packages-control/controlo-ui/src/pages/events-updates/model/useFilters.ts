/**
 * Модуль работы с фильтрами
 * Отвечает за: управление фильтрами для событий и обновлений
 */
import { Ref } from 'vue';

interface FilterState {
  currentFilter: Ref<string>;
  filterInput: Ref<string>;
  filterApplied: Ref<boolean>;
}

interface UseFiltersDependencies {
  eventsFilter: FilterState;
  updatesFilter: FilterState;
  eventsPagination: {
    setPage: (page: number) => void;
  };
  updatesPagination: {
    setPage: (page: number) => void;
  };
  loadEvents: () => Promise<void>;
  loadUpdates: () => Promise<void>;
}

export function useFilters(deps: UseFiltersDependencies) {
  const {
    eventsFilter,
    updatesFilter,
    eventsPagination,
    updatesPagination,
    loadEvents,
    loadUpdates,
  } = deps;

  // Установить пример фильтра
  function setFilterExample(type: 'events' | 'updates', field: string, value: string) {
    if (type === 'events') {
      eventsFilter.filterInput.value = `${field}=${value}`;
    } else {
      updatesFilter.filterInput.value = `${field}=${value}`;
    }
  }

  // Очистить фильтр
  function clearFilter(type: 'events' | 'updates') {
    if (type === 'events') {
      eventsFilter.filterInput.value = '';
      eventsFilter.currentFilter.value = '';
      eventsFilter.filterApplied.value = false;
      eventsPagination.setPage(1);
      loadEvents();
    } else {
      updatesFilter.filterInput.value = '';
      updatesFilter.currentFilter.value = '';
      updatesFilter.filterApplied.value = false;
      updatesPagination.setPage(1);
      loadUpdates();
    }
  }

  // Применить фильтр
  function applyFilter(type: 'events' | 'updates') {
    if (type === 'events') {
      eventsFilter.currentFilter.value = eventsFilter.filterInput.value.trim();
      eventsFilter.filterApplied.value = true;
      eventsPagination.setPage(1);
      loadEvents();
      setTimeout(() => {
        eventsFilter.filterApplied.value = false;
      }, 1000);
    } else {
      updatesFilter.currentFilter.value = updatesFilter.filterInput.value.trim();
      updatesFilter.filterApplied.value = true;
      updatesPagination.setPage(1);
      loadUpdates();
      setTimeout(() => {
        updatesFilter.filterApplied.value = false;
      }, 1000);
    }
  }

  return {
    setFilterExample,
    clearFilter,
    applyFilter,
  };
}
