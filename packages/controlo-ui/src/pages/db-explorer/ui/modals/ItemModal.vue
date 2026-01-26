<template>
  <BaseModal :is-open="isOpen" :title="title" max-width="800px" @close="$emit('close')">
    <template v-if="mode === 'view'">
      <div class="json-content-wrapper">
        <pre class="json-viewer">{{ content }}</pre>
        <button type="button" class="copy-json-btn" @click="copy($event)" title="Копировать JSON">📋</button>
      </div>
    </template>
    <form v-else @submit.prevent="handleSubmit">
      <div class="form-group">
        <label>JSON данные:</label>
        <textarea v-model="jsonData" placeholder='{"field": "value"}'></textarea>
      </div>
    </form>
    <template #footer>
      <BaseButton variant="secondary" @click="$emit('close')">{{ mode === 'view' ? 'Закрыть' : 'Отмена' }}</BaseButton>
      <BaseButton v-if="mode !== 'view'" variant="success" @click="handleSubmit">{{ mode === 'create' ? 'Создать' : 'Сохранить' }}</BaseButton>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { BaseModal, BaseButton } from '@/shared/ui';
import { copyJsonFromModal } from '@/shared/lib/utils/clipboard';

interface Props { isOpen: boolean; mode: 'view' | 'edit' | 'create'; title: string; content: string; jsonData: string; }
const props = defineProps<Props>();
const emit = defineEmits<{ (e: 'close'): void; (e: 'submit', jsonData: string): void; }>();

const jsonData = ref(props.jsonData);
watch(() => props.jsonData, (val) => { jsonData.value = val; });

function handleSubmit() { emit('submit', jsonData.value); }

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

.form-group { margin-bottom: 15px; }
.form-group label { display: block; margin-bottom: 5px; font-weight: 500; color: #495057; }
.form-group textarea { width: 100%; padding: 8px 12px; border: 1px solid #ced4da; border-radius: 4px; font-size: 14px; min-height: 100px; font-family: monospace; }
</style>
