<template>
  <BaseModal :is-open="isOpen" title="🔗 URL запроса к API" max-width="800px" @close="close">
    <div class="url-display">{{ url }}</div>
    <template #footer>
      <button type="button" class="btn-primary" @click="copy">{{ copyButtonText }}</button>
      <button type="button" class="btn-secondary" @click="close">Закрыть</button>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { BaseModal } from '@/shared/ui';

interface Props {
  isOpen: boolean;
  url: string;
  copyButtonText: string;
}

defineProps<Props>();
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'copy'): void;
}>();

function close() { emit('close'); }
function copy() { emit('copy'); }
</script>

<style scoped>
.url-display { background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 4px; padding: 15px; font-family: 'Courier New', monospace; font-size: 12px; white-space: pre-wrap; word-wrap: break-word; }
.btn-primary { padding: 8px 16px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: 500; }
.btn-primary:hover { background: #5a6fd8; }
.btn-secondary { padding: 8px 16px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: 500; }
.btn-secondary:hover { background: #5a6268; }
</style>
