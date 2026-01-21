<template>
  <BasePaginationExtended
    :current-page="currentPage"
    :current-page-input="currentPageInput"
    :total-pages="totalPages"
    :total="total"
    :pagination-start="paginationStart"
    :pagination-end="paginationEnd"
    :limit="currentLimit"
    @first="$emit('go-to-page', 1)"
    @prev="$emit('go-to-page', currentPage - 1)"
    @next="$emit('go-to-page', currentPage + 1)"
    @last="$emit('go-to-page', totalPages)"
    @go-to-page="$emit('go-to-page', $event)"
    @change-limit="$emit('change-limit', $event)"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { BasePaginationExtended } from '@/shared/ui';

interface Props {
  currentPage: number;
  currentPageInput: number;
  totalPages: number;
  total: number;
  currentLimit: number;
}

const props = defineProps<Props>();

defineEmits<{
  (e: 'go-to-page', page: number): void;
  (e: 'change-limit', limit: number): void;
}>();

const paginationStart = computed(() => (props.currentPage - 1) * props.currentLimit + 1);
const paginationEnd = computed(() => Math.min(props.currentPage * props.currentLimit, props.total));
</script>
