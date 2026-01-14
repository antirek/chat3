<template>
  <div class="db-explorer-page">
    <div class="container">
      <!-- Левая панель: список моделей -->
      <ModelsPanel
        :loading="loadingModels"
        :error="modelsError"
        :models-by-category="modelsByCategory"
        :current-model="currentModel"
        @select-model="selectModel"
      />

      <!-- Правая панель: данные модели -->
      <div class="data-panel">
        <div class="data-panel-header">
          <div class="data-panel-title">{{ currentModel || 'Выберите модель' }}</div>
          <div v-if="currentModel" class="data-panel-actions">
            <button class="btn btn-primary btn-small" @click="showCreateModal">➕ Создать</button>
          </div>
        </div>
        <DataTable
          :current-model="currentModel"
          :loading="loadingData"
          :error="dataError"
          :filtered-data="filteredData"
          :has-active-filters="hasActiveFilters"
          :table-keys="tableKeys"
          :filters="filters"
          :date-fields="dateFields"
          :format-date-value="formatDateValue"
          :get-item-id="getItemId"
          :apply-filter="applyFilter"
          :handle-date-filter-change="handleDateFilterChange"
          @refresh="refreshModelData"
          @show-data-modal="showDataModal"
          @view-item="viewItem"
          @edit-item="editItem"
          @delete-item="deleteItem"
        />
        <DataPagination
          :current-model="currentModel"
          :filtered-data-length="filteredData.length"
          :current-page="currentPage"
          :current-page-input="currentPageInput"
          :current-limit="currentLimit"
          :total-pages="totalPages"
          :pagination-total="paginationTotal"
          :go-to-first-page="goToFirstPage"
          :go-to-previous-page="goToPreviousPage"
          :go-to-next-page="goToNextPage"
          :go-to-last-page="goToLastPage"
          :go-to-page="goToPage"
          :change-limit="changeLimit"
        />
      </div>
    </div>

    <!-- Модальное окно для просмотра/редактирования -->
    <ItemModal
      :is-open="showItemModal"
      :mode="itemModalMode"
      :title="itemModalTitle"
      :content="itemModalContent"
      :json-data="itemModalJsonData"
      @close="closeItemModal"
      @submit="handleItemSubmit"
    />

    <!-- Модальное окно для просмотра поля data -->
    <DataModal
      :is-open="showDataModalFlag"
      :content="dataModalContent"
      @close="closeDataModal"
    />

    <!-- Модальное окно для выбора диапазона дат -->
    <DateRangeModal
      :is-open="showDateRangeModalFlag"
      :selected-date-preset="selectedDatePreset"
      :date-range-from="dateRangeFrom"
      :date-range-to="dateRangeTo"
      :calendar-month-year="calendarMonthYear"
      :calendar-days="calendarDays"
      :date-presets="datePresets"
      :get-calendar-day-class="getCalendarDayClass"
      @close="closeDateRangeModal"
      @select-preset="selectDatePreset"
      @change-month="changeCalendarMonth"
      @select-date="selectCalendarDate"
      @apply="applyDateRange"
      @update:date-range-from="updateDateRangeFrom"
      @update:date-range-to="updateDateRangeTo"
    />
  </div>
</template>

<script setup lang="ts">
import { useDbExplorerPage } from '../model/useDbExplorerPage';
import ModelsPanel from './ModelsPanel.vue';
import DataTable from './DataTable.vue';
import DataPagination from './DataPagination.vue';
import ItemModal from './ItemModal.vue';
import DataModal from './DataModal.vue';
import DateRangeModal from './DateRangeModal.vue';

const {
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
  currentPage,
  currentPageInput,
  currentLimit,
  totalPages,
  paginationTotal,
  // Item Modal
  showItemModal,
  itemModalMode,
  itemModalTitle,
  itemModalContent,
  itemModalJsonData,
  // Data Modal
  showDataModalFlag,
  dataModalContent,
  // Date Range Modal
  showDateRangeModalFlag,
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
  goToFirstPage,
  goToPreviousPage,
  goToNextPage,
  goToLastPage,
  goToPage,
  changeLimit,
  viewItem,
  editItem,
  deleteItem,
  showCreateModal,
  handleItemSubmit,
  closeItemModal,
  showDataModal,
  closeDataModal,
  showDateRangeModal,
  selectDatePreset,
  changeCalendarMonth,
  getCalendarDayClass,
  selectCalendarDate,
  applyDateRange,
  closeDateRangeModal,
  updateDateRangeFrom,
  updateDateRangeTo,
} = useDbExplorerPage();
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

.btn-small {
  padding: 6px 12px;
  font-size: 12px;
}
</style>
