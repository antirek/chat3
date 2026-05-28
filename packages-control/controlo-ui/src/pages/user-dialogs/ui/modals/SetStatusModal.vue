<template>
  <BaseModal :is-open="isOpen" title="✏️ Установить статус сообщения" max-width="500px" @close="handleClose">
    <div v-if="url" class="url-info">{{ url }}</div>

    <div class="status-section">
      <p class="status-hint">Выберите статус для текущего пользователя:</p>
      <div class="status-buttons">
        <BaseButton color="#6c757d" @click="emit('set-status', 'unread')">
          📤 Sent (unread)
        </BaseButton>
        <BaseButton color="#17a2b8" @click="emit('set-status', 'delivered')">
          📥 Received (delivered)
        </BaseButton>
        <BaseButton color="#28a745" @click="emit('set-status', 'read')">
          ✓ Read
        </BaseButton>
      </div>
    </div>

    <div class="custom-status-section">
      <p class="status-hint">Или введите произвольный статус (буквы, цифры, _ или -, до 64 символов):</p>
      <div class="custom-status-row">
        <input
          v-model="customStatus"
          type="text"
          class="custom-status-input"
          placeholder="например error2, pending"
          maxlength="64"
          @keydown.enter="submitCustomStatus"
        />
        <BaseButton variant="primary" size="small" :disabled="!canSubmitCustom" @click="submitCustomStatus">
          Установить
        </BaseButton>
      </div>
      <p v-if="customStatusError" class="custom-status-error">{{ customStatusError }}</p>
    </div>

    <div v-if="result" class="result-message" :class="{ error: result.startsWith('✗') }" v-html="formatResult(result)">
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { BaseModal, BaseButton } from '@/shared/ui';

const CUSTOM_STATUS_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

interface Props {
  isOpen: boolean;
  url?: string;
  result?: string;
}

defineProps<Props>();
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'set-status', status: string): void;
}>();

const customStatus = ref('');
const customStatusError = ref('');

watch(customStatus, (val) => {
  customStatusError.value = '';
  if (!val.trim()) return;
  if (!CUSTOM_STATUS_PATTERN.test(val)) {
    customStatusError.value = 'Только буквы, цифры, _ или -, до 64 символов';
  }
});

const canSubmitCustom = computed(() => {
  const s = customStatus.value.trim();
  return s.length > 0 && CUSTOM_STATUS_PATTERN.test(s);
});

function submitCustomStatus() {
  if (!canSubmitCustom.value) return;
  const s = customStatus.value.trim();
  emit('set-status', s);
  customStatus.value = '';
  customStatusError.value = '';
}

function handleClose() {
  customStatus.value = '';
  customStatusError.value = '';
  emit('close');
}

function formatResult(result: string): string {
  const lines = result.split('\n');
  const firstLine = `<strong>${lines[0]}</strong>`;
  const rest = lines.slice(1).map(line => 
    line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  ).join('<br>');
  return rest ? `${firstLine}<br>${rest}` : firstLine;
}
</script>

<style scoped>
.url-info {
  margin-bottom: 15px;
  padding: 8px;
  background: #f8f9fa;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
  word-break: break-all;
  color: #495057;
}

.status-section {
  margin-bottom: 20px;
}

.status-hint {
  color: #666;
  font-size: 14px;
  margin-bottom: 15px;
}

.status-buttons {
  display: flex;
  gap: 15px;
  justify-content: center;
  flex-wrap: wrap;
}

.custom-status-section {
  margin-top: 20px;
  padding-top: 15px;
  border-top: 1px solid #eee;
}

.custom-status-row {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-top: 8px;
}

.custom-status-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 14px;
}

.custom-status-input:focus {
  outline: none;
  border-color: #17a2b8;
}

.custom-status-error {
  margin-top: 6px;
  font-size: 12px;
  color: #dc3545;
}

.result-message {
  margin-top: 20px;
  padding: 15px;
  border-radius: 4px;
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
  white-space: pre-line;
}

.result-message.error {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}
</style>
