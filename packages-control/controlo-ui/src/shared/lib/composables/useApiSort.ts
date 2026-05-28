/**
 * Composable для сортировки в формате API: (field,direction)
 * Используется для сортировки, которая передается в API запросы
 */
import { ref } from 'vue';

export interface UseApiSortOptions {
  initialSort?: string | null;
  onSortChange?: (sort: string | null) => void;
}

export function useApiSort(options: UseApiSortOptions = {}) {
  const { initialSort = null, onSortChange } = options;

  const currentSort = ref<string | null>(initialSort);

  function toggleSort(field: string) {
    let newSort: string | null = null;

    if (!currentSort.value || !currentSort.value.includes(field)) {
      newSort = `(${field},asc)`;
    } else if (currentSort.value.includes('asc')) {
      newSort = `(${field},desc)`;
    } else {
      newSort = null;
    }

    currentSort.value = newSort;
    if (onSortChange) {
      onSortChange(newSort);
    }
  }

  function getSortIndicator(field: string) {
    if (!currentSort.value || !currentSort.value.includes(field)) {
      return '◄';
    } else if (currentSort.value.includes('asc')) {
      return '▲';
    } else {
      return '▼';
    }
  }

  function clearSort() {
    currentSort.value = null;
    if (onSortChange) {
      onSortChange(null);
    }
  }

  function setSort(field: string, direction: 'asc' | 'desc') {
    currentSort.value = `(${field},${direction})`;
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
    clearSort,
    setSort,
  };
}
