<template>
  <BaseFilter
    input-id="userFilterInput"
    select-id="userFilterExample"
    label="Фильтр пользователей"
    :filter-value="filterInput"
    :selected-example="selectedFilterExample"
    :examples="examples"
    placeholder="Например: (userId,regex,carl)&(meta.role,eq,manager)"
    hint="Поддерживаются поля userId, type, meta.*. Операторы: eq, ne, in, nin, regex, gt, lt, gte, lte."
    @update:filter-value="(v) => emit('update:filterInput', v)"
    @update:selected-example="(v) => emit('update:selectedFilterExample', v)"
    @clear="clear"
    @apply="apply"
  />
</template>

<script setup lang="ts">
import { BaseFilter } from '@/shared/ui';
import { userFilterExamples } from './examples';

interface Props {
  filterInput: string;
  selectedFilterExample: string;
}

defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:filterInput', value: string): void;
  (e: 'update:selectedFilterExample', value: string): void;
  (e: 'clear'): void;
  (e: 'apply'): void;
}>();

const examples = userFilterExamples;

function clear() {
  emit('update:filterInput', '');
  emit('update:selectedFilterExample', '');
  emit('clear');
}

function apply() {
  emit('apply');
}
</script>
