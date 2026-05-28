/**
 * Модуль фильтрации данных
 * Отвечает за: построение фильтров для API, применение фильтров, работу с датами
 */
import { computed, Ref } from 'vue';

interface UseFiltersDependencies {
  currentModel: Ref<string | null>;
  filters: Ref<Record<string, any>>;
  pagination: {
    setPage: (page: number) => void;
  };
  loadModelData: () => Promise<void>;
  showDateRangeModal: () => void;
}

export function useFilters(deps: UseFiltersDependencies) {
  const { currentModel, filters, pagination, loadModelData, showDateRangeModal } = deps;

  // Поля с датами
  const dateFields = ['createdAt', 'lastSeenAt', 'lastMessageAt', 'lastInteractionAt', 'publishedAt', 'expiresAt', 'lastUsedAt', 'readAt', 'deliveredAt', 'joinedAt'];

  const hasActiveFilters = computed(() => {
    const activeFilters = Object.keys(filters.value).filter(key => 
      key !== 'createdAt_type' && key !== 'createdAt_from' && key !== 'createdAt_to'
    );
    return activeFilters.length > 0 || 
      (filters.value.createdAt_type && (currentModel.value === 'ApiJournal' || currentModel.value === 'DialogReadTask'));
  });

  function getStartOfDay(date: Date): number {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  function getEndOfDay(date: Date): number {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d.getTime();
  }

  function getDateRange(filterType: string): { start: number; end: number } | null {
    const now = new Date();
    let startDate: Date, endDate: Date;

    switch(filterType) {
      case 'today':
        startDate = new Date(now);
        endDate = new Date(now);
        break;
      case 'yesterday': {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        startDate = yesterday;
        endDate = yesterday;
        break;
      }
      case 'last7days': {
        const last7days = new Date(now);
        last7days.setDate(last7days.getDate() - 7);
        startDate = last7days;
        endDate = now;
        break;
      }
      case 'last30days': {
        const last30days = new Date(now);
        last30days.setDate(last30days.getDate() - 30);
        startDate = last30days;
        endDate = now;
        break;
      }
      case 'custom': {
        const fromDate = filters.value.createdAt_from;
        const toDate = filters.value.createdAt_to;
        if (fromDate && toDate) {
          startDate = new Date(fromDate);
          endDate = new Date(toDate);
        } else {
          return null;
        }
        break;
      }
      default:
        return null;
    }

    return { start: getStartOfDay(startDate), end: getEndOfDay(endDate) };
  }

  function buildApiFilter(): Record<string, any> | null {
    const apiFilter: Record<string, any> = {};
    
    // Фильтр по дате для createdAt в ApiJournal и DialogReadTask
    if ((currentModel.value === 'ApiJournal' || currentModel.value === 'DialogReadTask') && filters.value.createdAt_type) {
      const dateRange = getDateRange(filters.value.createdAt_type);
      if (dateRange) {
        apiFilter.createdAt = {
          $gte: dateRange.start,
          $lte: dateRange.end
        };
      }
    }
    
    // Добавляем другие фильтры
    Object.keys(filters.value).forEach(key => {
      if (key !== 'createdAt_type' && key !== 'createdAt_from' && key !== 'createdAt_to') {
        const filterValue = filters.value[key];
        if (filterValue && (typeof filterValue !== 'string' || filterValue.trim())) {
          if (key === 'isActive' && (filterValue === 'true' || filterValue === 'false')) {
            apiFilter[key] = filterValue === 'true';
          } else if (typeof filterValue === 'string') {
            apiFilter[key] = { $regex: filterValue, $options: 'i' };
          } else {
            apiFilter[key] = filterValue;
          }
        }
      }
    });
    
    return Object.keys(apiFilter).length > 0 ? apiFilter : null;
  }

  function applyFilter(fieldName: string, filterValue: string) {
    if (filterValue && filterValue.trim()) {
      filters.value[fieldName] = filterValue.trim();
    } else {
      delete filters.value[fieldName];
    }
    pagination.setPage(1);
    loadModelData();
  }

  function handleDateFilterChange(fieldName: string, filterType: string) {
    if (filterType === 'custom') {
      showDateRangeModal();
    } else {
      applyDateFilter(fieldName, filterType);
    }
  }

  function applyDateFilter(fieldName: string, filterType: string) {
    if (filterType) {
      filters.value[`${fieldName}_type`] = filterType;
      if (filterType !== 'custom') {
        delete filters.value[`${fieldName}_from`];
        delete filters.value[`${fieldName}_to`];
      }
    } else {
      delete filters.value[`${fieldName}_type`];
      delete filters.value[`${fieldName}_from`];
      delete filters.value[`${fieldName}_to`];
    }
    pagination.setPage(1);
    loadModelData();
  }

  return {
    dateFields,
    hasActiveFilters,
    buildApiFilter,
    applyFilter,
    handleDateFilterChange,
    applyDateFilter,
  };
}
