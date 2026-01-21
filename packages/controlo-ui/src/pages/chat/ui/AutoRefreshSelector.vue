<template>
  <div class="auto-refresh-selector">
    <label for="refresh-select">Автообновление:</label>
    <select
      id="refresh-select"
      v-model="selectedInterval"
      @change="handleChange"
    >
      <option
        v-for="option in options"
        :key="option.value"
        :value="option.value"
      >
        {{ option.label }}
      </option>
    </select>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { AUTO_REFRESH_OPTIONS, type AutoRefreshInterval } from '../model/useAutoRefresh';

interface Props {
  interval: AutoRefreshInterval;
  options?: { value: AutoRefreshInterval; label: string }[];
}

const props = withDefaults(defineProps<Props>(), {
  options: AUTO_REFRESH_OPTIONS,
});

const emit = defineEmits<{
  'update:interval': [value: AutoRefreshInterval];
}>();

const selectedInterval = computed({
  get: () => props.interval,
  set: (value) => emit('update:interval', value),
});

function handleChange() {
  // Изменение обрабатывается через v-model
}
</script>

<style scoped>
.auto-refresh-selector {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.auto-refresh-selector label {
  font-size: 12px;
  color: #666;
  font-weight: 500;
}

.auto-refresh-selector select {
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  background: white;
  cursor: pointer;
}
</style>
