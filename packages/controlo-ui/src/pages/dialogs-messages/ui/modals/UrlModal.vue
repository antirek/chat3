<template>
  <BaseModal :is-open="isOpen" :title="title" max-width="800px" @close="close">
    <div class="url-info">
      <h4>API Endpoint:</h4>
      <div class="url-display">{{ endpoint }}</div>
      
      <h4>Параметры:</h4>
      <div class="params-list">
        <div v-for="(value, key) in params" :key="key">
          <strong>{{ key }}:</strong> {{ value }}
        </div>
      </div>
      
      <h4>Полный URL для копирования:</h4>
      <div class="url-copy">
        <input type="text" :value="url" readonly @click="($event.target as HTMLInputElement).select()" />
      </div>
    </div>
    <template #footer>
      <BaseButton variant="primary" @click="copy">{{ copyButtonText }}</BaseButton>
      <BaseButton variant="secondary" @click="close">Закрыть</BaseButton>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { BaseModal, BaseButton } from '@/shared/ui';

interface Props {
  isOpen: boolean;
  title: string;
  url: string;
  copyButtonText?: string;
}

const props = withDefaults(defineProps<Props>(), {
  copyButtonText: '📋 Скопировать URL',
});

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'copy'): void;
}>();

const endpoint = computed(() => {
  try {
    const urlObj = new URL(props.url);
    return urlObj.pathname + urlObj.search;
  } catch {
    return props.url;
  }
});

const params = computed(() => {
  try {
    const urlObj = new URL(props.url);
    const result: Record<string, string> = {};
    urlObj.searchParams.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  } catch {
    return {};
  }
});

function close() { emit('close'); }
function copy() { emit('copy'); }
</script>

<style scoped>
.url-info h4 {
  margin: 15px 0 8px 0;
  color: #495057;
  font-size: 14px;
}

.url-info h4:first-child {
  margin-top: 0;
}

.url-display {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  padding: 10px 15px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  word-break: break-all;
}

.params-list {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  padding: 10px 15px;
}

.params-list div {
  margin: 4px 0;
  font-size: 13px;
}

.params-list strong {
  color: #495057;
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
