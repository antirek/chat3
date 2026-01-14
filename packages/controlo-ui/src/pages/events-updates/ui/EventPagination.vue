<template>
  <div class="pagination" id="events-pagination">
    <div class="pagination-info" id="events-pagination-info">
      {{ paginationInfo }}
    </div>
    <div class="pagination-controls">
      <button @click="goToPage(1)" title="Первая">««</button>
      <button @click="goToPage(currentPage - 1)" :disabled="currentPage <= 1" title="Предыдущая">‹</button>
      <input
        type="number"
        id="events-page-input"
        :value="currentPageInput"
        min="1"
        :max="totalPages"
        @input="handlePageInput"
        @change="handlePageChange"
      />
      <span>из</span>
      <span id="events-total-pages">{{ totalPages }}</span>
      <button @click="goToPage(currentPage + 1)" :disabled="currentPage >= totalPages" title="Следующая">›</button>
      <button @click="goToPage(totalPages)" :disabled="currentPage >= totalPages" title="Последняя">»»</button>
      <select id="events-limit" v-model.number="currentLimit" @change="changeLimit">
        <option :value="10">10</option>
        <option :value="20">20</option>
        <option :value="50">50</option>
        <option :value="100">100</option>
      </select>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  paginationInfo: string;
  currentPage: number;
  currentPageInput: number;
  totalPages: number;
  currentLimit: number;
  goToPage: (page: number) => void;
  changeLimit: () => void;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:currentLimit': [value: number];
}>();

const currentLimit = computed({
  get: () => props.currentLimit,
  set: (value) => emit('update:currentLimit', value),
});

function handlePageInput(event: Event) {
  const target = event.target as HTMLInputElement;
  const value = Number(target.value);
  if (value >= 1 && value <= props.totalPages) {
    props.goToPage(value);
  }
}

function handlePageChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const value = Number(target.value);
  if (value >= 1 && value <= props.totalPages) {
    props.goToPage(value);
  } else {
    // Сбросить на текущую страницу, если значение невалидно
    target.value = props.currentPageInput.toString();
  }
}
</script>

<style scoped>
.pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  gap: 8px;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
  font-size: 11px;
}

.pagination-info {
  color: #6c757d;
  font-size: 11px;
  white-space: nowrap;
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.pagination button {
  padding: 4px 8px;
  border: 1px solid #ced4da;
  background: white;
  cursor: pointer;
  border-radius: 3px;
  font-size: 11px;
  min-width: 28px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pagination button:hover:not(:disabled) {
  background: #e9ecef;
}

.pagination button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.pagination input[type="number"] {
  width: 50px;
  padding: 3px 6px;
  border: 1px solid #ced4da;
  border-radius: 3px;
  font-size: 11px;
  text-align: center;
}

.pagination select {
  padding: 3px 6px;
  border: 1px solid #ced4da;
  border-radius: 3px;
  font-size: 11px;
}
</style>
