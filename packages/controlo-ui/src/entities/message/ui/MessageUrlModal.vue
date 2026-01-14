<template>
  <div v-if="isOpen" class="modal" @click.self="close">
    <div class="modal-content" style="max-width: 800px;" @click.stop>
      <div class="modal-header">
        <h2>🔗 URL запроса к API</h2>
        <button class="modal-close" @click="close" title="Закрыть">×</button>
      </div>
      <div class="modal-body">
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
              style="width: 100%; padding: 8px; font-family: monospace; font-size: 12px;"
            />
            <button
              @click="copy"
              style="margin-top: 8px; padding: 6px 12px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;"
            >
              {{ copyButtonText }}
            </button>
          </div>
        </div>
        <div class="form-actions" style="margin-top: 15px;">
          <button type="button" class="btn-secondary" @click="close">Закрыть</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
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
  background: rgba(0, 0, 0, 0.5);
  animation: fadeIn 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.modal-content {
  background: white;
  margin: 50px auto;
  padding: 0;
  border-radius: 8px;
  width: 90%;
  max-width: 800px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  animation: slideIn 0.3s;
}

@keyframes slideIn {
  from {
    transform: translateY(-30px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.modal-header {
  padding: 15px 20px;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
  border-radius: 8px 8px 0 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h2 {
  font-size: 16px;
  margin: 0;
  color: #333;
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  color: #6c757d;
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.modal-close:hover {
  background: #e9ecef;
  color: #333;
}

.modal-body {
  padding: 20px;
}

.form-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 15px;
}

button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary {
  background: #6c757d;
  color: white;
  border: none;
}

.btn-secondary:hover:not(:disabled) {
  background: #5a6268;
}

.url-info {
  margin-bottom: 15px;
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
  margin-bottom: 10px;
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
  margin-bottom: 8px;
}
</style>
