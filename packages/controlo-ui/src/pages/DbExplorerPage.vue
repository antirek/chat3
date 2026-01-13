<template>
  <div class="db-explorer-page">
    <div class="container">
      <!-- Левая панель: список моделей -->
      <div class="models-panel">
        <div class="models-panel-header">Модели</div>
        <div class="models-list">
          <div v-if="loadingModels" class="loading">Загрузка моделей...</div>
          <div v-else-if="modelsError" class="error">{{ modelsError }}</div>
          <div v-else-if="Object.keys(modelsByCategory).length === 0" class="empty">Модели не найдены</div>
          <template v-else>
            <div v-for="(categoryModels, categoryName) in modelsByCategory" :key="categoryName" class="model-category">
              <div class="model-category-header">{{ categoryName }}</div>
              <div
                v-for="model in categoryModels"
                :key="model.name"
                class="model-item"
                :class="{ active: currentModel === model.name }"
                @click="selectModel(model.name)"
              >
                {{ model.name }}
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- Правая панель: данные модели -->
      <div class="data-panel">
        <div class="data-panel-header">
          <div class="data-panel-title">{{ currentModel || 'Выберите модель' }}</div>
          <div v-if="currentModel" class="data-panel-actions">
            <button class="btn btn-primary btn-small" @click="showCreateModal">➕ Создать</button>
          </div>
        </div>
        <div class="data-panel-content">
          <div v-if="!currentModel" class="empty">Выберите модель из списка слева</div>
          <div v-else-if="loadingData" class="loading">Загрузка данных...</div>
          <div v-else-if="dataError" class="error">{{ dataError }}</div>
          <div v-else-if="filteredData.length === 0 && hasActiveFilters" class="empty">
            <div>Нет данных, соответствующих фильтрам</div>
            <button class="empty-refresh-btn" @click="refreshModelData">🔄 Обновить</button>
          </div>
          <div v-else-if="filteredData.length === 0" class="empty">
            <div>Нет данных</div>
            <button class="empty-refresh-btn" @click="refreshModelData">🔄 Обновить</button>
          </div>
          <div v-else class="table-container">
            <table>
              <thead>
                <tr>
                  <th v-for="key in tableKeys" :key="key">{{ key }}</th>
                  <th>Действия</th>
                </tr>
                <tr class="filter-row">
                  <td v-for="key in tableKeys" :key="key">
                    <input
                      v-if="key === 'isActive'"
                      type="text"
                      class="filter-input"
                      :value="filters[key] || ''"
                      @keypress.enter="applyFilter(key, ($event.target as HTMLInputElement).value)"
                      @blur="applyFilter(key, ($event.target as HTMLInputElement).value)"
                      placeholder="true/false"
                    />
                    <select
                      v-else-if="key === 'createdAt' && (currentModel === 'ApiJournal' || currentModel === 'DialogReadTask')"
                      class="filter-select date-filter-select"
                      :value="filters[`${key}_type`] || ''"
                      @change="handleDateFilterChange(key, ($event.target as HTMLSelectElement).value)"
                    >
                      <option value="">Все</option>
                      <option value="today">Сегодня</option>
                      <option value="yesterday">Вчера</option>
                      <option value="last7days">Последние 7 дней</option>
                      <option value="last30days">Последние 30 дней</option>
                      <option value="custom">Выбрать</option>
                    </select>
                    <input
                      v-else
                      type="text"
                      class="filter-input"
                      :value="filters[key] || ''"
                      @keypress.enter="applyFilter(key, ($event.target as HTMLInputElement).value)"
                      @blur="applyFilter(key, ($event.target as HTMLInputElement).value)"
                      placeholder="Фильтр..."
                    />
                  </td>
                  <td></td>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(item, index) in filteredData" :key="getItemId(item, index)">
                  <td v-for="key in tableKeys" :key="key">
                    <span v-if="item[key] === null || item[key] === undefined" style="color: #999;">null</span>
                    <span
                      v-else-if="dateFields.includes(key)"
                      :title="String(item[key])"
                      style="cursor: help;"
                    >
                      {{ formatDateValue(item[key]) }}
                    </span>
                    <button
                      v-else-if="key === 'data' && typeof item[key] === 'object'"
                      class="btn btn-secondary btn-small data-view-btn"
                      @click="showDataModal(item[key])"
                      title="Просмотр data"
                    >
                      📄 data
                    </button>
                    <span v-else-if="typeof item[key] === 'object'" style="color: #6c757d;">[Object]</span>
                    <span v-else-if="typeof item[key] === 'string' && item[key].length > 50">
                      {{ item[key].substring(0, 50) }}...
                    </span>
                    <span v-else>{{ String(item[key]) }}</span>
                  </td>
                  <td class="action-buttons">
                    <button class="btn btn-secondary btn-small" @click="viewItem(getItemId(item, index))" title="Просмотр">👁️</button>
                    <button class="btn btn-secondary btn-small" @click="editItem(getItemId(item, index))" title="Редактировать">✏️</button>
                    <button class="btn btn-danger btn-small" @click="deleteItem(getItemId(item, index))" title="Удалить">🗑️</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div v-if="currentModel && filteredData.length > 0" class="pagination">
          <div class="pagination-info">
            Показано {{ (currentPage - 1) * currentLimit + 1 }}-{{ Math.min(currentPage * currentLimit, pagination.total) }} из {{ pagination.total }}
          </div>
          <div class="pagination-controls">
            <button class="btn btn-secondary btn-small" @click="goToFirstPage">⏮</button>
            <button class="btn btn-secondary btn-small" @click="goToPreviousPage">◀</button>
            <span style="font-size: 11px; margin: 0 5px;">Стр.</span>
            <input
              type="number"
              v-model.number="currentPageInput"
              min="1"
              :max="pagination.pages"
              @change="goToPage(currentPageInput)"
              style="width: 50px; padding: 4px; border: 1px solid #ced4da; border-radius: 4px; font-size: 11px; text-align: center;"
            />
            <span style="font-size: 11px; margin: 0 5px;">из</span>
            <span style="font-size: 11px;">{{ pagination.pages }}</span>
            <button class="btn btn-secondary btn-small" @click="goToNextPage">▶</button>
            <button class="btn btn-secondary btn-small" @click="goToLastPage">⏭</button>
            <span style="font-size: 11px; margin-left: 10px;">Показ:</span>
            <select
              v-model.number="currentLimit"
              @change="changeLimit"
              style="padding: 4px 6px; border: 1px solid #ced4da; border-radius: 4px; font-size: 11px;"
            >
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <!-- Модальное окно для просмотра/редактирования -->
    <div v-if="showItemModal" class="modal" @click.self="closeItemModal">
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title">{{ itemModalTitle }}</h2>
          <button class="modal-close" @click="closeItemModal">×</button>
        </div>
        <div class="modal-body">
          <div v-if="itemModalMode === 'view'">
            <div class="json-viewer">{{ itemModalContent }}</div>
            <div class="form-actions">
              <button type="button" class="btn btn-secondary" @click="closeItemModal">Закрыть</button>
            </div>
          </div>
          <form v-else @submit.prevent="handleItemSubmit">
            <div class="form-group">
              <label>JSON данные:</label>
              <textarea v-model="itemModalJsonData" placeholder='{"field": "value"}'></textarea>
            </div>
            <div class="form-actions">
              <button type="button" class="btn btn-secondary" @click="closeItemModal">Отмена</button>
              <button type="submit" class="btn btn-primary">{{ itemModalMode === 'create' ? 'Создать' : 'Сохранить' }}</button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- Модальное окно для просмотра поля data -->
    <div v-if="showDataModalFlag" class="modal" @click.self="closeDataModal">
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title">Просмотр поля data</h2>
          <button class="modal-close" @click="closeDataModal">×</button>
        </div>
        <div class="modal-body">
          <div class="json-viewer">{{ dataModalContent }}</div>
          <div class="form-actions" style="margin-top: 20px;">
            <button type="button" class="btn btn-secondary" @click="closeDataModal">Закрыть</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Модальное окно для выбора диапазона дат -->
    <div v-if="showDateRangeModalFlag" class="modal" @click.self="closeDateRangeModal">
      <div class="modal-content date-range-modal-content">
        <div class="modal-header">
          <h2 class="modal-title">Выбрать диапазон дат</h2>
          <button class="modal-close" @click="closeDateRangeModal">×</button>
        </div>
        <div class="modal-body">
          <div class="date-range-container">
            <!-- Левая панель с предустановками -->
            <div class="date-range-presets">
              <button
                v-for="preset in datePresets"
                :key="preset.value"
                class="date-preset-btn"
                :class="{ active: selectedDatePreset === preset.value }"
                @click="selectDatePreset(preset.value)"
              >
                {{ preset.label }}
              </button>
              <div style="flex: 1;"></div>
              <div class="date-range-actions" style="border-top: none; padding-top: 0; margin-top: 0;">
                <button type="button" class="btn btn-secondary" @click="closeDateRangeModal" style="flex: 1;">Отмена</button>
                <button type="button" class="btn btn-primary" @click="applyDateRange" style="flex: 1; background: #28a745;">Применить</button>
              </div>
            </div>
            
            <!-- Правая панель с календарем -->
            <div class="date-range-calendar">
              <div class="date-inputs">
                <div class="date-input-wrapper">
                  <input type="date" v-model="dateRangeFrom" />
                </div>
                <div class="date-input-wrapper">
                  <input type="date" v-model="dateRangeTo" />
                </div>
              </div>
              <div class="calendar-container">
                <div class="calendar-header">
                  <button class="calendar-nav-btn" @click="changeCalendarMonth(-1)">‹</button>
                  <div class="calendar-month-year">{{ calendarMonthYear }}</div>
                  <button class="calendar-nav-btn" @click="changeCalendarMonth(1)">›</button>
                </div>
                <div class="calendar-grid">
                  <div
                    v-for="dayHeader in ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС']"
                    :key="dayHeader"
                    class="calendar-day-header"
                  >
                    {{ dayHeader }}
                  </div>
                  <div
                    v-for="(day, index) in calendarDays"
                    :key="index"
                    class="calendar-day"
                    :class="getCalendarDayClass(day)"
                    @click="selectCalendarDate(day)"
                  >
                    {{ day.date }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { useConfigStore } from '@/app/stores/config';

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
const currentPage = ref(1);
const currentPageInput = ref(1);
const currentLimit = ref(50);
const pagination = ref({ page: 1, pages: 1, total: 0 });

// State для модальных окон
const showItemModal = ref(false);
const itemModalMode = ref<'view' | 'edit' | 'create'>('view');
const itemModalTitle = ref('');
const itemModalContent = ref('');
const itemModalJsonData = ref('');
const itemModalItemId = ref<string | null>(null);
const showDataModalFlag = ref(false);
const dataModalContent = ref('');

// State для модального окна выбора дат
const showDateRangeModalFlag = ref(false);
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

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
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
  currentPage.value = 1;
  currentPageInput.value = 1;
  filters.value = {};
  originalData.value = [];
  loadModelData();
}

function refreshModelData() {
  if (!currentModel.value) return;
  filters.value = {};
  currentPage.value = 1;
  currentPageInput.value = 1;
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
    url.searchParams.set('page', currentPage.value.toString());
    url.searchParams.set('limit', currentLimit.value.toString());

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
    pagination.value = result.pagination;
    currentPageInput.value = currentPage.value;
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
  currentPage.value = 1;
  currentPageInput.value = 1;
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
  currentPage.value = 1;
  currentPageInput.value = 1;
  loadModelData();
}

// Пагинация
function goToFirstPage() {
  if (currentPage.value > 1) {
    currentPage.value = 1;
    currentPageInput.value = 1;
    loadModelData();
  }
}

function goToPreviousPage() {
  if (currentPage.value > 1) {
    currentPage.value--;
    currentPageInput.value = currentPage.value;
    loadModelData();
  }
}

function goToNextPage() {
  if (currentPage.value < pagination.value.pages) {
    currentPage.value++;
    currentPageInput.value = currentPage.value;
    loadModelData();
  }
}

function goToLastPage() {
  if (currentPage.value < pagination.value.pages) {
    currentPage.value = pagination.value.pages;
    currentPageInput.value = currentPage.value;
    loadModelData();
  }
}

function goToPage(page: number) {
  if (page >= 1 && page <= pagination.value.pages) {
    currentPage.value = page;
    currentPageInput.value = page;
    loadModelData();
  }
}

function changeLimit() {
  currentPage.value = 1;
  currentPageInput.value = 1;
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
    showItemModal.value = true;
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
    showItemModal.value = true;
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
  showItemModal.value = true;
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
    
    closeItemModal();
    loadModelData();
  } catch (error: any) {
    alert('Ошибка: ' + error.message);
  }
}

function closeItemModal() {
  showItemModal.value = false;
  itemModalTitle.value = '';
  itemModalContent.value = '';
  itemModalJsonData.value = '';
  itemModalItemId.value = null;
}

function showDataModal(data: any) {
  try {
    const formattedJson = JSON.stringify(data, null, 2);
    dataModalContent.value = formattedJson;
    showDataModalFlag.value = true;
  } catch (error: any) {
    dataModalContent.value = 'Ошибка при отображении данных: ' + error.message;
    showDataModalFlag.value = true;
  }
}

function closeDataModal() {
  showDataModalFlag.value = false;
  dataModalContent.value = '';
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
  showDateRangeModalFlag.value = true;
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
  
  closeDateRangeModal();
  currentPage.value = 1;
  currentPageInput.value = 1;
  loadModelData();
}

function closeDateRangeModal() {
  showDateRangeModalFlag.value = false;
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

// Lifecycle
onMounted(() => {
  loadModels();
});
</script>

<style scoped>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.db-explorer-page {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f5f5f5;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.container {
  display: flex;
  flex: 1;
  gap: 1px;
  background: #ddd;
  overflow: hidden;
}

.models-panel {
  width: 250px;
  background: white;
  border-right: 1px solid #e9ecef;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.models-panel-header {
  background: #f8f9fa;
  padding: 15px 20px;
  border-bottom: 1px solid #e9ecef;
  font-weight: 600;
  color: #495057;
  font-size: 16px;
}

.models-list {
  flex: 1;
  overflow-y: auto;
  padding: 10px 0;
}

.model-category {
  margin-bottom: 10px;
}

.model-category-header {
  padding: 10px 20px;
  font-weight: 600;
  font-size: 12px;
  color: #6c757d;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
}

.model-item {
  padding: 10px 20px 10px 30px;
  cursor: pointer;
  transition: background-color 0.2s;
  border-left: 3px solid transparent;
  font-size: 14px;
}

.model-item:hover {
  background-color: #f8f9fa;
}

.model-item.active {
  background-color: #e7f3ff;
  border-left-color: #667eea;
  font-weight: 600;
}

.data-panel {
  flex: 1;
  background: white;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.data-panel-header {
  background: #f8f9fa;
  padding: 15px 20px;
  border-bottom: 1px solid #e9ecef;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.data-panel-title {
  font-weight: 600;
  color: #495057;
  font-size: 16px;
}

.data-panel-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-primary {
  background: #667eea;
  color: white;
}

.btn-primary:hover {
  background: #5568d3;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background: #5a6268;
}

.btn-danger {
  background: #dc3545;
  color: white;
}

.btn-danger:hover {
  background: #c82333;
}

.btn-small {
  padding: 6px 12px;
  font-size: 12px;
}

.data-panel-content {
  flex: 1;
  overflow: auto;
  padding: 20px;
}

.table-container {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  background: white;
  font-size: 12px;
}

th, td {
  padding: 8px;
  text-align: left;
  border-bottom: 1px solid #e9ecef;
}

th {
  background: #f8f9fa;
  font-weight: 600;
  color: #495057;
  position: sticky;
  top: 0;
  z-index: 10;
  font-size: 11px;
}

td {
  font-size: 12px;
}

tr:hover {
  background: #f8f9fa;
}

.filter-row {
  background: #f8f9fa;
}

.filter-row td {
  padding: 8px;
  border-bottom: 1px solid #e9ecef;
}

.filter-input {
  padding: 6px 10px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 12px;
  width: 100%;
  box-sizing: border-box;
}

.filter-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.1);
}

.filter-select {
  padding: 6px 10px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 12px;
  width: 100%;
  box-sizing: border-box;
  background: white;
  cursor: pointer;
}

.filter-select:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.1);
}

.pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  border-top: 1px solid #e9ecef;
  background: #f8f9fa;
}

.pagination-info {
  font-size: 14px;
  color: #6c757d;
}

.pagination-controls {
  display: flex;
  gap: 10px;
  align-items: center;
}

.loading {
  text-align: center;
  padding: 40px;
  color: #6c757d;
}

.error {
  background: #f8d7da;
  color: #721c24;
  padding: 15px;
  border-radius: 6px;
  margin: 20px;
}

.empty {
  text-align: center;
  padding: 40px;
  color: #6c757d;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
}

.empty-refresh-btn {
  padding: 6px 12px;
  font-size: 12px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.empty-refresh-btn:hover {
  background: #5568d3;
}

.modal {
  display: flex;
  position: fixed;
  z-index: 1000;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0,0,0,0.5);
  align-items: center;
  justify-content: center;
}

.modal-content {
  background-color: white;
  margin: 5% auto;
  padding: 0;
  border-radius: 8px;
  width: 80%;
  max-width: 800px;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  padding: 20px;
  border-bottom: 1px solid #e9ecef;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-title {
  font-size: 20px;
  font-weight: 600;
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #6c757d;
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: 500;
  color: #495057;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 14px;
}

.form-group textarea {
  min-height: 100px;
  font-family: monospace;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

.json-viewer {
  background: #f8f9fa;
  padding: 15px;
  border-radius: 6px;
  font-family: monospace;
  font-size: 12px;
  max-height: 400px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

.action-buttons {
  display: flex;
  gap: 5px;
}

.date-range-modal-content {
  max-width: 700px;
  width: 90%;
}

.date-range-container {
  display: flex;
  gap: 15px;
  min-height: 280px;
}

.date-range-presets {
  width: 180px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-right: 15px;
  border-right: 1px solid #e9ecef;
}

.date-preset-btn {
  padding: 8px 12px;
  border: none;
  border-radius: 4px;
  background: #f8f9fa;
  color: #495057;
  cursor: pointer;
  font-size: 13px;
  text-align: left;
  transition: all 0.2s;
}

.date-preset-btn:hover {
  background: #e9ecef;
}

.date-preset-btn.active {
  background: #667eea;
  color: white;
}

.date-range-calendar {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.date-inputs {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.date-input-wrapper {
  flex: 1;
  position: relative;
}

.date-input-wrapper input {
  width: 100%;
  padding: 6px 10px 6px 32px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 12px;
}

.date-input-wrapper::before {
  content: '📅';
  position: absolute;
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 14px;
}

.calendar-container {
  flex: 1;
}

.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.calendar-nav-btn {
  background: none;
  border: none;
  font-size: 14px;
  cursor: pointer;
  color: #495057;
  padding: 3px 6px;
  border-radius: 3px;
  transition: background 0.2s;
}

.calendar-nav-btn:hover {
  background: #f8f9fa;
}

.calendar-month-year {
  font-weight: 600;
  font-size: 13px;
  color: #495057;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}

.calendar-day-header {
  text-align: center;
  font-weight: 600;
  font-size: 10px;
  color: #6c757d;
  padding: 4px 2px;
}

.calendar-day {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: 3px;
  cursor: pointer;
  font-size: 11px;
  transition: all 0.2s;
  background: white;
  min-height: 24px;
}

.calendar-day:hover {
  background: #f8f9fa;
}

.calendar-day.other-month {
  color: #ced4da;
}

.calendar-day.selected {
  background: #667eea;
  color: white;
  font-weight: 600;
}

.calendar-day.range-start {
  background: #667eea;
  color: white;
  border-top-left-radius: 4px;
  border-bottom-left-radius: 4px;
}

.calendar-day.range-end {
  background: #667eea;
  color: white;
  border-top-right-radius: 4px;
  border-bottom-right-radius: 4px;
}

.calendar-day.in-range {
  background: #e7f3ff;
  color: #495057;
}
</style>