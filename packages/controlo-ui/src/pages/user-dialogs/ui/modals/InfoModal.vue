<template>
  <BaseModal :is-open="isOpen" :title="title" max-width="1200px" @close="$emit('close')">
    <div class="info-content" v-html="body"></div>
  </BaseModal>
</template>

<script setup lang="ts">
import { BaseModal } from '@/shared/ui';

interface Props {
  isOpen: boolean;
  title: string;
  body: string;
}

defineProps<Props>();
defineEmits<{ (e: 'close'): void }>();
</script>

<style scoped>
.info-content :deep(.json-content) {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  padding: 15px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow: auto;
  max-height: 60vh;
  margin: 0;
  display: block;
}

.info-content :deep(.url-info h4) {
  margin: 15px 0 8px 0;
  color: #333;
  font-size: 14px;
}

.info-content :deep(.url-display) {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  padding: 10px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  word-break: break-all;
  margin-bottom: 10px;
}

.info-content :deep(.params-list) {
  margin: 10px 0;
}

.info-content :deep(.params-list div) {
  margin: 5px 0;
  font-family: 'Courier New', monospace;
  font-size: 12px;
}

.info-content :deep(.url-copy) {
  margin-top: 10px;
}

.info-content :deep(.url-copy input) {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  width: 100%;
  padding: 8px;
  font-family: monospace;
  font-size: 12px;
}

.info-content :deep(.url-copy button) {
  display: block;
  margin-left: auto;
  margin-right: 0;
  margin-top: 8px;
  padding: 6px 12px;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.info-content :deep(.form-actions) {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 20px;
}

.info-content :deep(.form-actions button) {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
}

.info-content :deep(.btn-primary) {
  background: #667eea;
  color: white;
}

.info-content :deep(.btn-primary:hover) {
  background: #5a6fd8;
}

.info-content :deep(.btn-secondary) {
  background: #6c757d;
  color: white;
}

.info-content :deep(.btn-secondary:hover) {
  background: #5a6268;
}
</style>
