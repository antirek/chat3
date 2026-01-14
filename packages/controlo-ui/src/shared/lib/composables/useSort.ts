import { ref } from 'vue';

export interface SortState {
  field: string;
  order: 1 | -1;
}

export interface UseSortOptions {
  initialField?: string;
  initialOrder?: 1 | -1;
  onSortChange?: (sort: SortState) => void;
}

export function useSort(options: UseSortOptions = {}) {
  const {
    initialField = 'createdAt',
    initialOrder = -1,
    onSortChange,
  } = options;

  const currentSort = ref<SortState>({
    field: initialField,
    order: initialOrder,
  });

  function toggleSort(field: string) {
    if (currentSort.value.field === field) {
      currentSort.value.order = currentSort.value.order === 1 ? -1 : 1;
    } else {
      currentSort.value.field = field;
      currentSort.value.order = -1;
    }
    if (onSortChange) {
      onSortChange(currentSort.value);
    }
  }

  function getSortIndicator(field: string) {
    if (currentSort.value.field === field) {
      return currentSort.value.order === 1 ? ' ▲' : ' ▼';
    }
    return '';
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
