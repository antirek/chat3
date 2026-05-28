<template>
  <BaseFilter
    input-id="updates-filter"
    select-id="updates-filter-example"
    label="Фильтр updates"
    :filter-value="filterInput"
    :selected-example="selectedExample"
    :examples="examples"
    placeholder="Фильтр (например: eventType=message.create)"
    @update:filter-value="(v) => emit('update:filterInput', v)"
    @update:selected-example="(v) => { selectedExample = v }"
    @clear="clear"
    @apply="apply"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { BaseFilter } from '@/shared/ui';
import { updateFilterExamples } from './examples';

interface Props {
  filterInput: string;
  filterApplied?: boolean;
}

defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:filterInput', value: string): void;
  (e: 'clear'): void;
  (e: 'apply'): void;
}>();

const examples = updateFilterExamples;
const selectedExample = ref('');

function clear() {
  selectedExample.value = '';
  emit('update:filterInput', '');
  emit('clear');
}

function apply() {
  emit('apply');
}
</script>
