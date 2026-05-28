<template>
  <BaseModal :is-open="isOpen" title="🔗 URL запроса к API" max-width="800px" @close="close">
    <div class="url-info">
      <h4>API Endpoint:</h4>
      <div class="endpoint-wrapper">
        <div class="url-display">{{ generatedUrl }}</div>
        <button type="button" class="copy-endpoint-btn" @click="copyEndpoint" title="Копировать Endpoint">📋</button>
      </div>
      <h4>Параметры:</h4>
      <div class="params-list">
        <div><strong>page:</strong> {{ currentPage }}</div>
        <div><strong>limit:</strong> {{ currentLimit }}</div>
        <div v-if="currentFilter"><strong>filter:</strong> {{ currentFilter }}</div>
        <div v-if="currentSort"><strong>sort:</strong> {{ currentSort }}</div>
      </div>
      <h4>Полный URL для копирования:</h4>
      <div class="url-copy">
        <input
          type="text"
          :value="fullUrl"
          readonly
          @click="($event.target as HTMLInputElement).select()"
        />
      </div>
    </div>
    <template #footer>
      <BaseButton variant="primary" @click="copy">📋 Скопировать URL</BaseButton>
      <BaseButton variant="secondary" @click="close">Закрыть</BaseButton>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { BaseModal, BaseButton } from '@/shared/ui';
import { copyToClipboardWithFeedback } from '@/shared/lib/utils/clipboard';

interface Props {
  isOpen: boolean;
  generatedUrl: string;
  fullUrl: string;
  currentPage: number;
  currentLimit: number;
  currentFilter: string;
  currentSort: string | null;
  copyButtonText?: string;
}

const props = withDefaults(defineProps<Props>(), {
  copyButtonText: '📋 Скопировать URL',
});
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

function copyEndpoint(event: Event) {
  const button = (event?.currentTarget || event?.target) as HTMLElement;
  const { generatedUrl } = props;
  copyToClipboardWithFeedback(generatedUrl, button, '✅', 'Не удалось скопировать Endpoint');
}
</script>

<style scoped>
.url-info h4 {
  margin: 15px 0 8px 0;
  color: #333;
  font-size: 14px;
}

.url-info h4:first-child {
  margin-top: 0;
}

.endpoint-wrapper {
  position: relative;
  margin-bottom: 20px;
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

.copy-endpoint-btn {
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

.copy-endpoint-btn:hover {
  background: #5a6fd8;
}

.params-list {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  padding: 10px;
  font-size: 12px;
}

.params-list div {
  margin: 5px 0;
  font-family: 'Courier New', monospace;
  font-size: 12px;
}

.url-copy input {
  width: 100%;
  padding: 8px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  background: #fff;
}

</style>
