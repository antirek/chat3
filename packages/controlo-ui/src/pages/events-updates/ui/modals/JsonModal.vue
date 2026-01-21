<template>
  <BaseModal :is-open="isOpen" title="JSON данные" max-width="900px" @close="close">
    <div class="modal-url">{{ url }}</div>
    <div class="json-viewer">{{ content }}</div>
    <template #footer>
      <BaseButton variant="primary" @click="copy">📋 Копировать JSON</BaseButton>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { BaseModal, BaseButton } from '@/shared/ui';

interface Props {
  isOpen: boolean;
  url: string;
  content: string;
}

defineProps<Props>();
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'copy'): void;
}>();

function close() {
  emit('close');
}

function copy() {
  emit('copy');
}
</script>

<style scoped>
.modal-url {
  padding: 10px;
  background: #f8f9fa;
  border-radius: 4px;
  margin-bottom: 15px;
  font-family: monospace;
  font-size: 12px;
  word-break: break-all;
}

.json-viewer {
  background: #f8f9fa;
  padding: 15px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
  white-space: pre-wrap;
  word-wrap: break-word;
  max-height: 60vh;
  overflow-y: auto;
}

</style>
