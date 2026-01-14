<template>
  <div class="filter-form">
    <div class="filter-examples">
      <span class="filter-example" @click="setFilterExample('eventType', 'message.create')">eventType: message.create</span>
      <span class="filter-example" @click="setFilterExample('userId', '')">userId: </span>
      <span class="filter-example" @click="setFilterExample('entityId', '')">entityId: </span>
    </div>
    <div class="filter-row">
      <div class="filter-input-group">
        <input
          type="text"
          id="updates-filter"
          v-model="filterInput"
          class="filter-input"
          placeholder="Фильтр (например: eventType=message.create)"
        />
        <button class="filter-clear" @click="clear" title="Очистить">×</button>
      </div>
      <button class="filter-apply" :class="{ active: filterApplied }" @click="apply">Применить</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

interface Props {
  filterInput: string;
  filterApplied: boolean;
}

interface Emits {
  (e: 'update:filterInput', value: string): void;
  (e: 'set-filter-example', field: string, value: string): void;
  (e: 'clear'): void;
  (e: 'apply'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const filterInput = ref(props.filterInput);

watch(() => props.filterInput, (val) => {
  filterInput.value = val;
});

watch(filterInput, (val) => {
  emit('update:filterInput', val);
});

function setFilterExample(field: string, value: string) {
  emit('set-filter-example', field, value);
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
  border-bottom: 1px solid #e9ecef;
}

.filter-row {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 10px;
}

.filter-row:last-child {
  margin-bottom: 0;
}

.filter-examples {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.filter-example {
  padding: 4px 8px;
  background: #e9ecef;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
}

.filter-example:hover {
  background: #dee2e6;
}

.filter-input-group {
  flex: 1;
  display: flex;
  gap: 5px;
  align-items: center;
  position: relative;
}

.filter-input {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 12px;
}

.filter-input:focus {
  outline: none;
  border-color: #667eea;
}

.filter-clear {
  position: absolute;
  right: 30px;
  background: none;
  border: none;
  cursor: pointer;
  color: #6c757d;
  font-size: 16px;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.filter-clear:hover {
  color: #495057;
}

.filter-apply {
  padding: 6px 12px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
}

.filter-apply:hover {
  background: #5568d3;
}

.filter-apply.active {
  background: #28a745;
}
</style>
