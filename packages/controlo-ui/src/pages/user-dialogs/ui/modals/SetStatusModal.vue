<template>
  <BaseModal :is-open="isOpen" title="✏️ Установить статус сообщения" max-width="500px" @close="$emit('close')">
    <div v-if="url" class="url-info">{{ url }}</div>
    
    <div class="status-section">
      <p class="status-hint">Выберите статус для текущего пользователя:</p>
      <div class="status-buttons">
        <button type="button" class="status-btn unread" @click="$emit('set-status', 'unread')">
          📤 Sent (unread)
        </button>
        <button type="button" class="status-btn delivered" @click="$emit('set-status', 'delivered')">
          📥 Received (delivered)
        </button>
        <button type="button" class="status-btn read" @click="$emit('set-status', 'read')">
          ✓ Read
        </button>
      </div>
    </div>

    <div v-if="result" class="result-message" :class="{ error: result.startsWith('✗') }" v-html="formatResult(result)">
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { BaseModal } from '@/shared/ui';

interface Props {
  isOpen: boolean;
  url?: string;
  result?: string;
}

defineProps<Props>();
defineEmits<{
  (e: 'close'): void;
  (e: 'set-status', status: 'unread' | 'delivered' | 'read'): void;
}>();

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

.status-btn {
  color: white;
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: bold;
  transition: all 0.2s;
}

.status-btn:hover {
  opacity: 0.9;
  transform: scale(1.05);
}

.status-btn.unread {
  background: #6c757d;
}

.status-btn.delivered {
  background: #17a2b8;
}

.status-btn.read {
  background: #28a745;
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
