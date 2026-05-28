import { ref } from 'vue';

export interface UseFilterOptions {
  initialFilter?: string;
  onFilterChange?: (filter: string) => void;
}

export function useFilter(options: UseFilterOptions = {}) {
  const {
    initialFilter = '',
    onFilterChange,
  } = options;

  const currentFilter = ref(initialFilter);
  const filterInput = ref('');
  const selectedFilterExample = ref('');

  function applyFilter() {
    currentFilter.value = filterInput.value.trim();
    if (onFilterChange) {
      onFilterChange(currentFilter.value);
    }
  }

  function clearFilter() {
    filterInput.value = '';
    selectedFilterExample.value = '';
    currentFilter.value = '';
    if (onFilterChange) {
      onFilterChange('');
    }
  }

  function selectFilterExample(example: string) {
    if (example && example !== 'custom') {
      filterInput.value = example;
    } else if (example === 'custom') {
      filterInput.value = '';
    }
  }

  return {
    // State
    currentFilter,
    filterInput,
    selectedFilterExample,
    // Functions
    applyFilter,
    clearFilter,
    selectFilterExample,
  };
}
