<template>
  <div v-if="isOpen" class="modal" @click.self="close">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h2>Создать пользователя</h2>
        <button class="modal-close" @click="close" title="Закрыть">×</button>
      </div>
      <div class="modal-body">
        <form @submit.prevent="handleSubmit">
          <div class="form-group">
            <label for="createUserId">User ID *</label>
            <input
              type="text"
              id="createUserId"
              v-model="userId"
              required
              placeholder="john"
            />
          </div>
          <div class="form-group">
            <label for="createType">Тип</label>
            <select id="createType" v-model="type">
              <option value="user">user</option>
              <option value="bot">bot</option>
              <option value="contact">contact</option>
              <option value="agent">agent</option>
            </select>
          </div>
          <div class="form-actions">
            <button type="button" class="btn-secondary" @click="close">Отмена</button>
            <button type="submit" class="btn-success">Создать</button>
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
  userId: string;
  type: string;
}

interface Emits {
  (e: 'close'): void;
  (e: 'submit'): void;
  (e: 'update:userId', value: string): void;
  (e: 'update:type', value: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const userId = ref(props.userId);
const type = ref(props.type);

watch(() => props.userId, (val) => {
  userId.value = val;
});

watch(() => props.type, (val) => {
  type.value = val;
});

watch(userId, (val) => {
  emit('update:userId', val);
});

watch(type, (val) => {
  emit('update:type', val);
});

function close() {
  emit('close');
}

function handleSubmit() {
  emit('submit');
}
</script>

<style scoped>
/* Modal */
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
  max-width: 600px;
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

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  color: #495057;
  font-size: 13px;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 13px;
}

.form-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 20px;
}

.form-actions button {
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
}

.btn-success {
  background: #48bb78;
  color: white;
}

.btn-success:hover:not(:disabled) {
  background: #38a169;
}

.btn-secondary {
  background: #6c757d;
  color: white;
  border: none;
}

.btn-secondary:hover:not(:disabled) {
  background: #5a6268;
}
</style>
