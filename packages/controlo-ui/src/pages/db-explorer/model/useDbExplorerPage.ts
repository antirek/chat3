/* eslint-env browser */
/* global alert, confirm */
import { ref, computed, onMounted, watch } from 'vue';
import { useConfigStore } from '@/app/stores/config';
import { usePagination } from '@/shared/lib/composables/usePagination';
import { useModal } from '@/shared/lib/composables/useModal';

export function useDbExplorerPage() {
  // Stores
  const configStore = useConfigStore();

  // State для моделей
  const loadingModels = ref(false);
  const modelsError = ref<string | null>(null);
  const modelsByCategory = ref<Record<string, any[]>>({});

  // State для данных
  const currentModel = ref<string | null>(null);
  const loadingData = ref(false);
  const dataError = ref<string | null>(null);
  const originalData = ref<any[]>([]);
  const filters = ref<Record<string, any>>({});

  // Пагинация
  const pagination = usePagination({
    initialPage: 1,
    initialLimit: 50,
    onPageChange: () => {
      loadModelData();
    },
  });

  // State для модальных окон
  const itemModal = useModal();
  const itemModalMode = ref<'view' | 'edit' | 'create'>('view');
  const itemModalTitle = ref('');
  const itemModalContent = ref('');
  const itemModalJsonData = ref('');
  const itemModalItemId = ref<string | null>(null);

  const dataModal = useModal();
  const dataModalContent = ref('');

  // State для модального окна выбора дат
  const dateRangeModal = useModal();
  const selectedDatePreset = ref('');
  const dateRangeFrom = ref('');
  const dateRangeTo = ref('');
  const currentCalendarDate = ref(new Date());
  const selectedDateRange = ref<{ from: Date | null; to: Date | null }>({ from: null, to: null });

  // Поля с датами
  const dateFields = ['createdAt', 'lastSeenAt', 'lastMessageAt', 'lastInteractionAt', 'publishedAt', 'expiresAt', 'lastUsedAt', 'readAt', 'deliveredAt', 'joinedAt'];

  // Предустановки дат
  const datePresets = [
    { value: 'today', label: 'Сегодня' },
    { value: 'yesterday', label: 'Вчера' },
    { value: 'last7days', label: 'Последние 7 дней' },
    { value: 'last30days', label: 'Последние 30 дней' },
    { value: 'custom', label: 'Выбрать' }
  ];

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

  const hasActiveFilters = computed(() => {
    const activeFilters = Object.keys(filters.value).filter(key => 
      key !== 'createdAt_type' && key !== 'createdAt_from' && key !== 'createdAt_to'
    );
    return activeFilters.length > 0 || 
      (filters.value.createdAt_type && (currentModel.value === 'ApiJournal' || currentModel.value === 'DialogReadTask'));
  });

  const calendarMonthYear = computed(() => {
    const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 
                        'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    return `${monthNames[currentCalendarDate.value.getMonth()]} ${currentCalendarDate.value.getFullYear()}`;
  });

  const calendarDays = computed(() => {
    const year = currentCalendarDate.value.getFullYear();
    const month = currentCalendarDate.value.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay() + (firstDay.getDay() === 0 ? -6 : 1));
    
    const days: Array<{ date: number; fullDate: Date; isCurrentMonth: boolean }> = [];
    const currentDate = new Date(startDate);
    
    for (let i = 0; i < 42; i++) {
      const day = new Date(currentDate);
      days.push({
        date: day.getDate(),
        fullDate: day,
        isCurrentMonth: day.getMonth() === month
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return days;
  });

  // Функции
  function getControlApiUrl(path = ''): string {
    if (typeof window !== 'undefined' && (window as any).CHAT3_CONFIG) {
      return (window as any).CHAT3_CONFIG.getControlApiUrl(path);
    }
    const currentProtocol = window.location.protocol;
    const currentHost = window.location.host;
    const controlApiUrl = currentHost.includes(':3001') || !currentHost.includes(':') 
      ? `${currentProtocol}//${currentHost}` 
      : `${currentProtocol}//${currentHost.split(':')[0]}:3002`;
    return `${controlApiUrl}${path}`;
  }

  async function loadModels() {
    loadingModels.value = true;
    modelsError.value = null;
    try {
      const response = await fetch(getControlApiUrl('/api/db-explorer/models'));
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to load models: ${response.status} ${errorText}`);
      }
      const result = await response.json();
      
      if (!result.data || typeof result.data !== 'object') {
        throw new Error('Invalid data format received from server');
      }
      
      modelsByCategory.value = result.data;
    } catch (error: any) {
      modelsError.value = error.message;
      console.error('Error loading models:', error);
    } finally {
      loadingModels.value = false;
    }
  }

  function selectModel(modelName: string) {
    currentModel.value = modelName;
    pagination.setPage(1);
    filters.value = {};
    originalData.value = [];
    loadModelData();
  }

  function refreshModelData() {
    if (!currentModel.value) return;
    filters.value = {};
    pagination.setPage(1);
    originalData.value = [];
    loadModelData();
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
      case 'yesterday':
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        startDate = yesterday;
        endDate = yesterday;
        break;
      case 'last7days':
        const last7days = new Date(now);
        last7days.setDate(last7days.getDate() - 7);
        startDate = last7days;
        endDate = now;
        break;
      case 'last30days':
        const last30days = new Date(now);
        last30days.setDate(last30days.getDate() - 30);
        startDate = last30days;
        endDate = now;
        break;
      case 'custom':
        const fromDate = filters.value.createdAt_from;
        const toDate = filters.value.createdAt_to;
        if (fromDate && toDate) {
          startDate = new Date(fromDate);
          endDate = new Date(toDate);
        } else {
          return null;
        }
        break;
      default:
        return null;
    }

    return { start: getStartOfDay(startDate), end: getEndOfDay(endDate) };
  }

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

  // CRUD операции
  async function viewItem(id: string) {
    try {
      const response = await fetch(getControlApiUrl(`/api/db-explorer/models/${currentModel.value}/${id}`));
      if (!response.ok) throw new Error('Failed to load item');
      const result = await response.json();
      
      itemModalTitle.value = `Просмотр: ${currentModel.value}`;
      itemModalContent.value = JSON.stringify(result.data, null, 2);
      itemModalMode.value = 'view';
      itemModal.open();
    } catch (error: any) {
      alert('Ошибка: ' + error.message);
    }
  }

  async function editItem(id: string) {
    try {
      const response = await fetch(getControlApiUrl(`/api/db-explorer/models/${currentModel.value}/${id}`));
      if (!response.ok) throw new Error('Failed to load item');
      const result = await response.json();
      
      itemModalTitle.value = `Редактирование: ${currentModel.value}`;
      itemModalJsonData.value = JSON.stringify(result.data, null, 2);
      itemModalMode.value = 'edit';
      itemModalItemId.value = id;
      itemModal.open();
    } catch (error: any) {
      alert('Ошибка: ' + error.message);
    }
  }

  async function deleteItem(id: string) {
    if (!confirm('Вы уверены, что хотите удалить эту запись?')) return;

    try {
      const response = await fetch(getControlApiUrl(`/api/db-explorer/models/${currentModel.value}/${id}`), {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete');
      loadModelData();
      alert('Запись удалена');
    } catch (error: any) {
      alert('Ошибка: ' + error.message);
    }
  }

  function showCreateModal() {
    itemModalTitle.value = `Создать запись: ${currentModel.value}`;
    itemModalJsonData.value = '{}';
    itemModalMode.value = 'create';
    itemModalItemId.value = null;
    itemModal.open();
  }

  async function handleItemSubmit() {
    try {
      const jsonData = JSON.parse(itemModalJsonData.value);
      
      if (itemModalMode.value === 'create') {
        const response = await fetch(getControlApiUrl(`/api/db-explorer/models/${currentModel.value}`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(jsonData)
        });
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to create');
        }
        alert('Запись создана');
      } else {
        const response = await fetch(getControlApiUrl(`/api/db-explorer/models/${currentModel.value}/${itemModalItemId.value}`), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(jsonData)
        });
        if (!response.ok) throw new Error('Failed to update');
        alert('Запись обновлена');
      }
      
      itemModal.close();
      loadModelData();
    } catch (error: any) {
      alert('Ошибка: ' + error.message);
    }
  }

  function closeItemModal() {
    itemModal.close();
    itemModalTitle.value = '';
    itemModalContent.value = '';
    itemModalJsonData.value = '';
    itemModalItemId.value = null;
  }

  function showDataModal(data: any) {
    try {
      const formattedJson = JSON.stringify(data, null, 2);
      dataModalContent.value = formattedJson;
      dataModal.open();
    } catch (error: any) {
      dataModalContent.value = 'Ошибка при отображении данных: ' + error.message;
      dataModal.open();
    }
  }

  // Функции для работы с календарем
  function formatDateLocal(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function showDateRangeModal() {
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 30);
    
    if (filters.value.createdAt_from && filters.value.createdAt_to) {
      fromDate.setTime(new Date(filters.value.createdAt_from).getTime());
      toDate.setTime(new Date(filters.value.createdAt_to).getTime());
      selectedDateRange.value = { from: new Date(filters.value.createdAt_from), to: new Date(filters.value.createdAt_to) };
      currentCalendarDate.value = new Date(filters.value.createdAt_from);
    } else {
      selectedDateRange.value = { from: fromDate, to: toDate };
      currentCalendarDate.value = new Date();
    }
    
    dateRangeFrom.value = formatDateLocal(fromDate);
    dateRangeTo.value = formatDateLocal(toDate);
    selectedDatePreset.value = '';
    dateRangeModal.open();
  }

  function selectDatePreset(preset: string) {
    selectedDatePreset.value = preset;
    
    if (preset === 'custom') {
      return;
    }
    
    const now = new Date();
    let fromDate: Date, toDate: Date;
    
    switch(preset) {
      case 'today':
        fromDate = new Date(now);
        toDate = new Date(now);
        break;
      case 'yesterday':
        fromDate = new Date(now);
        fromDate.setDate(fromDate.getDate() - 1);
        toDate = new Date(fromDate);
        break;
      case 'last7days':
        fromDate = new Date(now);
        fromDate.setDate(fromDate.getDate() - 7);
        toDate = new Date(now);
        break;
      case 'last30days':
        fromDate = new Date(now);
        fromDate.setDate(fromDate.getDate() - 30);
        toDate = new Date(now);
        break;
      default:
        return;
    }
    
    selectedDateRange.value = { from: fromDate, to: toDate };
    dateRangeFrom.value = formatDateLocal(fromDate);
    dateRangeTo.value = formatDateLocal(toDate);
    currentCalendarDate.value = new Date(fromDate);
  }

  function changeCalendarMonth(delta: number) {
    const newDate = new Date(currentCalendarDate.value);
    newDate.setMonth(newDate.getMonth() + delta);
    currentCalendarDate.value = newDate;
  }

  function getCalendarDayClass(day: { date: number; fullDate: Date; isCurrentMonth: boolean }): string {
    const classes: string[] = [];
    
    if (!day.isCurrentMonth) {
      classes.push('other-month');
    }
    
    if (selectedDateRange.value.from && selectedDateRange.value.to) {
      const dayNormalized = new Date(day.fullDate.getFullYear(), day.fullDate.getMonth(), day.fullDate.getDate());
      const fromNormalized = new Date(selectedDateRange.value.from.getFullYear(), 
                                      selectedDateRange.value.from.getMonth(), 
                                      selectedDateRange.value.from.getDate());
      const toNormalized = new Date(selectedDateRange.value.to.getFullYear(), 
                                    selectedDateRange.value.to.getMonth(), 
                                    selectedDateRange.value.to.getDate());
      
      const dayTime = dayNormalized.getTime();
      const fromTime = fromNormalized.getTime();
      const toTime = toNormalized.getTime();
      
      if (dayTime >= fromTime && dayTime <= toTime) {
        classes.push('in-range');
        if (dayTime === fromTime) {
          classes.push('range-start');
        }
        if (dayTime === toTime) {
          classes.push('range-end');
        }
      }
    }
    
    return classes.join(' ');
  }

  function selectCalendarDate(day: { date: number; fullDate: Date; isCurrentMonth: boolean }) {
    const normalizedDate = new Date(day.fullDate.getFullYear(), day.fullDate.getMonth(), day.fullDate.getDate());
    
    if (!selectedDateRange.value.from || (selectedDateRange.value.from && selectedDateRange.value.to)) {
      selectedDateRange.value = { from: normalizedDate, to: null };
    } else {
      selectedDateRange.value.to = normalizedDate;
      
      const fromTime = selectedDateRange.value.from.getTime();
      const toTime = selectedDateRange.value.to.getTime();
      if (fromTime > toTime) {
        const temp = selectedDateRange.value.from;
        selectedDateRange.value.from = selectedDateRange.value.to;
        selectedDateRange.value.to = temp;
      }
    }
    
    if (selectedDateRange.value.from) {
      dateRangeFrom.value = formatDateLocal(selectedDateRange.value.from);
    }
    if (selectedDateRange.value.to) {
      dateRangeTo.value = formatDateLocal(selectedDateRange.value.to);
    }
    
    selectedDatePreset.value = 'custom';
  }

  function applyDateRange() {
    if (!dateRangeFrom.value || !dateRangeTo.value) {
      alert('Пожалуйста, выберите обе даты');
      return;
    }
    
    if (new Date(dateRangeFrom.value) > new Date(dateRangeTo.value)) {
      alert('Дата "От" не может быть больше даты "До"');
      return;
    }
    
    filters.value.createdAt_type = 'custom';
    filters.value.createdAt_from = dateRangeFrom.value;
    filters.value.createdAt_to = dateRangeTo.value;
    
    dateRangeModal.close();
    pagination.setPage(1);
    loadModelData();
  }

  function closeDateRangeModal() {
    dateRangeModal.close();
    if (filters.value.createdAt_type === 'custom' && (!filters.value.createdAt_from || !filters.value.createdAt_to)) {
      applyDateFilter('createdAt', '');
    }
  }

  // Watchers
  watch(dateRangeFrom, (newValue) => {
    if (newValue) {
      const date = new Date(newValue);
      if (!isNaN(date.getTime())) {
        selectedDateRange.value.from = date;
        if (!selectedDateRange.value.to || selectedDateRange.value.to < selectedDateRange.value.from) {
          selectedDateRange.value.to = date;
          dateRangeTo.value = newValue;
        }
      }
    }
  });

  watch(dateRangeTo, (newValue) => {
    if (newValue) {
      const date = new Date(newValue);
      if (!isNaN(date.getTime())) {
        selectedDateRange.value.to = date;
        if (!selectedDateRange.value.from || selectedDateRange.value.from > selectedDateRange.value.to) {
          selectedDateRange.value.from = date;
          dateRangeFrom.value = newValue;
        }
      }
    }
  });

  // Функции для обновления дат из модалки
  function updateDateRangeFrom(value: string) {
    dateRangeFrom.value = value;
  }

  function updateDateRangeTo(value: string) {
    dateRangeTo.value = value;
  }

  // Lifecycle
  onMounted(() => {
    loadModels();
  });

  return {
    // Models
    loadingModels,
    modelsError,
    modelsByCategory,
    // Data
    currentModel,
    loadingData,
    dataError,
    originalData,
    filters,
    filteredData,
    tableKeys,
    hasActiveFilters,
    dateFields,
    // Pagination
    currentPage: pagination.currentPage,
    currentPageInput: pagination.currentPageInput,
    currentLimit: pagination.currentLimit,
    totalPages: pagination.totalPages,
    paginationTotal: computed(() => pagination.totalItems.value),
    // Item Modal
    showItemModal: itemModal.isOpen,
    itemModalMode,
    itemModalTitle,
    itemModalContent,
    itemModalJsonData,
    // Data Modal
    showDataModalFlag: dataModal.isOpen,
    dataModalContent,
    // Date Range Modal
    showDateRangeModalFlag: dateRangeModal.isOpen,
    selectedDatePreset,
    dateRangeFrom,
    dateRangeTo,
    currentCalendarDate,
    selectedDateRange,
    datePresets,
    calendarMonthYear,
    calendarDays,
    // Functions
    selectModel,
    refreshModelData,
    formatDateValue,
    getItemId,
    applyFilter,
    handleDateFilterChange,
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
      loadModelData();
    },
    viewItem,
    editItem,
    deleteItem,
    showCreateModal,
    handleItemSubmit,
    closeItemModal,
    showDataModal,
    closeDataModal: dataModal.close,
    showDateRangeModal,
    selectDatePreset,
    changeCalendarMonth,
    getCalendarDayClass,
    selectCalendarDate,
    applyDateRange,
    closeDateRangeModal,
    updateDateRangeFrom,
    updateDateRangeTo,
  };
}
