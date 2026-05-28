import { ref, computed, watch } from 'vue';

export interface UsePaginationOptions {
  initialPage?: number;
  initialLimit?: number;
  onPageChange?: (page: number, limit: number) => void;
}

export function usePagination(options: UsePaginationOptions = {}) {
  const {
    initialPage = 1,
    initialLimit = 20,
    onPageChange,
  } = options;

  const currentPage = ref(initialPage);
  const currentLimit = ref(initialLimit);
  const totalPages = ref(1);
  const totalItems = ref(0);
  const currentPageInput = ref(initialPage);

  // Computed
  const paginationStart = computed(() => {
    return (currentPage.value - 1) * currentLimit.value + 1;
  });

  const paginationEnd = computed(() => {
    return Math.min(currentPage.value * currentLimit.value, totalItems.value);
  });

  // Функции навигации
  function goToFirstPage() {
    if (currentPage.value > 1) {
      setPage(1);
    }
  }

  function goToPreviousPage() {
    if (currentPage.value > 1) {
      setPage(currentPage.value - 1);
    }
  }

  function goToNextPage() {
    if (currentPage.value < totalPages.value) {
      setPage(currentPage.value + 1);
    }
  }

  function goToLastPage() {
    if (currentPage.value < totalPages.value) {
      setPage(totalPages.value);
    }
  }

  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages.value) {
      setPage(page);
    } else {
      currentPageInput.value = currentPage.value;
    }
  }

  function changeLimit(limit: number) {
    currentLimit.value = limit;
    setPage(1);
  }

  function setPage(page: number) {
    currentPage.value = page;
    currentPageInput.value = page;
    if (onPageChange) {
      onPageChange(page, currentLimit.value);
    }
  }

  function setPaginationData(total: number, pages: number) {
    totalItems.value = total;
    totalPages.value = pages;
  }

  // Синхронизация currentPageInput с currentPage
  watch(currentPage, (newValue) => {
    currentPageInput.value = newValue;
  });

  return {
    // State
    currentPage,
    currentLimit,
    totalPages,
    totalItems,
    currentPageInput,
    // Computed
    paginationStart,
    paginationEnd,
    // Functions
    goToFirstPage,
    goToPreviousPage,
    goToNextPage,
    goToLastPage,
    goToPage,
    changeLimit,
    setPage,
    setPaginationData,
  };
}
