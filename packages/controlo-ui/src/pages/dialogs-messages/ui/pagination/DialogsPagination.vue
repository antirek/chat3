<template>
  <BasePagination
    v-show="show"
    :current-page="currentPage"
    :total-pages="totalPages"
    :visible-pages="visiblePages"
    :show-page-numbers="true"
    :info-text="`Страница ${currentPage} из ${totalPages} (всего ${total} диалогов)`"
    @change="$emit('change', $event)"
  />
</template>

<script setup lang="ts">
import { BasePagination } from '@/shared/ui';

interface Props {
  show: boolean;
  currentPage: number;
  totalPages: number;
  total: number;
  visiblePages: number[];
}

defineProps<Props>();
defineEmits<{ (e: 'change', page: number): void }>();
</script>
