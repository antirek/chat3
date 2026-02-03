<template>
  <BaseFilter
    input-id="packFilterInput"
    select-id="packFilterExample"
    label="Фильтр паков (meta)"
    :filter-value="filterInput"
    :selected-example="selectedFilterExample"
    :examples="examples"
    placeholder="Например: (meta.category,eq,support)"
    hint="Поля: meta.*. Операторы: eq, ne, in, nin, regex, gt, gte, lt, lte. И и ИЛИ: & и |."
    @update:filter-value="(v) => emit('update:filterInput', v)"
    @update:selected-example="(v) => emit('update:selectedFilterExample', v)"
    @clear="clear"
    @apply="apply"
  />
</template>

<script setup lang="ts">
import { BaseFilter } from '@/shared/ui';
import { packFilterExamples } from './examples';

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

const examples = packFilterExamples;

function clear() {
  emit('update:filterInput', '');
  emit('update:selectedFilterExample', '');
  emit('clear');
}

function apply() {
  emit('apply');
}
</script>
