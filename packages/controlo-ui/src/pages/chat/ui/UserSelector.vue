<template>
  <div class="user-selector">
    <label for="user-select">Пользователь:</label>
    <div class="user-select-row">
      <select
        id="user-select"
        v-model="selectedUserId"
        :disabled="loading"
        @change="handleChange"
      >
        <option value="" disabled>Выберите пользователя</option>
        <option
          v-for="user in users"
          :key="user.userId"
          :value="user.userId"
        >
          {{ user.displayName || user.userId }}
        </option>
      </select>
      <button
        class="info-button"
        :disabled="!selectedUserId || loading"
        @click="$emit('showInfo', selectedUserId)"
        title="Информация о пользователе"
      >
        Инфо
      </button>
    </div>
    <div v-if="error" class="error">{{ error }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  users: any[];
  selectedUserId: string | null;
  loading?: boolean;
  error?: string | null;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  error: null,
});

const emit = defineEmits<{
  'update:selectedUserId': [value: string | null];
  'showInfo': [userId: string];
}>();

const selectedUserId = computed({
  get: () => props.selectedUserId,
  set: (value) => emit('update:selectedUserId', value || null),
});

function handleChange() {
  // Изменение обрабатывается через v-model
}
</script>

<style scoped>
.user-selector {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.user-selector label {
  font-size: 12px;
  color: #666;
  font-weight: 500;
}

.user-select-row {
  display: flex;
  gap: 8px;
  align-items: stretch;
}

.user-selector select {
  flex: 1;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  background: white;
  cursor: pointer;
}

.user-selector select:disabled {
  background: #f5f5f5;
  cursor: not-allowed;
}

.info-button {
  padding: 8px 16px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  background: #007bff;
  color: white;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 0.2s;
}

.info-button:hover:not(:disabled) {
  background: #0056b3;
}

.info-button:disabled {
  background: #ccc;
  cursor: not-allowed;
  opacity: 0.6;
}

.error {
  color: #d32f2f;
  font-size: 12px;
}
</style>
