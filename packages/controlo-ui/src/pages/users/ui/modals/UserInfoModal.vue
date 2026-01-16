<template>
  <BaseModal :is-open="isOpen" title="📋 Информация о пользователе" max-width="800px" @close="close">
    <div class="info-url">{{ url }}</div>
    <div class="json-viewer">{{ content }}</div>
    <template #footer>
      <BaseButton variant="primary" @click="copy">{{ copyButtonText }}</BaseButton>
      <BaseButton variant="secondary" @click="close">Закрыть</BaseButton>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { BaseModal, BaseButton } from '@/shared/ui';

interface Props {
  isOpen: boolean;
  url: string;
  content: string;
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
.info-url { margin-bottom: 15px; padding: 8px; background: #f8f9fa; border-radius: 4px; font-family: monospace; font-size: 12px; word-break: break-all; color: #495057; }
.json-viewer { background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 4px; padding: 15px; max-height: 500px; overflow-y: auto; font-family: 'Courier New', monospace; font-size: 12px; white-space: pre-wrap; word-wrap: break-word; }
</style>
