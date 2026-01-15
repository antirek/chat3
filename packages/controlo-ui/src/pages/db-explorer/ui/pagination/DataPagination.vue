<template>
  <BasePaginationExtended
    v-if="currentModel && filteredDataLength > 0"
    :current-page="currentPage"
    :current-page-input="currentPageInput"
    :total-pages="totalPages"
    :total="paginationTotal"
    :pagination-start="(currentPage - 1) * currentLimit + 1"
    :pagination-end="Math.min(currentPage * currentLimit, paginationTotal)"
    :limit="currentLimit"
    @first="goToFirstPage"
    @prev="goToPreviousPage"
    @next="goToNextPage"
    @last="goToLastPage"
    @go-to-page="goToPage"
    @change-limit="changeLimit"
  />
</template>

<script setup lang="ts">
import { BasePaginationExtended } from '@/shared/ui';

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
  changeLimit: (newLimit?: number) => void;
}

defineProps<Props>();
</script>
