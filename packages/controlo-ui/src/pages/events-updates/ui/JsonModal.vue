<template>
  <div v-if="isOpen" class="modal" @click.self="close">
    <div class="modal-content">
      <div class="modal-header">
        <div class="modal-title">JSON данные</div>
        <button class="modal-close" @click="close">×</button>
      </div>
      <div class="modal-body">
        <div class="modal-url" id="jsonModal-url">{{ url }}</div>
        <div class="json-viewer" id="jsonModal-content">{{ content }}</div>
        <button class="btn-copy" @click="copy">Скопировать JSON</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  isOpen: boolean;
  url: string;
  content: string;
}

interface Emits {
  (e: 'close'): void;
  (e: 'copy'): void;
}

defineProps<Props>();
const emit = defineEmits<Emits>();

function close() {
  emit('close');
}

function copy() {
  emit('copy');
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
  background-color: white;
  margin: 5% auto;
  padding: 0;
  border-radius: 8px;
  width: 80%;
  max-width: 900px;
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
  font-size: 18px;
  font-weight: 600;
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #6c757d;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-close:hover {
  color: #495057;
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.modal-url {
  padding: 10px;
  background: #f8f9fa;
  border-radius: 4px;
  margin-bottom: 15px;
  font-family: monospace;
  font-size: 12px;
  word-break: break-all;
}

.json-viewer {
  background: #f8f9fa;
  padding: 15px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
  white-space: pre-wrap;
  word-wrap: break-word;
  max-height: 60vh;
  overflow-y: auto;
}

.btn-copy {
  margin-top: 10px;
  padding: 8px 16px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.btn-copy:hover {
  background: #5568d3;
}
</style>
