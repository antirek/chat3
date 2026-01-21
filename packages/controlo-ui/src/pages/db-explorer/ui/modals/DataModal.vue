<template>
  <BaseModal :is-open="isOpen" title="Просмотр поля data" max-width="800px" @close="$emit('close')">
    <pre class="json-viewer">{{ content }}</pre>
    <template #footer>
      <BaseButton variant="secondary" @click="$emit('close')">Закрыть</BaseButton>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { BaseModal, BaseButton } from '@/shared/ui';

interface Props { isOpen: boolean; content: string; }
defineProps<Props>();
defineEmits<{ (e: 'close'): void; }>();
</script>

<style scoped>
.json-viewer {
  background: #f8f9fa;
  padding: 15px;
  border-radius: 6px;
  font-family: monospace;
  font-size: 12px;
  max-height: 400px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
}
</style>
