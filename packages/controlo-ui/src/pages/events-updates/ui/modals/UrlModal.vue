<template>
  <BaseModal :is-open="isOpen" title="URL запроса" max-width="900px" @close="close">
    <div class="modal-url">{{ url }}</div>
    <template #footer>
      <button class="btn-copy" @click="copy">Скопировать URL</button>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { BaseModal } from '@/shared/ui';

interface Props {
  isOpen: boolean;
  url: string;
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
  font-family: monospace;
  font-size: 12px;
  word-break: break-all;
}

.btn-copy {
  padding: 8px 16px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.btn-copy:hover {
  background: #5568d3;
}
</style>
