<template>
  <div class="filter-panel">
    <div class="form-section">
      <label for="userFilterInput">
        🔍 Фильтр пользователей (формат: <code>(поле,оператор,значение)</code>)
      </label>
      <select
        id="userFilterExample"
        v-model="selectedExample"
        @change="selectExample"
        style="margin-bottom: 8px;"
      >
        <option value="">Выберите пример</option>
        <optgroup label="userId">
          <option value="(userId,regex,bot)">userId содержит "bot"</option>
          <option value="(userId,eq,system_bot)">userId = system_bot</option>
        </optgroup>
        <optgroup label="type">
          <option value="(type,in,[user,bot])">type в списке [user, bot]</option>
          <option value="(type,eq,user)">type = user</option>
          <option value="(type,eq,bot)">type = bot</option>
          <option value="(type,eq,contact)">type = contact</option>
        </optgroup>
        <optgroup label="meta.*">
          <option value="(meta.role,eq,manager)">meta.role = manager</option>
          <option value="(meta.region,regex,europe)">meta.region содержит "europe"</option>
        </optgroup>
        <option value="custom">Пользовательский фильтр</option>
      </select>
      <div class="input-with-clear" style="margin-bottom: 8px;">
        <input
          type="text"
          id="userFilterInput"
          v-model="filterInput"
          placeholder="Например: (userId,regex,carl)&(meta.role,eq,manager)"
          @keydown.enter="apply"
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
        Поддерживаются поля `userId`, `type`, `meta.*`. Операторы: eq, ne, in, nin, regex, gt, lt, gte, lte.
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
  display: flex;
  justify-content: flex-end;
}

.btn-primary {
  background: #667eea;
  color: white;
  border: none;
}

.btn-primary:hover:not(:disabled) {
  background: #5a6fd8;
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

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
