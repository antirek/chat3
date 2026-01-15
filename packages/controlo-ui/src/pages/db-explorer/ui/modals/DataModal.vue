<template>
  <BaseModal :is-open="isOpen" title="Просмотр поля data" max-width="800px" @close="$emit('close')">
    <pre class="json-viewer">{{ content }}</pre>
    <template #footer>
      <button type="button" class="btn-secondary" @click="$emit('close')">Закрыть</button>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { BaseModal } from '@/shared/ui';

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
.btn-secondary { padding: 8px 16px; background: #6c757d; color: white; border: none; border-radius: 6px; cursor: pointer; }
</style>
