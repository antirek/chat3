<template>
  <BaseModal :is-open="isOpen" title="Создать диалог" max-width="500px" @close="close">
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
    <template #footer>
      <button type="button" class="btn-primary" @click="create">✅ Создать диалог</button>
      <button type="button" class="btn-cancel" @click="close">Отмена</button>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { BaseModal } from '@/shared/ui';

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

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'load-users'): void;
  (e: 'create'): void;
  (e: 'update:selectedMembers', value: string[]): void;
}>();

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

.btn-cancel {
  padding: 6px 12px;
  font-size: 12px;
  border: 1px solid #ced4da;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-cancel:hover {
  background: #e9ecef;
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
