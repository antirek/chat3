<template>
  <BaseModal :is-open="isOpen" :title="title" max-width="800px" @close="$emit('close')">
    <template v-if="mode === 'view'">
      <pre class="json-viewer">{{ content }}</pre>
    </template>
    <form v-else @submit.prevent="handleSubmit">
      <div class="form-group">
        <label>JSON данные:</label>
        <textarea v-model="jsonData" placeholder='{"field": "value"}'></textarea>
      </div>
    </form>
    <template #footer>
      <button type="button" class="btn-secondary" @click="$emit('close')">{{ mode === 'view' ? 'Закрыть' : 'Отмена' }}</button>
      <button v-if="mode !== 'view'" type="button" class="btn-primary" @click="handleSubmit">{{ mode === 'create' ? 'Создать' : 'Сохранить' }}</button>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { BaseModal } from '@/shared/ui';

interface Props { isOpen: boolean; mode: 'view' | 'edit' | 'create'; title: string; content: string; jsonData: string; }
const props = defineProps<Props>();
const emit = defineEmits<{ (e: 'close'): void; (e: 'submit', jsonData: string): void; }>();

const jsonData = ref(props.jsonData);
watch(() => props.jsonData, (val) => { jsonData.value = val; });

function handleSubmit() { emit('submit', jsonData.value); }
</script>

<style scoped>
.json-viewer { background: #f8f9fa; padding: 15px; border-radius: 6px; font-family: monospace; font-size: 12px; max-height: 400px; overflow-y: auto; white-space: pre-wrap; word-break: break-all; margin: 0; }
.form-group { margin-bottom: 15px; }
.form-group label { display: block; margin-bottom: 5px; font-weight: 500; color: #495057; }
.form-group textarea { width: 100%; padding: 8px 12px; border: 1px solid #ced4da; border-radius: 4px; font-size: 14px; min-height: 100px; font-family: monospace; }
.btn-primary { padding: 8px 16px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer; }
.btn-secondary { padding: 8px 16px; background: #6c757d; color: white; border: none; border-radius: 6px; cursor: pointer; }
</style>
