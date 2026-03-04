<template>
  <BaseFilter
    :input-id="inputId"
    select-id=""
    :label="label"
    :filter-value="filterValue"
    selected-example=""
    :examples="examples"
    :placeholder="placeholder"
    :hint="hint"
    @update:filter-value="(v) => emit('update:filterValue', v)"
    @clear="clear"
    @apply="apply"
  />
</template>

<script setup lang="ts">
import { BaseFilter, type FilterExample } from '@/shared/ui';

interface Props {
  inputId: string;
  label: string;
  filterValue: string;
  examples?: FilterExample[];
  placeholder?: string;
  hint?: string;
}

withDefaults(defineProps<Props>(), {
  examples: () => [],
  placeholder: '(meta.key,eq,value) или (dialogId,eq,dlg_...)',
  hint: 'Фильтр по meta диалогов и dialogId. Примеры: (meta.channel,eq,telegram), (dialogId,eq,dlg_xxx)',
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
