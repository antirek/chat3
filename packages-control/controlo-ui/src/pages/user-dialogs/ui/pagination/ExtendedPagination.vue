<template>
  <BasePaginationExtended
    :current-page="currentPage"
    :current-page-input="currentPageInput"
    :total-pages="totalPages"
    :total="total"
    :pagination-start="paginationStart"
    :pagination-end="paginationEnd"
    :limit="limit"
    :container-style="containerStyle"
    @first="$emit('first')"
    @prev="$emit('prev')"
    @next="$emit('next')"
    @last="$emit('last')"
    @go-to-page="$emit('go-to-page', $event)"
    @change-limit="$emit('change-limit', $event)"
  />
</template>

<script setup lang="ts">
import { BasePaginationExtended } from '@/shared/ui';

interface Props {
  currentPage: number;
  currentPageInput: number;
  totalPages: number;
  total: number;
  paginationStart: number;
  paginationEnd: number;
  limit: number;
  containerStyle?: string;
}

withDefaults(defineProps<Props>(), {
  containerStyle: '',
});

defineEmits<{
  (e: 'first'): void;
  (e: 'prev'): void;
  (e: 'next'): void;
  (e: 'last'): void;
  (e: 'go-to-page', page: number): void;
  (e: 'change-limit', limit: number): void;
}>();
</script>
