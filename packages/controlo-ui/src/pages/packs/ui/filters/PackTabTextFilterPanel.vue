<template>
  <BaseFilter
    :input-id="inputId"
    select-id=""
    :label="label"
    :filter-value="filterValue"
    selected-example=""
    :examples="[]"
    :placeholder="placeholder"
    :hint="hint"
    @update:filter-value="(v) => emit('update:filterValue', v)"
    @clear="clear"
    @apply="apply"
  />
</template>

<script setup lang="ts">
import { BaseFilter } from '@/shared/ui';

interface Props {
  inputId: string;
  label: string;
  filterValue: string;
  placeholder?: string;
  hint?: string;
}

withDefaults(defineProps<Props>(), {
  placeholder: 'Подстрока для поиска',
  hint: '',
});

const emit = defineEmits<{
  (e: 'update:filterValue', value: string): void;
  (e: 'clear'): void;
  (e: 'apply'): void;
}>();

function clear() {
  emit('update:filterValue', '');
  emit('clear');
}

function apply() {
  emit('apply');
}
</script>
