<template>
  <BaseModal :is-open="isOpen" title="URL запроса" max-width="900px" @close="close">
    <div class="modal-url">{{ url }}</div>
    <template #footer>
      <BaseButton variant="primary" @click="copy">Скопировать URL</BaseButton>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { BaseModal, BaseButton } from '@/shared/ui';

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

</style>
