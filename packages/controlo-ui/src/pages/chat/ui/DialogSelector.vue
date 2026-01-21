<template>
  <div class="dialog-selector">
    <label for="dialog-select">Диалог:</label>
    <div class="dialog-select-row">
      <select
        id="dialog-select"
        v-model="selectedDialogId"
        :disabled="loading || !enabled"
        @change="handleChange"
      >
        <option value="" disabled>{{ enabled ? 'Выберите диалог' : 'Сначала выберите пользователя' }}</option>
        <option
          v-for="dialog in dialogs"
          :key="dialog.dialogId"
          :value="dialog.dialogId"
        >
          {{ dialog.dialogId }} {{ dialog.unreadCount > 0 ? `(${dialog.unreadCount})` : '' }}
        </option>
      </select>
      <button
        class="info-button"
        :disabled="!selectedDialogId || loading || !enabled"
        @click="$emit('showInfo', selectedDialogId)"
        title="Информация о диалоге"
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
  dialogs: any[];
  selectedDialogId: string | null;
  loading?: boolean;
  error?: string | null;
  enabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  error: null,
  enabled: false,
});

const emit = defineEmits<{
  'update:selectedDialogId': [value: string | null];
  'showInfo': [dialogId: string];
}>();

const selectedDialogId = computed({
  get: () => props.selectedDialogId,
  set: (value) => emit('update:selectedDialogId', value || null),
});

function handleChange() {
  // Изменение обрабатывается через v-model
}
</script>

<style scoped>
.dialog-selector {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.dialog-selector label {
  font-size: 12px;
  color: #666;
  font-weight: 500;
}

.dialog-select-row {
  display: flex;
  gap: 8px;
  align-items: stretch;
}

.dialog-selector select {
  flex: 1;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  background: white;
  cursor: pointer;
}

.dialog-selector select:disabled {
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
