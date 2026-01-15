<template>
  <BasePagination
    :current-page="currentPage"
    :total-pages="totalPages"
    :total="total"
    :info-text="infoText"
    :visible-pages="visiblePages"
    :show-page-numbers="showPageNumbers"
    :show-icon-buttons="showIconButtons"
    :container-style="containerStyle"
    @change="$emit('change', $event)"
    @first="$emit('first')"
    @prev="$emit('prev')"
    @next="$emit('next')"
    @last="$emit('last')"
  />
</template>

<script setup lang="ts">
import { BasePagination } from '@/shared/ui';

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

withDefaults(defineProps<Props>(), {
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
