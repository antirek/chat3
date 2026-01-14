<template>
  <div v-if="isOpen" class="modal" @click.self="close">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h2 class="modal-title">{{ title }}</h2>
        <span class="close" @click="close">&times;</span>
      </div>
      <div class="modal-body" v-html="content"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  isOpen: boolean;
  title: string;
  content: string;
}

interface Emits {
  (e: 'close'): void;
}

defineProps<Props>();
const emit = defineEmits<Emits>();

function close() {
  emit('close');
}
</script>

<style scoped>
.modal {
  position: fixed;
  z-index: 1000;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-content {
  background-color: #fefefe;
  margin: 5% auto;
  padding: 20px;
  border: none;
  border-radius: 8px;
  width: 80%;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 1px solid #e9ecef;
}

.modal-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.close {
  font-size: 28px;
  font-weight: bold;
  color: #aaa;
  cursor: pointer;
  line-height: 1;
}

.close:hover {
  color: #000;
}

.modal-body {
  color: #333;
  font-size: 13px;
}
</style>

<style>
/* Стили для динамически вставляемого контента через v-html (не scoped) */
.json-content {
  background: #f8f9fa !important;
  border: 1px solid #e9ecef !important;
  border-radius: 4px !important;
  padding: 10px !important;
  font-family: 'Courier New', monospace !important;
  font-size: 12px !important;
  white-space: pre-wrap !important;
  overflow-x: auto !important;
  word-wrap: break-word !important;
}

.info-url {
  margin-bottom: 15px;
  padding: 8px;
  background: #f8f9fa;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
  word-break: break-all;
  color: #495057;
}

.url-info h4 {
  margin: 15px 0 8px 0;
  color: #333;
  font-size: 14px;
}

.url-display {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  padding: 10px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  word-break: break-all;
  margin-bottom: 10px;
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
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 4px;
}

.form-actions {
  display: flex !important;
  gap: 8px !important;
  margin-top: 12px !important;
}

.form-actions button {
  padding: 6px 12px !important;
  border: none !important;
  border-radius: 4px !important;
  cursor: pointer !important;
  font-size: 12px !important;
  font-weight: 500 !important;
  transition: all 0.2s !important;
}

.form-actions button:disabled {
  opacity: 0.5 !important;
  cursor: not-allowed !important;
}

.btn-primary {
  background: #667eea !important;
  color: white !important;
  border: none !important;
}

.btn-primary:hover:not(:disabled) {
  background: #5a6fd8 !important;
}

.btn-secondary {
  background: #6c757d !important;
  color: white !important;
  border: none !important;
}

.btn-secondary:hover:not(:disabled) {
  background: #5a6268 !important;
}
</style>
