import { ref, computed, onMounted } from 'vue';
import { usePagination } from '@/shared/lib/composables/usePagination';
import { useModels } from './useModels';
import { useData } from './useData';
import { useFilters } from './useFilters';
import { useItemModals } from './useItemModals';
import { useDataModal } from './useDataModal';
import { useDateRangeModal } from './useDateRangeModal';

export function useDbExplorerPage() {
  // State для данных
  const currentModel = ref<string | null>(null);
  const filters = ref<Record<string, any>>({});

  // Создание модулей в правильном порядке
  // Сначала создаем временные заглушки для функций
  let loadModelDataFn: () => Promise<void> = async () => {};
  let showDateRangeModalFn: () => void = () => {};
  
  // Пагинация с callback, который будет использовать обновленную функцию
  const pagination = usePagination({
    initialPage: 1,
    initialLimit: 50,
    onPageChange: () => {
      loadModelDataFn();
    },
  });
  
  const filtersModule = useFilters({
    currentModel,
    filters,
    pagination,
    loadModelData: loadModelDataFn,
    showDateRangeModal: showDateRangeModalFn,
  });

  // Затем создаем useData (нужен buildApiFilter из useFilters)
  const dataModule = useData({
    currentModel,
    pagination,
    buildApiFilter: filtersModule.buildApiFilter,
  });

  // Обновляем loadModelData (callback в pagination уже использует loadModelDataFn)
  loadModelDataFn = dataModule.loadModelData;

  // Пересоздаем useFilters с правильным loadModelData
  const filtersModuleFinal = useFilters({
    currentModel,
    filters,
    pagination,
    loadModelData: dataModule.loadModelData,
    showDateRangeModal: showDateRangeModalFn,
  });

  // Пересоздаем useData с правильным buildApiFilter
  const dataModuleFinal = useData({
    currentModel,
    pagination,
    buildApiFilter: filtersModuleFinal.buildApiFilter,
  });

  // Обновляем loadModelData (callback в pagination уже использует loadModelDataFn)
  loadModelDataFn = dataModuleFinal.loadModelData;

  // Затем создаем useModels (нужен loadModelData из useData)
  const modelsModule = useModels({
    currentModel,
    filters,
    originalData: dataModuleFinal.originalData,
    pagination,
    loadModelData: dataModuleFinal.loadModelData,
  });

  // Создаем useItemModals
  const itemModalsModule = useItemModals({
    currentModel,
    loadModelData: dataModuleFinal.loadModelData,
  });

  // Создаем useDataModal
  const dataModalModule = useDataModal();

  // Создаем useDateRangeModal (используем filtersModuleFinal.applyDateFilter, так как filtersModuleFinalUpdated еще не создан)
  const dateRangeModalModule = useDateRangeModal({
    filters,
    pagination,
    loadModelData: dataModuleFinal.loadModelData,
    applyDateFilter: filtersModuleFinal.applyDateFilter,
  });

  // Пересоздаем useFilters с правильным showDateRangeModal
  const filtersModuleFinalUpdated = useFilters({
    currentModel,
    filters,
    pagination,
    loadModelData: dataModuleFinal.loadModelData,
    showDateRangeModal: dateRangeModalModule.showDateRangeModal,
  });

  // Lifecycle
  onMounted(() => {
    modelsModule.loadModels();

    // Слушаем событие применения credentials из AppLayout
    window.addEventListener('credentials-applied', () => {
      // Перезагружаем модели и данные при применении новых credentials
      modelsModule.loadModels();
      if (currentModel.value) {
        dataModuleFinal.loadModelData();
      }
    });
  });

  return {
    // Models
    loadingModels: modelsModule.loadingModels,
    modelsError: modelsModule.modelsError,
    modelsByCategory: modelsModule.modelsByCategory,
    // Data
    currentModel,
    loadingData: dataModuleFinal.loadingData,
    dataError: dataModuleFinal.dataError,
    originalData: dataModuleFinal.originalData,
    filters,
    filteredData: dataModuleFinal.filteredData,
    tableKeys: dataModuleFinal.tableKeys,
    hasActiveFilters: filtersModuleFinalUpdated.hasActiveFilters,
    dateFields: filtersModuleFinalUpdated.dateFields,
    // Pagination
    currentPage: pagination.currentPage,
    currentPageInput: pagination.currentPageInput,
    currentLimit: pagination.currentLimit,
    totalPages: pagination.totalPages,
    paginationTotal: computed(() => pagination.totalItems.value),
    // Item Modal
    showItemModal: itemModalsModule.itemModal.isOpen,
    itemModalMode: itemModalsModule.itemModalMode,
    itemModalTitle: itemModalsModule.itemModalTitle,
    itemModalContent: itemModalsModule.itemModalContent,
    itemModalJsonData: itemModalsModule.itemModalJsonData,
    // Data Modal
    showDataModalFlag: dataModalModule.dataModal.isOpen,
    dataModalContent: dataModalModule.dataModalContent,
    // Date Range Modal
    showDateRangeModalFlag: dateRangeModalModule.dateRangeModal.isOpen,
    selectedDatePreset: dateRangeModalModule.selectedDatePreset,
    dateRangeFrom: dateRangeModalModule.dateRangeFrom,
    dateRangeTo: dateRangeModalModule.dateRangeTo,
    currentCalendarDate: dateRangeModalModule.currentCalendarDate,
    selectedDateRange: dateRangeModalModule.selectedDateRange,
    datePresets: dateRangeModalModule.datePresets,
    calendarMonthYear: dateRangeModalModule.calendarMonthYear,
    calendarDays: dateRangeModalModule.calendarDays,
    // Functions
    selectModel: modelsModule.selectModel,
    refreshModelData: modelsModule.refreshModelData,
    formatDateValue: dataModuleFinal.formatDateValue,
    getItemId: dataModuleFinal.getItemId,
    toggleSort: dataModuleFinal.toggleSort,
    getSortIndicator: dataModuleFinal.getSortIndicator,
    applyFilter: filtersModuleFinalUpdated.applyFilter,
    handleDateFilterChange: filtersModuleFinalUpdated.handleDateFilterChange,
    goToFirstPage: pagination.goToFirstPage,
    goToPreviousPage: pagination.goToPreviousPage,
    goToNextPage: pagination.goToNextPage,
    goToLastPage: pagination.goToLastPage,
    goToPage: pagination.goToPage,
    changeLimit: (newLimit?: number) => {
      if (newLimit !== undefined) {
        pagination.currentLimit.value = newLimit;
      }
      pagination.changeLimit(pagination.currentLimit.value);
      dataModuleFinal.loadModelData();
    },
    viewItem: itemModalsModule.viewItem,
    editItem: itemModalsModule.editItem,
    deleteItem: itemModalsModule.deleteItem,
    showCreateModal: itemModalsModule.showCreateModal,
    handleItemSubmit: itemModalsModule.handleItemSubmit,
    closeItemModal: itemModalsModule.closeItemModal,
    showDataModal: dataModalModule.showDataModal,
    closeDataModal: dataModalModule.closeDataModal,
    showDateRangeModal: dateRangeModalModule.showDateRangeModal,
    selectDatePreset: dateRangeModalModule.selectDatePreset,
    changeCalendarMonth: dateRangeModalModule.changeCalendarMonth,
    selectCalendarDate: dateRangeModalModule.selectCalendarDate,
    applyDateRange: dateRangeModalModule.applyDateRange,
    closeDateRangeModal: dateRangeModalModule.closeDateRangeModal,
    updateDateRangeFrom: dateRangeModalModule.updateDateRangeFrom,
    updateDateRangeTo: dateRangeModalModule.updateDateRangeTo,
  };
}
