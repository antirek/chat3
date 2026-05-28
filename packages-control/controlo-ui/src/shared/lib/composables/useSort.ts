import { ref } from 'vue';

export interface SortState {
  field: string;
  order: 1 | -1;
}

export interface UseSortOptions {
  initialField?: string;
  initialOrder?: 1 | -1;
  onSortChange?: (sort: SortState) => void;
  allowReset?: boolean; // Если true, при третьем клике сбрасывает сортировку
  showIdleIndicator?: boolean; // Если true, показывает ◄ для неактивных полей
}

export function useSort(options: UseSortOptions = {}) {
  const {
    initialField = 'createdAt',
    initialOrder = -1,
    onSortChange,
    allowReset = false,
    showIdleIndicator = false,
  } = options;

  const currentSort = ref<SortState>({
    field: initialField,
    order: initialOrder,
  });

  function toggleSort(field: string) {
    if (allowReset && currentSort.value.field === field) {
      // Логика сброса: при третьем клике сбрасываем сортировку
      if (currentSort.value.order === -1) {
        // Если порядок убывающий, меняем на возрастающий
        currentSort.value.order = 1;
      } else {
        // Если порядок возрастающий, сбрасываем сортировку
        currentSort.value.field = '';
        currentSort.value.order = -1;
      }
    } else {
      // Стандартная логика
      if (currentSort.value.field === field) {
        currentSort.value.order = currentSort.value.order === 1 ? -1 : 1;
      } else {
        currentSort.value.field = field;
        currentSort.value.order = -1;
      }
    }
    if (onSortChange) {
      onSortChange(currentSort.value);
    }
  }

  function getSortIndicator(field: string) {
    if (currentSort.value.field === field) {
      return currentSort.value.order === 1 ? ' ▲' : ' ▼';
    }
    // Если включен показ индикатора для неактивных полей
    return showIdleIndicator ? '◄' : '';
  }

  function setSort(field: string, order: 1 | -1) {
    currentSort.value = { field, order };
    if (onSortChange) {
      onSortChange(currentSort.value);
    }
  }

  return {
    // State
    currentSort,
    // Functions
    toggleSort,
    getSortIndicator,
    setSort,
  };
}
