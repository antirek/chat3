<template>
  <div class="pagination" :style="containerStyle">
    <div class="pagination-info">
      {{ infoText }}
    </div>
    <div class="pagination-controls">
      <!-- Вариант с номерами страниц -->
      <template v-if="showPageNumbers">
        <button @click="$emit('change', currentPage - 1)" :disabled="currentPage <= 1">
          ← Предыдущая
        </button>
        <button
          v-for="pageNum in visiblePages"
          :key="pageNum"
          :class="{ active: pageNum === currentPage }"
          @click="$emit('change', pageNum)"
        >
          {{ pageNum }}
        </button>
        <button @click="$emit('change', currentPage + 1)" :disabled="currentPage >= totalPages">
          Следующая →
        </button>
      </template>
      <!-- Вариант с иконками (first/prev/next/last) -->
      <template v-else-if="showIconButtons">
        <button
          class="btn-secondary btn-small"
          @click="$emit('first')"
          :disabled="currentPage <= 1"
          title="Первая страница"
        >
          ⏮
        </button>
        <button
          class="btn-secondary btn-small"
          @click="$emit('prev')"
          :disabled="currentPage <= 1"
          title="Предыдущая страница"
        >
          ◀
        </button>
        <button
          class="btn-secondary btn-small"
          @click="$emit('next')"
          :disabled="currentPage >= totalPages"
          title="Следующая страница"
        >
          ▶
        </button>
        <button
          class="btn-secondary btn-small"
          @click="$emit('last')"
          :disabled="currentPage >= totalPages"
          title="Последняя страница"
        >
          ⏭
        </button>
      </template>
      <!-- Минимальный вариант -->
      <template v-else>
        <button @click="$emit('change', currentPage - 1)" :disabled="currentPage <= 1">
          ← Назад
        </button>
        <span>Страница {{ currentPage }} из {{ totalPages }}</span>
        <button @click="$emit('change', currentPage + 1)" :disabled="currentPage >= totalPages">
          Вперёд →
        </button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  currentPage: number;
  totalPages: number;
  total?: number;
  infoText?: string;
  visiblePages?: number[];
  showPageNumbers?: boolean;
  showIconButtons?: boolean;
  containerStyle?: string;
}

const props = withDefaults(defineProps<Props>(), {
  total: 0,
  infoText: '',
  visiblePages: () => [],
  showPageNumbers: false,
  showIconButtons: false,
  containerStyle: '',
});

defineEmits<{
  (e: 'change', page: number): void;
  (e: 'first'): void;
  (e: 'prev'): void;
  (e: 'next'): void;
  (e: 'last'): void;
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

.pagination-controls button.active {
  background: #667eea;
  color: white;
  border-color: #667eea;
}

.pagination-controls span {
  font-size: 11px;
  color: #6c757d;
}
</style>
