<template>
  <BaseModal :is-open="isOpen" :title="title" max-width="600px" @close="close">
    <div v-html="content"></div>
  </BaseModal>
</template>

<script setup lang="ts">
import { BaseModal } from '@/shared/ui';

interface Props {
  isOpen: boolean;
  title: string;
  content: string;
}

defineProps<Props>();
const emit = defineEmits<{ (e: 'close'): void }>();

function close() {
  emit('close');
}
</script>

<style>
/* Стили для динамически вставляемого контента через v-html (не scoped) */
.json-content {
  background: #f8f9fa !important;
  border: 1px solid #e9ecef !important;
  border-radius: 4px !important;
  padding: 10px !important;
  font-family: 'Courier New', monospace !important;
  font-size: 12px !important;
  white-space: pre-wrap !important;
  overflow-x: auto !important;
  word-wrap: break-word !important;
}

.info-url {
  margin-bottom: 15px;
  padding: 8px;
  background: #f8f9fa;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
  word-break: break-all;
  color: #495057;
}

.url-info h4 {
  margin: 15px 0 8px 0;
  color: #333;
  font-size: 14px;
}

.url-display {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  padding: 10px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  word-break: break-all;
  margin-bottom: 10px;
}

.params-list {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  padding: 10px;
  font-size: 12px;
}

.params-list div {
  margin: 5px 0;
  font-family: 'Courier New', monospace;
  font-size: 12px;
}

.url-copy input {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 4px;
}

.form-actions {
  display: flex !important;
  gap: 8px !important;
  margin-top: 12px !important;
}

.form-actions button {
  padding: 6px 12px !important;
  border: none !important;
  border-radius: 4px !important;
  cursor: pointer !important;
  font-size: 12px !important;
  font-weight: 500 !important;
  transition: all 0.2s !important;
}

.form-actions button:disabled {
  opacity: 0.5 !important;
  cursor: not-allowed !important;
}

.btn-primary {
  background: #667eea !important;
  color: white !important;
  border: none !important;
}

.btn-primary:hover:not(:disabled) {
  background: #5a6fd8 !important;
}

.btn-secondary {
  background: #6c757d !important;
  color: white !important;
  border: none !important;
}

.btn-secondary:hover:not(:disabled) {
  background: #5a6268 !important;
}
</style>
