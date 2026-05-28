<template>
  <BaseModal :is-open="isOpen" title="URL запроса" max-width="900px" @close="close">
    <div class="info-url-wrapper">
      <div class="modal-url">{{ url }}</div>
      <button type="button" class="copy-url-btn" :data-url="url" @click="copyUrl($event)" title="Копировать URL">📋</button>
    </div>
    <template #footer>
      <BaseButton variant="secondary" @click="close">Закрыть</BaseButton>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { BaseModal, BaseButton } from '@/shared/ui';
import { copyUrlFromModal } from '@/shared/lib/utils/clipboard';

interface Props {
  isOpen: boolean;
  url: string;
}

defineProps<Props>();
const emit = defineEmits<{
  (e: 'close'): void;
}>();

function close() {
  emit('close');
}

function copyUrl(event: Event) {
  const button = event?.target as HTMLElement;
  copyUrlFromModal(button);
}
</script>

<style scoped>
.info-url-wrapper {
  position: relative;
}

.modal-url {
  padding: 15px;
  padding-right: 35px;
  background: #f8f9fa;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
  word-break: break-all;
}

.copy-url-btn {
  position: absolute;
  top: 8px;
  right: 20px;
  background: transparent;
  border: none;
  font-size: 16px;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 4px;
  background-color: #667eea;
  transition: background-color 0.2s;
}

.copy-url-btn:hover {
  background: #5a6fd8;
}

</style>
