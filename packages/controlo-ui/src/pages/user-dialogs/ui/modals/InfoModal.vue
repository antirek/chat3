<template>
  <BaseModal :is-open="isOpen" :title="title" max-width="1200px" @close="close">
    <div class="info-content">
      <div v-if="url" class="url-section">
        <div class="url-section-wrapper">
          <div class="url-display">{{ url }}</div>
          <button type="button" class="copy-url-btn" :data-url="url" @click="copyUrl" title="Копировать URL">📋</button>
        </div>
      </div>
      
      <div v-if="jsonContent" class="json-section">
        <div class="json-content-wrapper">
          <pre class="json-content">{{ jsonContent }}</pre>
          <button type="button" class="copy-json-btn" @click="copyJson" title="Копировать JSON">📋</button>
        </div>
      </div>

      <div v-if="otherContent" class="other-content" v-html="otherContent"></div>
    </div>
    <template #footer>
      <BaseButton variant="secondary" @click="close">Закрыть</BaseButton>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { BaseModal, BaseButton } from '@/shared/ui';
import { copyJsonFromModal, copyUrlFromModal } from '@/shared/lib/utils/clipboard';

interface Props {
  isOpen: boolean;
  title: string;
  url?: string | null;
  jsonContent?: string | null;
  otherContent?: string | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

function close() { emit('close'); }

function copyJson(event?: Event) {
  const button = event?.target as HTMLElement;
  if (props.jsonContent) {
    copyJsonFromModal(props.jsonContent, button);
  }
}

function copyUrl(event: Event) {
  const button = event?.target as HTMLElement;
  copyUrlFromModal(button);
}
</script>

<style scoped>
.info-content h4 {
  margin: 15px 0 8px 0;
  color: #495057;
  font-size: 14px;
}

.info-content h4:first-child {
  margin-top: 0;
}

.url-section {
  margin-bottom: 20px;
}

.url-section-wrapper {
  position: relative;
}

.url-display {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  padding: 15px 15px;
  padding-right: 35px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  word-break: break-all;
}

.copy-url-btn {
  position: absolute;
  top: 8px;
  right: 20px;
  border: none;
  font-size: 16px;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 4px;
  background-color: #667eea;
  transition: background-color 0.2s;
  z-index: 10;
}

.copy-url-btn:hover {
  background: #5a6fd8;
}

.json-section {
  margin-bottom: 20px;
}

.json-content-wrapper {
  position: relative;
}

.json-content {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  padding: 15px;
  padding-right: 35px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow: auto;
  max-height: 60vh;
  margin: 0;
  display: block;
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

.other-content {
  margin-top: 20px;
}
</style>
