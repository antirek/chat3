<template>
  <BaseModal :is-open="isOpen" title="🔗 URL запроса к API" max-width="800px" @close="close">
    <div class="url-display">{{ url }}</div>
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
.url-display {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  padding: 15px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  white-space: pre-wrap;
  word-wrap: break-word;
}

</style>
