<template>
  <div v-if="isOpen" class="modal" @click.self="close">
    <div class="modal-content" style="max-width: 500px;" @click.stop>
      <div class="modal-header">
        <h2 class="modal-title">Создать диалог</h2>
        <span class="close" @click="close">&times;</span>
      </div>
      <div class="modal-body">
        <div class="form-section">
          <label>👥 Участники диалога:</label>
          <div style="margin-top: 5px;">
            <button type="button" class="url-button" @click="loadUsers" style="margin-bottom: 10px;">
              🔄 Загрузить пользователей
            </button>
            <div v-if="loadingUsers" style="display: block; color: #6c757d; font-size: 12px;">Загрузка...</div>
            <div v-else-if="usersError" style="color: #dc3545; font-size: 12px;">{{ usersError }}</div>
            <div v-else-if="users.length === 0 && usersLoaded" class="no-data" style="padding: 20px;">
              Пользователи не найдены
            </div>
            <div v-else-if="users.length > 0" class="member-list" style="display: block;">
              <div v-for="user in users" :key="user.userId" class="member-item">
                <input
                  type="checkbox"
                  :id="`member_${user.userId}`"
                  :value="user.userId"
                  class="member-checkbox"
                  v-model="selectedMembers"
                />
                <label :for="`member_${user.userId}`">
                  <strong>{{ user.userName }}</strong>
                  <span style="color: #6c757d; font-size: 12px; margin-left: 5px;">({{ user.userId }})</span>
                  <span style="color: #6c757d; font-size: 11px; margin-left: 5px;">[{{ user.userType }}]</span>
                </label>
              </div>
            </div>
          </div>
        </div>
        <div class="form-actions" style="margin-top: 20px;">
          <button type="button" class="btn-primary" @click="create">✅ Создать диалог</button>
          <button type="button" class="url-button" @click="close" style="margin-left: 10px;">
            Отмена
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

interface User {
  userId: string;
  userName: string;
  userType: string;
}

interface Props {
  isOpen: boolean;
  users: User[];
  loadingUsers: boolean;
  usersError: string | null;
  usersLoaded: boolean;
  selectedMembers: string[];
}

interface Emits {
  (e: 'close'): void;
  (e: 'load-users'): void;
  (e: 'create'): void;
  (e: 'update:selectedMembers', value: string[]): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const selectedMembers = ref([...props.selectedMembers]);

watch(() => props.selectedMembers, (val) => {
  selectedMembers.value = [...val];
}, { deep: true });

watch(selectedMembers, (val) => {
  emit('update:selectedMembers', [...val]);
}, { deep: true });

function close() {
  emit('close');
}

function loadUsers() {
  emit('load-users');
}

function create() {
  emit('create');
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
  max-width: 500px;
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

.form-section {
  margin-bottom: 12px;
}

.form-section label {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 500;
  color: #495057;
}

.url-button {
  padding: 6px 12px;
  font-size: 12px;
  border: 1px solid #ced4da;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.url-button:hover {
  background: #e9ecef;
}

.form-actions {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.btn-primary {
  padding: 6px 12px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-primary:hover:not(:disabled) {
  background: #5a6fd8;
}

.no-data {
  text-align: center;
  padding: 20px;
  color: #6c757d;
  font-size: 14px;
}

.member-list {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  padding: 10px;
}

.member-item {
  display: flex;
  align-items: center;
  padding: 8px;
  border-bottom: 1px solid #f0f0f0;
}

.member-item:last-child {
  border-bottom: none;
}

.member-checkbox {
  margin-right: 10px;
  cursor: pointer;
}

.member-item label {
  cursor: pointer;
  flex: 1;
  margin: 0;
}
</style>
