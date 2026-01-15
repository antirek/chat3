<template>
  <div v-if="isOpen" class="modal" @click.self="close">
    <div class="modal-content" style="max-width: 500px;" @click.stop>
      <div class="modal-header">
        <h2 class="modal-title">✏️ Установить статус сообщения</h2>
        <span class="close" @click="close">&times;</span>
      </div>
      <div class="modal-body">
        <div class="info-url" v-if="url" style="margin-bottom: 15px; padding: 8px; background: #f8f9fa; border-radius: 4px; font-family: monospace; font-size: 12px; word-break: break-all; color: #495057;">{{ url }}</div>
        <div style="margin-bottom: 20px;">
          <p style="color: #666; font-size: 14px; margin-bottom: 15px;">Выберите статус для текущего пользователя:</p>
          <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
            <button
              type="button"
              class="status-action-btn"
              @click="setStatus('unread')"
              style="background: #6c757d; color: white; padding: 12px 24px; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: bold; transition: all 0.2s;"
            >
              📤 Sent (unread)
            </button>
            <button
              type="button"
              class="status-action-btn"
              @click="setStatus('delivered')"
              style="background: #17a2b8; color: white; padding: 12px 24px; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: bold; transition: all 0.2s;"
            >
              📥 Received (delivered)
            </button>
            <button
              type="button"
              class="status-action-btn"
              @click="setStatus('read')"
              style="background: #28a745; color: white; padding: 12px 24px; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: bold; transition: all 0.2s;"
            >
              ✓ Read
            </button>
          </div>
        </div>
        <div v-if="result" style="margin-top: 20px; padding: 10px; border-radius: 4px; background: #d4edda; color: #155724; border: 1px solid #c3e6cb;">
          {{ result }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  isOpen: boolean;
  url?: string;
  result?: string;
}

interface Emits {
  (e: 'close'): void;
  (e: 'set-status', status: 'unread' | 'delivered' | 'read'): void;
}

defineProps<Props>();
const emit = defineEmits<Emits>();

function close() {
  emit('close');
}

function setStatus(status: 'unread' | 'delivered' | 'read') {
  emit('set-status', status);
}
</script>

<style scoped>
.modal {
  display: block;
  position: fixed;
  z-index: 1000;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
}

.modal-content {
  background-color: #fefefe;
  margin: 3% auto;
  padding: 0;
  border: none;
  border-radius: 8px;
  width: 90%;
  max-width: 1200px;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.modal-header {
  background: #f8f9fa;
  padding: 20px;
  border-bottom: 1px solid #e9ecef;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-title {
  margin: 0;
  color: #333;
  font-size: 18px;
}

.close {
  color: #aaa;
  font-size: 28px;
  font-weight: bold;
  cursor: pointer;
  line-height: 1;
}

.close:hover,
.close:focus {
  color: #000;
  text-decoration: none;
}

.modal-body {
  padding: 20px;
  max-height: calc(90vh - 100px);
  overflow-y: auto;
}

.status-action-btn:hover {
  opacity: 0.9;
  transform: scale(1.05);
}
</style>
