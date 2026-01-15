<template>
  <BaseFilter
    :input-id="inputId"
    :select-id="selectId"
    :label="label"
    :filter-value="filterValue"
    :selected-example="selectedExample"
    :placeholder="placeholder"
    :hint="hint"
    :examples="examples"
    :container-style="formStyle"
    @update:filter-value="(v) => emit('update:filterValue', v)"
    @update:selected-example="(v) => emit('update:selectedExample', v)"
    @select-example="emit('select-example')"
    @clear="emit('clear')"
    @apply="emit('apply')"
  />
</template>

<script setup lang="ts">
import { BaseFilter, type FilterExample } from '@/shared/ui';

export type { FilterExample };
export type { FilterOption } from '@/shared/ui';

interface Props {
  inputId: string;
  selectId?: string;
  label: string;
  filterValue: string;
  selectedExample: string;
  placeholder?: string;
  hint?: string;
  examples?: FilterExample[];
  formStyle?: string;
}

withDefaults(defineProps<Props>(), {
  selectId: '',
  placeholder: '',
  hint: '',
  examples: () => [],
  formStyle: '',
});

const emit = defineEmits<{
  (e: 'update:filterValue', value: string): void;
  (e: 'update:selectedExample', value: string): void;
  (e: 'select-example'): void;
  (e: 'clear'): void;
  (e: 'apply'): void;
}>();
</script>
