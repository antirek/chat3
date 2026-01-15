<template>
  <div v-if="currentModel && filteredDataLength > 0" class="pagination">
    <div class="pagination-info">
      Показано {{ (currentPage - 1) * currentLimit + 1 }}-{{ Math.min(currentPage * currentLimit, paginationTotal) }} из {{ paginationTotal }}
    </div>
    <div class="pagination-controls">
      <button class="btn btn-secondary btn-small" @click="goToFirstPage">⏮</button>
      <button class="btn btn-secondary btn-small" @click="goToPreviousPage">◀</button>
      <span style="font-size: 11px; margin: 0 5px;">Стр.</span>
      <input
        type="number"
        :value="currentPageInput"
        min="1"
        :max="totalPages"
        @input="handlePageInput"
        @change="handlePageChange"
        style="width: 50px; padding: 4px; border: 1px solid #ced4da; border-radius: 4px; font-size: 11px; text-align: center;"
      />
      <span style="font-size: 11px; margin: 0 5px;">из</span>
      <span style="font-size: 11px;">{{ totalPages }}</span>
      <button class="btn btn-secondary btn-small" @click="goToNextPage">▶</button>
      <button class="btn btn-secondary btn-small" @click="goToLastPage">⏭</button>
      <span style="font-size: 11px; margin-left: 10px;">Показ:</span>
      <select
        :value="currentLimit"
        @change="handleLimitChange"
        style="padding: 4px 6px; border: 1px solid #ced4da; border-radius: 4px; font-size: 11px;"
      >
        <option value="10">10</option>
        <option value="20">20</option>
        <option value="50">50</option>
        <option value="100">100</option>
      </select>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  currentModel: string | null;
  filteredDataLength: number;
  currentPage: number;
  currentPageInput: number;
  currentLimit: number;
  totalPages: number;
  paginationTotal: number;
  goToFirstPage: () => void;
  goToPreviousPage: () => void;
  goToNextPage: () => void;
  goToLastPage: () => void;
  goToPage: (page: number) => void;
  changeLimit: () => void;
}

const props = defineProps<Props>();

function handlePageInput(event: Event) {
  const target = event.target as HTMLInputElement;
  const value = Number(target.value);
  // Обновление будет через handlePageChange
}

function handlePageChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const value = Number(target.value);
  if (value >= 1 && value <= props.totalPages) {
    props.goToPage(value);
  } else {
    target.value = props.currentPageInput.toString();
  }
}

function handleLimitChange(event: Event) {
  const target = event.target as HTMLSelectElement;
  const value = Number(target.value);
  // Лимит обновляется через changeLimit
  props.changeLimit();
}
</script>

<style scoped>
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

.btn-small {
  padding: 6px 12px;
  font-size: 12px;
}
</style>
