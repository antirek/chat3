<template>
  <div v-if="isOpen" class="modal" @click.self="close">
    <div class="modal-content">
      <div class="modal-header">
        <h2 class="modal-title">{{ title }}</h2>
        <button class="modal-close" @click="close">×</button>
      </div>
      <div class="modal-body">
        <div v-if="mode === 'view'">
          <div class="json-viewer">{{ content }}</div>
          <div class="form-actions">
            <button type="button" class="btn btn-secondary" @click="close">Закрыть</button>
          </div>
        </div>
        <form v-else @submit.prevent="handleSubmit">
          <div class="form-group">
            <label>JSON данные:</label>
            <textarea v-model="jsonData" placeholder='{"field": "value"}'></textarea>
          </div>
          <div class="form-actions">
            <button type="button" class="btn btn-secondary" @click="close">Отмена</button>
            <button type="submit" class="btn btn-primary">{{ mode === 'create' ? 'Создать' : 'Сохранить' }}</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

interface Props {
  isOpen: boolean;
  mode: 'view' | 'edit' | 'create';
  title: string;
  content: string;
  jsonData: string;
}

interface Emits {
  (e: 'close'): void;
  (e: 'submit', jsonData: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const jsonData = ref(props.jsonData);

watch(() => props.jsonData, (val) => {
  jsonData.value = val;
});

function close() {
  emit('close');
}

function handleSubmit() {
  emit('submit', jsonData.value);
}
</script>

<style scoped>
.modal {
  display: flex;
  position: fixed;
  z-index: 1000;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  align-items: center;
  justify-content: center;
}

.modal-content {
  background-color: white;
  margin: 5% auto;
  padding: 0;
  border-radius: 8px;
  width: 80%;
  max-width: 800px;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  padding: 20px;
  border-bottom: 1px solid #e9ecef;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-title {
  font-size: 20px;
  font-weight: 600;
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #6c757d;
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: 500;
  color: #495057;
}

.form-group textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 14px;
  min-height: 100px;
  font-family: monospace;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-primary {
  background: #667eea;
  color: white;
}

.btn-primary:hover {
  background: #5568d3;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background: #5a6268;
}

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
}
</style>
