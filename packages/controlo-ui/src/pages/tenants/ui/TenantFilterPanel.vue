<template>
  <div class="filter-panel">
    <div class="form-section">
      <label for="tenantFilterInput">
        🔍 Фильтр тенантов (формат: <code>(поле,оператор,значение)</code>)
      </label>
      <select
        id="tenantFilterExample"
        v-model="selectedExample"
        @change="selectExample"
        style="margin-bottom: 8px;"
      >
        <option value="">Выберите пример</option>
        <optgroup label="tenantId">
          <option value="(tenantId,regex,test)">tenantId содержит "test"</option>
          <option value="(tenantId,eq,tnt_default)">tenantId = tnt_default</option>
        </optgroup>
        <optgroup label="meta.*">
          <option value="(meta.company,eq,MyCompany)">meta.company = MyCompany</option>
          <option value="(meta.region,regex,europe)">meta.region содержит "europe"</option>
        </optgroup>
        <option value="custom">Пользовательский фильтр</option>
      </select>
      <div class="input-with-clear" style="margin-bottom: 8px;">
        <input
          type="text"
          id="tenantFilterInput"
          v-model="filterInput"
          placeholder="Например: (tenantId,regex,test)&(meta.company,eq,MyCompany)"
        />
        <button
          class="clear-field"
          type="button"
          @click="clear"
          title="Очистить поле"
        >
          ✕
        </button>
      </div>
      <small style="display: block; color: #6c757d;">
        Поддерживаются поля `tenantId`, `meta.*`. Операторы: eq, ne, in, nin, regex, gt, lt, gte, lte.
      </small>
    </div>
    <div class="form-actions">
      <button class="btn-primary" type="button" @click="apply">Применить</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

interface Props {
  filterInput: string;
  selectedFilterExample: string;
}

interface Emits {
  (e: 'update:filterInput', value: string): void;
  (e: 'update:selectedFilterExample', value: string): void;
  (e: 'select-example'): void;
  (e: 'clear'): void;
  (e: 'apply'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const filterInput = ref(props.filterInput);
const selectedExample = ref(props.selectedFilterExample);

watch(() => props.filterInput, (val) => {
  filterInput.value = val;
});

watch(() => props.selectedFilterExample, (val) => {
  selectedExample.value = val;
});

watch(filterInput, (val) => {
  emit('update:filterInput', val);
});

watch(selectedExample, (val) => {
  emit('update:selectedFilterExample', val);
});

function selectExample() {
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
  background: #ffffff;
}

.filter-panel .form-section {
  margin-bottom: 12px;
}

.filter-panel label {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 500;
  color: #495057;
}

.filter-panel select,
.filter-panel input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 12px;
  background: white;
}

.filter-panel .input-with-clear {
  position: relative;
  display: flex;
  align-items: center;
}

.filter-panel .input-with-clear input {
  padding-right: 30px;
}

.filter-panel .clear-field {
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

.filter-panel .clear-field:hover {
  background: #e9ecef;
  color: #333;
}

.filter-panel .form-actions {
  margin-top: 10px;
}

.form-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 20px;
}

button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #667eea;
  color: white;
  border: none;
}

.btn-primary:hover:not(:disabled) {
  background: #5a6fd8;
}
</style>
