<template>
  <div class="filter-panel">
    <BaseFilter
      input-id="filterValue"
      select-id="filterExample"
      label="Фильтр"
      :filter-value="filterValue"
      :selected-example="selectedFilterExample"
      :examples="filterExamples"
      placeholder="Введите или выберите фильтр"
      hint="Поля: dialogId, meta.*, member, message.createdAt (диалоги с сообщениями во времени; при gte+lte интервал ≤24 ч; с | и message.* нельзя). Операторы: eq, ne, in, nin, regex, gt, gte, lt, lte. И и ИЛИ: & и |; скобки задают группы, внутри группы только И или только ИЛИ (макс. 5 в группе)."
      container-style="padding: 0; border: none; background: transparent; margin-bottom: 12px;"
      :show-actions="false"
      @update:filter-value="(v) => emit('update:filterValue', v)"
      @update:selected-example="(v) => emit('update:selectedFilterExample', v)"
      @select-example="onFilterExampleSelect"
      @clear="clearFilter"
    />

    <div class="form-section">
      <label>🔄 Сортировка:</label>
      <select v-model="localSortExample" @change="onSortExampleChange">
        <option value="">Выберите пример сортировки</option>
        <option v-for="example in sortExamples" :key="example.value" :value="example.value">
          {{ example.label }}
        </option>
      </select>
      <div class="input-with-clear">
        <input type="text" v-model="localSortValue" placeholder="Введите или выберите сортировку" />
        <button class="clear-field" @click="clearSort" title="Очистить сортировку">✕</button>
      </div>
    </div>

    <div class="form-actions">
      <BaseButton variant="primary" @click="apply" :disabled="applying">
        {{ applying ? 'Применяется...' : buttonText }}
      </BaseButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { BaseFilter, BaseButton } from '@/shared/ui';
import { dialogFilterExamples, dialogSortExamples } from './examples';

interface Props {
  filterValue: string;
  selectedFilterExample: string;
  sortValue: string;
  selectedSortExample: string;
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
  (e: 'update:sortValue', value: string): void;
  (e: 'update:selectedSortExample', value: string): void;
  (e: 'apply'): void;
}>();

const filterExamples = dialogFilterExamples;
const sortExamples = dialogSortExamples;

const localSortValue = ref(props.sortValue);
const localSortExample = ref(props.selectedSortExample);

watch(() => props.sortValue, (v) => { localSortValue.value = v; });
watch(() => props.selectedSortExample, (v) => { localSortExample.value = v; });
watch(localSortValue, (v) => emit('update:sortValue', v));

function onFilterExampleSelect() {
  if (props.selectedFilterExample && props.selectedFilterExample !== 'custom') {
    emit('update:filterValue', props.selectedFilterExample);
  }
}

function onSortExampleChange() {
  emit('update:selectedSortExample', localSortExample.value);
  if (localSortExample.value && localSortExample.value !== 'custom') {
    localSortValue.value = localSortExample.value;
  }
}

function clearFilter() {
  emit('update:filterValue', '');
  emit('update:selectedFilterExample', '');
}

function clearSort() {
  localSortValue.value = '';
  localSortExample.value = '';
  emit('update:sortValue', '');
  emit('update:selectedSortExample', '');
}

function apply() {
  emit('apply');
}
</script>

<style scoped>
.filter-panel {
  padding: 15px;
  border-bottom: 1px solid #e9ecef;
  background: #f8f9fa;
}

.form-section {
  margin-bottom: 12px;
}

.form-section label {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 500;
  color: #495057;
}

.form-section select,
.form-section input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 12px;
  background: white;
  margin-bottom: 6px;
}

.input-with-clear {
  position: relative;
  display: flex;
  align-items: center;
}

.input-with-clear input {
  padding-right: 30px;
  margin-bottom: 0;
}

.clear-field {
  position: absolute;
  right: 5px;
  background: none;
  border: none;
  color: #6c757d;
  cursor: pointer;
  font-size: 16px;
  padding: 2px 6px;
  border-radius: 3px;
}

.clear-field:hover {
  background: #e9ecef;
  color: #333;
}

.form-actions {
  margin-top: 10px;
  display: flex;
  justify-content: flex-end;
}

</style>

