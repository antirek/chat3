<template>
  <div class="filter-panel" :style="containerStyle">
    <div class="form-section">
      <label :for="inputId">
        🔍 {{ label }}
      </label>
      <select
        v-if="examples.length > 0"
        :id="selectId"
        :value="selectedExample"
        @change="onExampleChange"
        class="filter-select"
      >
        <option value="">{{ selectPlaceholder }}</option>
        <template v-for="example in examples" :key="example.value || example.label">
          <optgroup v-if="example.options" :label="example.label">
            <option
              v-for="opt in example.options"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </option>
          </optgroup>
          <option v-else :value="example.value">{{ example.label }}</option>
        </template>
      </select>
      <div class="input-with-clear">
        <input
          type="text"
          :id="inputId"
          :value="filterValue"
          :placeholder="placeholder"
          @input="onInput"
          @keydown.enter="apply"
        />
        <button class="clear-field" type="button" @click="clear" title="Очистить поле">✕</button>
      </div>
      <small v-if="hint" class="filter-hint">
        {{ hint }}
      </small>
    </div>
    <div class="form-actions">
      <button class="btn-primary" type="button" @click="apply">Применить</button>
    </div>
  </div>
</template>

<script setup lang="ts">
export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterExample {
  label: string;
  value?: string;
  options?: FilterOption[];
}

export interface BaseFilterProps {
  inputId: string;
  selectId?: string;
  label: string;
  filterValue: string;
  selectedExample?: string;
  placeholder?: string;
  selectPlaceholder?: string;
  hint?: string;
  examples?: FilterExample[];
  containerStyle?: string;
}

const props = withDefaults(defineProps<BaseFilterProps>(), {
  selectId: '',
  selectedExample: '',
  placeholder: 'Введите или выберите фильтр',
  selectPlaceholder: 'Выберите пример фильтра',
  hint: '',
  examples: () => [],
  containerStyle: '',
});

const emit = defineEmits<{
  (e: 'update:filterValue', value: string): void;
  (e: 'update:selectedExample', value: string): void;
  (e: 'select-example'): void;
  (e: 'clear'): void;
  (e: 'apply'): void;
}>();

function onInput(e: Event) {
  emit('update:filterValue', (e.target as HTMLInputElement).value);
}

function onExampleChange(e: Event) {
  emit('update:selectedExample', (e.target as HTMLSelectElement).value);
  emit('select-example');
}

function clear() {
  emit('clear');
}

function apply() {
  emit('apply');
}
</script>

<style scoped>
.filter-panel {
  padding: 15px 20px;
  border-bottom: 1px solid #e9ecef;
  background: #f8f9fa;
}

.form-section {
  margin-bottom: 0;
}

.form-section label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #495057;
  font-size: 13px;
}

.filter-select {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 12px;
  background: white;
  margin-bottom: 8px;
}

.input-with-clear {
  position: relative;
  display: flex;
  align-items: center;
}

.input-with-clear input {
  flex: 1;
  padding: 6px 30px 6px 10px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 12px;
  width: 100%;
}

.input-with-clear input:focus {
  outline: none;
  border-color: #667eea;
}

.clear-field {
  position: absolute;
  right: 8px;
  background: none;
  border: none;
  cursor: pointer;
  color: #6c757d;
  font-size: 14px;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.clear-field:hover {
  color: #495057;
}

.filter-hint {
  display: block;
  margin-top: 6px;
  color: #6c757d;
  font-size: 11px;
}

.form-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
  justify-content: flex-end;
}

.btn-primary {
  padding: 6px 12px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
}

.btn-primary:hover {
  background: #5568d3;
}
</style>
