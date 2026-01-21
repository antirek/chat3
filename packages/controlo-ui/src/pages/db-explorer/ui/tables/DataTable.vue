<template>
  <div class="data-panel-content">
    <div v-if="!currentModel" class="empty">Выберите модель из списка слева</div>
    <BaseTable
      v-else
      class="data-table"
      :items="filteredData"
      :loading="loading"
      :error="error"
      :get-item-key="(item, index) => getItemId(item, index)"
      loading-text="Загрузка данных..."
      empty-text="Нет данных"
    >
      <template #empty>
        <div v-if="hasActiveFilters" class="empty">
          <div>Нет данных, соответствующих фильтрам</div>
          <BaseButton variant="primary" @click="$emit('refresh')">🔄 Обновить</BaseButton>
        </div>
        <div v-else class="empty">
          <div>Нет данных</div>
          <BaseButton variant="primary" @click="$emit('refresh')">🔄 Обновить</BaseButton>
        </div>
      </template>
      <template #header>
        <tr>
          <th v-for="key in tableKeys" :key="key">{{ key }}</th>
          <th>Действия</th>
        </tr>
        <tr v-if="filteredData.length > 0" class="filter-row">
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
      </template>
        <template #row="{ item, index }">
          <td v-for="key in tableKeys" :key="key">
            <span v-if="item[key] === null || item[key] === undefined" style="color: #999;">null</span>
            <span
              v-else-if="dateFields.includes(key)"
              :title="String(item[key])"
              style="cursor: help;"
            >
              {{ formatDateValue(item[key]) }}
            </span>
            <BaseButton
              v-else-if="key === 'data' && typeof item[key] === 'object'"
              variant="secondary"
              @click="$emit('show-data-modal', item[key])"
              title="Просмотр data"
            >
              📄 data
            </BaseButton>
            <span v-else-if="typeof item[key] === 'object'" style="color: #6c757d;">[Object]</span>
            <span v-else-if="typeof item[key] === 'string' && item[key].length > 50">
              {{ item[key].substring(0, 50) }}...
            </span>
            <span v-else>{{ String(item[key]) }}</span>
          </td>
          <td class="action-buttons">
            <BaseButton variant="primary" @click="$emit('view-item', getItemId(item, index))" title="Просмотр">👁️</BaseButton>
            <BaseButton variant="secondary" @click="$emit('edit-item', getItemId(item, index))" title="Редактировать">✏️</BaseButton>
            <BaseButton variant="danger" @click="$emit('delete-item', getItemId(item, index))" title="Удалить">🗑️</BaseButton>
          </td>
        </template>
      </BaseTable>
  </div>
</template>

<script setup lang="ts">
import { BaseTable, BaseButton } from '@/shared/ui';

interface Props {
  currentModel: string | null;
  loading: boolean;
  error: string | null;
  filteredData: any[];
  hasActiveFilters?: boolean;
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

const props = withDefaults(defineProps<Props>(), {
  hasActiveFilters: false,
});
const emit = defineEmits<Emits>();

function handleFilter(key: string, value: string) {
  props.applyFilter(key, value);
}
</script>

<style scoped>
.data-panel-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

:deep(.filter-row) {
  background: #f8f9fa;
}

:deep(.filter-row td) {
  padding: 8px;
  border-bottom: 1px solid #e9ecef;
  vertical-align: middle;
}

/* Убираем нижнюю границу у первой строки заголовков, чтобы не было двойной границы */
:deep(thead tr:first-child th) {
  border-bottom: none;
}

/* Добавляем границу только у строки фильтров */
:deep(thead tr:last-child td) {
  border-bottom: 2px solid #e9ecef;
}

/* Убираем любые отступы между строками в thead */
:deep(thead tr) {
  margin: 0;
  border-spacing: 0;
}

:deep(thead tr th),
:deep(thead tr td) {
  margin: 0;
  border-spacing: 0;
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

</style>
