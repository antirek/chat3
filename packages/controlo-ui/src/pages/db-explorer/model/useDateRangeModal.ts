/**
 * Модуль модального окна выбора диапазона дат с календарем
 * Отвечает за: выбор дат через календарь, предустановки дат, применение диапазона дат
 */
import { ref, computed, watch, Ref } from 'vue';
import { useModal } from '@/shared/lib/composables/useModal';

interface UseDateRangeModalDependencies {
  filters: Ref<Record<string, any>>;
  pagination: {
    setPage: (page: number) => void;
  };
  loadModelData: () => Promise<void>;
  applyDateFilter: (fieldName: string, filterType: string) => void;
}

export function useDateRangeModal(deps: UseDateRangeModalDependencies) {
  const { filters, pagination, loadModelData, applyDateFilter } = deps;

  // State для модального окна выбора дат
  const dateRangeModal = useModal();
  const selectedDatePreset = ref('');
  const dateRangeFrom = ref('');
  const dateRangeTo = ref('');
  const currentCalendarDate = ref(new Date());
  const selectedDateRange = ref<{ from: Date | null; to: Date | null }>({ from: null, to: null });

  // Предустановки дат
  const datePresets = [
    { value: 'today', label: 'Сегодня' },
    { value: 'yesterday', label: 'Вчера' },
    { value: 'last7days', label: 'Последние 7 дней' },
    { value: 'last30days', label: 'Последние 30 дней' },
    { value: 'custom', label: 'Выбрать' }
  ];

  const calendarMonthYear = computed(() => {
    const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 
                        'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    return `${monthNames[currentCalendarDate.value.getMonth()]} ${currentCalendarDate.value.getFullYear()}`;
  });

  const calendarDays = computed(() => {
    const year = currentCalendarDate.value.getFullYear();
    const month = currentCalendarDate.value.getMonth();
    
    const firstDay = new Date(year, month, 1);
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

  function selectCalendarDate(day: { date: number; fullDate: Date; isCurrentMonth: boolean }) {
    const normalizedDate = new Date(day.fullDate.getFullYear(), day.fullDate.getMonth(), day.fullDate.getDate());
    
    if (!selectedDateRange.value.from || (selectedDateRange.value.from && selectedDateRange.value.to)) {
      // Начинаем новый выбор - устанавливаем только from
      selectedDateRange.value = { from: normalizedDate, to: null };
      dateRangeFrom.value = formatDateLocal(normalizedDate);
      dateRangeTo.value = ''; // Очищаем конечную дату
    } else {
      // Завершаем выбор диапазона - устанавливаем to
      selectedDateRange.value.to = normalizedDate;
      
      const fromTime = selectedDateRange.value.from.getTime();
      const toTime = selectedDateRange.value.to.getTime();
      if (fromTime > toTime) {
        // Если конечная дата меньше начальной, меняем их местами
        const temp = selectedDateRange.value.from;
        selectedDateRange.value.from = selectedDateRange.value.to;
        selectedDateRange.value.to = temp;
      }
      
      // Обновляем оба поля ввода
      dateRangeFrom.value = formatDateLocal(selectedDateRange.value.from);
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

  function updateDateRangeFrom(value: string) {
    dateRangeFrom.value = value;
  }

  function updateDateRangeTo(value: string) {
    dateRangeTo.value = value;
  }

  // Watchers - обновляют selectedDateRange при изменении полей ввода
  // НЕ устанавливают to автоматически, если пользователь выбирает даты через календарь
  watch(dateRangeFrom, (newValue) => {
    if (newValue) {
      const date = new Date(newValue);
      if (!isNaN(date.getTime())) {
        selectedDateRange.value.from = date;
        // Не устанавливаем to автоматически - пользователь должен выбрать вторую дату вручную
        // Только если to уже установлен и стал меньше from, тогда обновляем to
        if (selectedDateRange.value.to && selectedDateRange.value.to < selectedDateRange.value.from) {
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
        // Не устанавливаем from автоматически - пользователь должен выбрать первую дату вручную
        // Только если from уже установлен и стал больше to, тогда обновляем from
        if (selectedDateRange.value.from && selectedDateRange.value.from > selectedDateRange.value.to) {
          selectedDateRange.value.from = date;
          dateRangeFrom.value = newValue;
        }
      }
    }
  });

  return {
    dateRangeModal,
    selectedDatePreset,
    dateRangeFrom,
    dateRangeTo,
    currentCalendarDate,
    selectedDateRange,
    datePresets,
    calendarMonthYear,
    calendarDays,
    showDateRangeModal,
    selectDatePreset,
    changeCalendarMonth,
    selectCalendarDate,
    applyDateRange,
    closeDateRangeModal,
    updateDateRangeFrom,
    updateDateRangeTo,
  };
}
