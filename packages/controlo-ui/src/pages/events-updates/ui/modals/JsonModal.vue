<template>
  <BaseModal :is-open="isOpen" title="JSON данные" max-width="900px" @close="close">
    <div class="info-url-wrapper">
      <div class="modal-url">{{ url }}</div>
      <button type="button" class="copy-url-btn" :data-url="url" @click="copyUrl($event)" title="Копировать URL">📋</button>
    </div>
    <div class="json-content-wrapper">
      <div class="json-viewer">{{ content }}</div>
      <button type="button" class="copy-json-btn" @click="copy($event)" title="Копировать JSON">📋</button>
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
  content: string;
}

defineProps<Props>();
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'copy', button: HTMLElement): void;
}>();

function close() {
  emit('close');
}

function copy(event: Event) {
  const button = (event?.currentTarget || event?.target) as HTMLElement;
  if (button) {
    emit('copy', button);
  }
}

function copyUrl(event: Event) {
  const button = event?.target as HTMLElement;
  copyUrlFromModal(button);
}
</script>

<style scoped>
.info-url-wrapper {
  position: relative;
  margin-bottom: 15px;
}

.modal-url {
  padding: 10px;
  padding-right: 35px;
  background: #f8f9fa;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
  word-break: break-all;
}

.copy-url-btn {
  position: absolute;
  top: 0;
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

.json-content-wrapper {
  position: relative;
}

.json-viewer {
  background: #f8f9fa;
  padding: 15px;
  padding-right: 35px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
  white-space: pre-wrap;
  word-wrap: break-word;
  max-height: 60vh;
  overflow-y: auto;
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
