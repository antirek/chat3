<template>
  <div class="filter-panel">
    <BaseFilter
      input-id="topicFilterValue"
      select-id="topicFilterExample"
      label="Фильтр"
      :filter-value="filterValue"
      :selected-example="selectedFilterExample"
      :examples="topicFilterExamples"
      placeholder="Введите или выберите фильтр (topicId, dialogId, meta.*)"
      hint="Поддерживаются поля topicId, dialogId, meta.*. Операторы: eq, regex, in, nin, gt, gte, lt, lte, ne и др."
      container-style="padding: 0; border: none; background: transparent; margin-bottom: 12px;"
      :show-actions="false"
      @update:filter-value="(v) => emit('update:filterValue', v)"
      @update:selected-example="(v) => emit('update:selectedFilterExample', v)"
      @select-example="onFilterExampleSelect"
      @clear="clearFilter"
    />

    <div class="form-actions">
      <BaseButton variant="primary" @click="apply" :disabled="applying">
        {{ applying ? 'Применяется...' : buttonText }}
      </BaseButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { BaseFilter, BaseButton } from '@/shared/ui';
import { topicFilterExamples } from './examples';

interface Props {
  filterValue: string;
  selectedFilterExample: string;
  applying?: boolean;
  buttonText?: string;
}

const props = withDefaults(defineProps<Props>(), {
  applying: false,
  buttonText: 'Применить',
});

const emit = defineEmits<{
  (e: 'update:filterValue', value: string): void;
  (e: 'update:selectedFilterExample', value: string): void;
  (e: 'apply'): void;
}>();

function onFilterExampleSelect() {
  if (props.selectedFilterExample && props.selectedFilterExample !== 'custom') {
    emit('update:filterValue', props.selectedFilterExample);
  }
}

function clearFilter() {
  emit('update:filterValue', '');
  emit('update:selectedFilterExample', '');
}

function apply() {
  emit('apply');
}
</script>

<style scoped>
.filter-panel {
  padding: 12px 16px;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
}
.form-actions {
  margin-top: 12px;
}
</style>
