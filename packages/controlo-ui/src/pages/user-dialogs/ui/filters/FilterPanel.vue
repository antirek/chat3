<template>
  <div class="filter-form" :style="formStyle">
    <div class="form-section">
      <label :for="inputId">🔍 {{ label }}</label>
      <select
        v-if="examples.length > 0"
        :id="selectId"
        :value="selectedExample"
        @change="onExampleChange"
        style="margin-bottom: 8px;"
      >
        <option value="">Выберите пример</option>
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
        />
        <button class="clear-field" type="button" @click="clear" title="Очистить поле">✕</button>
      </div>
      <small v-if="hint" style="display: block; margin-top: 6px; color: #6c757d;">
        {{ hint }}
      </small>
    </div>
    <div class="form-actions" style="margin-top: 8px; justify-content: flex-end;">
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

interface Emits {
  (e: 'update:filterValue', value: string): void;
  (e: 'update:selectedExample', value: string): void;
  (e: 'select-example'): void;
  (e: 'clear'): void;
  (e: 'apply'): void;
}

const props = withDefaults(defineProps<Props>(), {
  selectId: '',
  placeholder: '',
  hint: '',
  examples: () => [],
  formStyle: '',
});

const emit = defineEmits<Emits>();

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
.filter-form {
  padding: 15px;
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

.form-section select {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 12px;
  background: white;
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

.form-actions {
  display: flex;
  gap: 8px;
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
