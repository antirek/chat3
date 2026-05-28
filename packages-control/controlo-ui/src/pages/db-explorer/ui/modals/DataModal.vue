<template>
  <BaseModal :is-open="isOpen" title="Просмотр поля data" max-width="800px" @close="$emit('close')">
    <div class="json-content-wrapper">
      <pre class="json-viewer">{{ content }}</pre>
      <button type="button" class="copy-json-btn" @click="copy($event)" title="Копировать JSON">📋</button>
    </div>
    <template #footer>
      <BaseButton variant="secondary" @click="$emit('close')">Закрыть</BaseButton>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { BaseModal, BaseButton } from '@/shared/ui';
import { copyJsonFromModal } from '@/shared/lib/utils/clipboard';

interface Props { isOpen: boolean; content: string; }
const props = defineProps<Props>();
defineEmits<{ (e: 'close'): void; }>();

function copy(event: Event) {
  const button = (event?.currentTarget || event?.target) as HTMLElement;
  copyJsonFromModal(props.content, button);
}
</script>

<style scoped>
.json-content-wrapper {
  position: relative;
}

.json-viewer {
  background: #f8f9fa;
  padding: 15px;
  padding-right: 35px;
  border-radius: 6px;
  font-family: monospace;
  font-size: 12px;
  max-height: 400px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
}

.copy-json-btn {
  position: absolute;
  top: 15px;
  right: 20px;
  background: transparent;
  border: none;
  font-size: 16px;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 4px;
  background-color: #667eea;
  transition: background-color 0.2s;
  z-index: 10;
}

.copy-json-btn:hover {
  background: #5a6fd8;
}
</style>
