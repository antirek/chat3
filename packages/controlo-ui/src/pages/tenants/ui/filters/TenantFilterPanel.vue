<template>
  <BaseFilter
    input-id="tenantFilterInput"
    select-id="tenantFilterExample"
    label="Фильтр тенантов"
    :filter-value="filterInput"
    :selected-example="selectedFilterExample"
    :examples="examples"
    placeholder="Например: (tenantId,regex,test)&(meta.company,eq,MyCompany)"
    hint="Поддерживаются поля tenantId, meta.*. Операторы: eq, ne, in, nin, regex, gt, lt, gte, lte."
    @update:filter-value="(v) => emit('update:filterInput', v)"
    @update:selected-example="(v) => emit('update:selectedFilterExample', v)"
    @clear="clear"
    @apply="apply"
  />
</template>

<script setup lang="ts">
import { BaseFilter } from '@/shared/ui';
import { tenantFilterExamples } from './examples';

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

const examples = tenantFilterExamples;

function clear() {
  emit('update:filterInput', '');
  emit('update:selectedFilterExample', '');
  emit('clear');
}

function apply() {
  emit('apply');
}
</script>
