<template>
  <div class="base-table-container">
    <div v-if="loading" class="loading">
      <slot name="loading">{{ loadingText }}</slot>
    </div>
    <div v-else-if="error" class="error">
      <slot name="error">{{ error }}</slot>
    </div>
    <div v-else-if="items.length === 0" class="no-data">
      <slot name="empty">{{ emptyText }}</slot>
    </div>
    <div v-else class="table-wrapper">
      <table>
        <thead>
          <slot name="header">
            <tr>
              <th v-for="(column, index) in columns" :key="index" :class="column.class">
                {{ column.label }}
              </th>
            </tr>
          </slot>
        </thead>
        <tbody>
          <slot name="body" :items="items">
            <tr
              v-for="(item, index) in items"
              :key="getItemKey(item, index)"
              :class="getComputedRowClass(item, index)"
              style="cursor: pointer"
              @click="handleRowClick(item, index)"
            >
              <slot name="row" :item="item" :index="index">
                <td v-for="(column, colIndex) in columns" :key="colIndex" :class="column.class">
                  {{ getItemValue(item, column.field) }}
                </td>
              </slot>
            </tr>
          </slot>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';

interface Column {
  label: string;
  field?: string;
  class?: string;
}

interface Props {
  items: any[];
  loading?: boolean;
  error?: string | null;
  columns?: Column[];
  loadingText?: string;
  emptyText?: string;
  getItemKey?: (item: any, index: number) => string | number;
  getRowClass?: (item: any, index: number) => string | string[] | Record<string, boolean>;
  selectable?: boolean;
  selectedKey?: string | number | null;
}

interface Emits {
  (e: 'row-click', item: any, index: number): void;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  error: null,
  columns: () => [],
  loadingText: 'Загрузка...',
  emptyText: 'Данные не найдены',
  getItemKey: (item: any, index: number) => item.id || item._id || index,
  getRowClass: () => '',
  selectable: false,
  selectedKey: null,
});

const emit = defineEmits<Emits>();

// Внутреннее состояние для визуального выделения строк
const internalSelectedKey = ref<string | number | null>(null);

// Используем внешний selectedKey, если он передан, иначе внутренний
const effectiveSelectedKey = computed(() => {
  return props.selectedKey !== null && props.selectedKey !== undefined
    ? props.selectedKey
    : internalSelectedKey.value;
});

// Сбрасываем внутреннее выделение при изменении items
watch(() => props.items, () => {
  if (props.selectedKey === null || props.selectedKey === undefined) {
    internalSelectedKey.value = null;
  }
});

// Сбрасываем внутреннее выделение, когда внешний selectedKey становится null
watch(() => props.selectedKey, (newValue) => {
  if (newValue === null || newValue === undefined) {
    internalSelectedKey.value = null;
  }
});

function getItemValue(item: any, field?: string): any {
  if (!field) return '';
  return item[field] ?? '-';
}

function isRowSelected(item: any, index: number): boolean {
  const selectedKey = effectiveSelectedKey.value;
  if (selectedKey === null || selectedKey === undefined) return false;
  const itemKey = props.getItemKey(item, index);
  return String(itemKey) === String(selectedKey);
}

function getComputedRowClass(item: any, index: number): string | string[] | Record<string, boolean> {
  const baseClass = props.getRowClass(item, index);
  const isSelected = isRowSelected(item, index);
  
  if (typeof baseClass === 'string') {
    return isSelected ? `${baseClass} row-selected` : baseClass;
  }
  
  if (Array.isArray(baseClass)) {
    return isSelected ? [...baseClass, 'row-selected'] : baseClass;
  }
  
  if (typeof baseClass === 'object') {
    return { ...baseClass, 'row-selected': isSelected };
  }
  
  return isSelected ? 'row-selected' : '';
}

function handleRowClick(item: any, index: number) {
  const itemKey = props.getItemKey(item, index);
  
  // Всегда выделяем строку визуально
  if (props.selectedKey === null || props.selectedKey === undefined) {
    // Если внешний selectedKey не передан, используем внутренний
    internalSelectedKey.value = internalSelectedKey.value === itemKey ? null : itemKey;
  }
  
  // Если selectable=true, эмитим событие
  if (props.selectable) {
    emit('row-click', item, index);
  }
}
</script>

<style scoped>
.base-table-container {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}

.table-wrapper {
  overflow-x: auto;
}

:deep(table) {
  width: 100%;
  border-collapse: collapse;
  background: white;
}

:deep(thead) {
  background: #f8f9fa;
  position: sticky;
  top: 0;
  z-index: 10;
}

:deep(th) {
  padding: 12px 15px;
  text-align: left;
  font-weight: 600;
  color: #495057;
  font-size: 12px;
  letter-spacing: 0.5px;
  border-bottom: 2px solid #e9ecef;
}

:deep(td) {
  padding: 12px 15px;
  border-bottom: 1px solid #e9ecef;
  font-size: 13px;
}

:deep(tr) {
  transition: background-color 0.2s;
}

:deep(tr:hover) {
  background: #f0f0f0 !important;
}

:deep(.row-selected) {
  background: #e9ecef !important;
}

:deep(.row-selected:hover) {
  background: #d1e7ff !important;
}

.loading,
.error,
.no-data {
  padding: 40px 20px;
  text-align: center;
  color: #6c757d;
  font-size: 14px;
}

.loading {
  color: #667eea;
}

.error {
  background: #f8d7da;
  color: #721c24;
  padding: 15px;
  border-radius: 6px;
  margin: 15px;
  font-size: 13px;
}
</style>
