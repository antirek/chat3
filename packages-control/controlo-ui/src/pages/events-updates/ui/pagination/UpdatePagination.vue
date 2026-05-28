<template>
  <BasePaginationExtended
    :current-page="currentPage"
    :current-page-input="currentPageInput"
    :total-pages="totalPages"
    :total="total"
    :pagination-start="paginationStart"
    :pagination-end="paginationEnd"
    :limit="currentLimit"
    @first="goToPage(1)"
    @prev="goToPage(currentPage - 1)"
    @next="goToPage(currentPage + 1)"
    @last="goToPage(totalPages)"
    @go-to-page="goToPage"
    @change-limit="onChangeLimit"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { BasePaginationExtended } from '@/shared/ui';

interface Props {
  paginationInfo: string;
  currentPage: number;
  currentPageInput: number;
  totalPages: number;
  currentLimit: number;
  total?: number;
  goToPage: (page: number) => void;
  changeLimit: () => void;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:currentLimit': [value: number];
}>();

const total = computed(() => props.total ?? 0);
const paginationStart = computed(() => (props.currentPage - 1) * props.currentLimit + 1);
const paginationEnd = computed(() => Math.min(props.currentPage * props.currentLimit, total.value));

function onChangeLimit(newLimit: number) {
  emit('update:currentLimit', newLimit);
  props.changeLimit();
}
</script>
