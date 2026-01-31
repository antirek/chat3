<template>
  <BaseFilter
    input-id="messageFilterValue"
    select-id="messageFilterExample"
    label="Фильтр сообщений"
    :filter-value="filterValue"
    :selected-example="selectedExample"
    :examples="examples"
    placeholder="Введите или выберите фильтр"
    hint="Поддерживаются поля content, type, senderId, dialogId, meta.*, createdAt. Операторы: eq, ne, regex, in, nin, gt, lt, gte, lte."
    @update:filter-value="(v) => emit('update:filterValue', v)"
    @update:selected-example="(v) => emit('update:selectedExample', v)"
    @select-example="onSelectExample"
    @clear="clear"
    @apply="apply"
  />
</template>

<script setup lang="ts">
import { BaseFilter } from '@/shared/ui';
import { messageFilterExamples } from './examples';

interface Props {
  filterValue: string;
  selectedExample: string;
}

defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:filterValue', value: string): void;
  (e: 'update:selectedExample', value: string): void;
  (e: 'clear'): void;
  (e: 'apply'): void;
}>();

const examples = messageFilterExamples;

function onSelectExample() {
  // Handled by BaseFilter
}

function clear() {
  emit('update:filterValue', '');
  emit('update:selectedExample', '');
  emit('clear');
}

function apply() {
  emit('apply');
}
</script>
