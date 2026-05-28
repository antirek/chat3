<template>
  <BaseFilter
    input-id="messageFilterInput"
    select-id="messageFilterExample"
    label="Фильтр сообщений"
    :filter-value="filterInput"
    :selected-example="selectedFilterExample"
    :examples="examples"
    placeholder="Введите или выберите фильтр сообщений"
    hint="Поля: content, type, senderId, dialogId, meta.*, createdAt. Операторы: eq, ne, in, nin, regex, gt, gte, lt, lte. И и ИЛИ: & и |; скобки задают группы (макс. 5 в группе)."
    @update:filter-value="(v) => emit('update:filterInput', v)"
    @update:selected-example="(v) => emit('update:selectedFilterExample', v)"
    @clear="clear"
    @apply="apply"
  />
</template>

<script setup lang="ts">
import { BaseFilter } from '@/shared/ui';
import { messageFilterExamples } from './examples';

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

const examples = messageFilterExamples;

function clear() {
  emit('update:filterInput', '');
  emit('update:selectedFilterExample', '');
  emit('clear');
}

function apply() {
  emit('apply');
}
</script>
