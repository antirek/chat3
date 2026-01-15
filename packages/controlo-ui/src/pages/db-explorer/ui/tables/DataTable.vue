<template>
  <div class="data-panel-content">
    <div v-if="!currentModel" class="empty">Выберите модель из списка слева</div>
    <div v-else-if="loading" class="loading">Загрузка данных...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else-if="filteredData.length === 0 && hasActiveFilters" class="empty">
      <div>Нет данных, соответствующих фильтрам</div>
      <button class="empty-refresh-btn" @click="$emit('refresh')">🔄 Обновить</button>
    </div>
    <div v-else-if="filteredData.length === 0" class="empty">
      <div>Нет данных</div>
      <button class="empty-refresh-btn" @click="$emit('refresh')">🔄 Обновить</button>
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
                @keypress.enter="handleFilter(key, ($event.target as HTMLInputElement).value)"
                @blur="handleFilter(key, ($event.target as HTMLInputElement).value)"
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
                @keypress.enter="handleFilter(key, ($event.target as HTMLInputElement).value)"
                @blur="handleFilter(key, ($event.target as HTMLInputElement).value)"
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
                @click="$emit('show-data-modal', item[key])"
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
              <button class="btn btn-secondary btn-small" @click="$emit('view-item', getItemId(item, index))" title="Просмотр">👁️</button>
              <button class="btn btn-secondary btn-small" @click="$emit('edit-item', getItemId(item, index))" title="Редактировать">✏️</button>
              <button class="btn btn-danger btn-small" @click="$emit('delete-item', getItemId(item, index))" title="Удалить">🗑️</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  currentModel: string | null;
  loading: boolean;
  error: string | null;
  filteredData: any[];
  hasActiveFilters: boolean;
  tableKeys: string[];
  filters: Record<string, any>;
  dateFields: string[];
  formatDateValue: (value: any) => string;
  getItemId: (item: any, index: number) => string;
  applyFilter: (fieldName: string, filterValue: string) => void;
  handleDateFilterChange: (fieldName: string, filterType: string) => void;
}

interface Emits {
  (e: 'refresh'): void;
  (e: 'show-data-modal', data: any): void;
  (e: 'view-item', id: string): void;
  (e: 'edit-item', id: string): void;
  (e: 'delete-item', id: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

function handleFilter(key: string, value: string) {
  props.applyFilter(key, value);
}
</script>

<style scoped>
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

th,
td {
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

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
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

.data-view-btn {
  background: #667eea;
  color: white;
}

.data-view-btn:hover {
  background: #5568d3;
}

.action-buttons {
  display: flex;
  gap: 5px;
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
</style>
