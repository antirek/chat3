/**
 * Модуль работы с данными модели
 * Отвечает за: загрузку данных модели, форматирование значений, определение колонок таблицы
 */
import { ref, computed, Ref } from 'vue';
import { getControlApiUrl } from './useUtils';

interface UseDataDependencies {
  currentModel: Ref<string | null>;
  pagination: {
    currentPage: Ref<number>;
    currentLimit: Ref<number>;
    setPaginationData: (total: number, pages: number) => void;
  };
  buildApiFilter: () => Record<string, any> | null;
}

export function useData(deps: UseDataDependencies) {
  const { currentModel, pagination, buildApiFilter } = deps;

  // State для данных
  const loadingData = ref(false);
  const dataError = ref<string | null>(null);
  const originalData = ref<any[]>([]);

  // Computed
  const filteredData = computed(() => {
    return originalData.value;
  });

  const tableKeys = computed(() => {
    if (originalData.value.length === 0) return [];
    
    const allKeys = new Set<string>();
    originalData.value.forEach(item => {
      Object.keys(item).forEach(key => {
        if (key !== '_id' && key !== '__v') {
          if (currentModel.value === 'Update' && key === 'entityId') {
            return;
          }
          allKeys.add(key);
        }
      });
    });
    
    let keys = Array.from(allKeys).slice(0, 20);
    
    // Для моделей ApiJournal и DialogReadTask делаем createdAt первой колонкой
    if ((currentModel.value === 'ApiJournal' || currentModel.value === 'DialogReadTask') && keys.includes('createdAt')) {
      keys = ['createdAt', ...keys.filter(key => key !== 'createdAt')];
    }
    
    return keys;
  });

  async function loadModelData() {
    if (!currentModel.value) return;

    loadingData.value = true;
    dataError.value = null;

    try {
      const url = new URL(getControlApiUrl(`/api/db-explorer/models/${currentModel.value}`));
      url.searchParams.set('page', pagination.currentPage.value.toString());
      url.searchParams.set('limit', pagination.currentLimit.value.toString());

      const apiFilter = buildApiFilter();
      if (apiFilter) {
        url.searchParams.set('filter', JSON.stringify(apiFilter));
      }

      const response = await fetch(url.toString());
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to load data');
      }
      const result = await response.json();

      if (result.data.length === 0) {
        originalData.value = [];
        return;
      }

      originalData.value = result.data;
      pagination.setPaginationData(result.pagination.total || 0, result.pagination.pages || 1);
    } catch (error: any) {
      dataError.value = error.message;
      console.error('Error loading model data:', error);
    } finally {
      loadingData.value = false;
    }
  }

  function formatDateValue(value: any): string {
    let timestamp: number;
    
    if (typeof value === 'number') {
      timestamp = value;
    } else if (typeof value === 'string') {
      const parsed = parseFloat(value);
      if (!isNaN(parsed)) {
        timestamp = parsed;
      } else {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          return date.toLocaleString('ru-RU', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
          });
        } else {
          return String(value);
        }
      }
    } else if (value instanceof Date) {
      if (isNaN(value.getTime())) {
        return String(value);
      }
      return value.toLocaleString('ru-RU', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    } else {
      return String(value);
    }
    
    if (timestamp === undefined || isNaN(timestamp)) {
      return String(value);
    }
    
    const roundedTimestamp = Math.floor(timestamp);
    const date = new Date(roundedTimestamp > 1000000000000 ? roundedTimestamp : roundedTimestamp * 1000);
    
    if (isNaN(date.getTime())) {
      return String(value);
    }
    
    return date.toLocaleString('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  }

  function getItemId(item: any, index: number): string {
    return item._id || item.userId || item.dialogId || item.messageId || item.tenantId || item.key || String(index);
  }

  return {
    loadingData,
    dataError,
    originalData,
    filteredData,
    tableKeys,
    loadModelData,
    formatDateValue,
    getItemId,
  };
}
