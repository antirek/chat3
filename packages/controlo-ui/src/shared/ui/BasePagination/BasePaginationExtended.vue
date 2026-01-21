<template>
  <div class="pagination" v-show="total > 0">
    <div class="pagination-info">
      {{ paginationStart }}-{{ paginationEnd }} из {{ total }}
    </div>
    <div class="pagination-controls">
      <button
        class="btn-icon"
        @click="emit('first')"
        :disabled="currentPage <= 1"
        title="Первая страница"
      >
        ⏮
      </button>
      <button
        class="btn-icon"
        @click="emit('prev')"
        :disabled="currentPage <= 1"
        title="Предыдущая страница"
      >
        ◀
      </button>
      <span>Стр.</span>
      <input
        type="number"
        :value="currentPageInput"
        @change="emit('go-to-page', Number(($event.target as HTMLInputElement).value))"
        :min="1"
        :max="totalPages"
      />
      <span>из</span>
      <span>{{ totalPages }}</span>
      <button
        class="btn-icon"
        @click="emit('next')"
        :disabled="currentPage >= totalPages"
        title="Следующая страница"
      >
        ▶
      </button>
      <button
        class="btn-icon"
        @click="emit('last')"
        :disabled="currentPage >= totalPages"
        title="Последняя страница"
      >
        ⏭
      </button>
      <span style="margin-left: 8px;">Показ:</span>
      <select :value="limit" @change="emit('change-limit', Number(($event.target as HTMLSelectElement).value))">
        <option v-for="opt in limitOptions" :key="opt" :value="opt">{{ opt }}</option>
      </select>
    </div>
  </div>
</template>

<script setup lang="ts">
export interface BasePaginationExtendedProps {
  currentPage: number;
  currentPageInput: number;
  totalPages: number;
  total: number;
  paginationStart: number;
  paginationEnd: number;
  limit: number;
  limitOptions?: number[];
}

withDefaults(defineProps<BasePaginationExtendedProps>(), {
  limitOptions: () => [10, 20, 50, 100],
});

const emit = defineEmits<{
  (e: 'first'): void;
  (e: 'prev'): void;
  (e: 'next'): void;
  (e: 'last'): void;
  (e: 'go-to-page', page: number): void;
  (e: 'change-limit', limit: number): void;
}>();
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

.pagination-controls button {
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
  color: gray;
}

.pagination-controls button:hover:not(:disabled) {
  background: #e9ecef;
}

.pagination-controls button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.pagination-controls span {
  font-size: 11px;
  color: #6c757d;
}

.pagination-controls input[type="number"] {
  width: 50px;
  padding: 3px 6px;
  border: 1px solid #ced4da;
  border-radius: 3px;
  font-size: 11px;
  text-align: center;
}

.pagination-controls select {
  padding: 3px 6px;
  border: 1px solid #ced4da;
  border-radius: 3px;
  font-size: 11px;
}
</style>
