<template>
  <BaseModal :is-open="isOpen" title="🔗 URL запроса к API" max-width="800px" @close="close">
    <div class="url-info">
      <h4>API Endpoint:</h4>
      <div class="url-display">{{ generatedUrl }}</div>
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
        <BaseButton variant="success" @click="copy">{{ copyButtonText }}</BaseButton>
      </div>
    </div>
    <template #footer>
      <BaseButton variant="secondary" @click="close">Закрыть</BaseButton>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { BaseModal, BaseButton } from '@/shared/ui';

interface Props {
  isOpen: boolean;
  generatedUrl: string;
  fullUrl: string;
  currentPage: number;
  currentLimit: number;
  currentFilter: string;
  currentSort: string | null;
  copyButtonText: string;
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
.url-info h4 {
  margin: 15px 0 8px 0;
  color: #333;
  font-size: 14px;
}

.url-info h4:first-child {
  margin-top: 0;
}

.url-display {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  padding: 10px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  word-break: break-all;
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
  font-family: monospace;
  font-size: 12px;
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  margin-bottom: 8px;
}

</style>
