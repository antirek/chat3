<template>
  <div class="content" id="usersList">
    <div v-if="loading" class="loading">Загрузка...</div>
    <div v-else-if="error" class="error">Ошибка загрузки: {{ error }}</div>
    <div v-else-if="users.length === 0" class="no-data">Пользователи не найдены</div>
    <table v-else>
      <thead>
        <tr>
          <th @click="toggleSort('userId')" style="cursor: pointer;">
            User ID
            <span class="sort-indicator">{{ getSortIndicator('userId') }}</span>
          </th>
          <th @click="toggleSort('type')" style="cursor: pointer;">
            Тип
            <span class="sort-indicator">{{ getSortIndicator('type') }}</span>
          </th>
          <th @click="toggleSort('createdAt')" style="cursor: pointer;">
            Создан
            <span class="sort-indicator">{{ getSortIndicator('createdAt') }}</span>
          </th>
          <th style="text-align: center; width: 80px;" title="Общее количество диалогов">💬 Диалоги</th>
          <th style="text-align: center; width: 80px;" title="Диалоги с непрочитанными сообщениями">🔔 Непрочитано</th>
          <th>Действия</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="user in users" :key="user.userId">
          <td><strong>{{ user.userId || '-' }}</strong></td>
          <td>
            <span style="background: #e3f2fd; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 500;">
              {{ user.type || 'user' }}
            </span>
          </td>
          <td>{{ formatTimestamp(user.createdAt) }}</td>
          <td style="text-align: center;">
            <span style="background: #f0f0f0; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; color: #495057;">
              {{ user.dialogCount !== undefined ? user.dialogCount : '-' }}
            </span>
          </td>
          <td style="text-align: center;">
            <span
              :style="{
                background: (user.unreadDialogsCount || 0) > 0 ? '#fff3cd' : '#f0f0f0',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: '600',
                color: (user.unreadDialogsCount || 0) > 0 ? '#856404' : '#495057',
              }"
            >
              {{ user.unreadDialogsCount !== undefined ? user.unreadDialogsCount : '-' }}
            </span>
          </td>
          <td>
            <button
              class="btn-primary btn-small"
              @click="showInfo(user.userId)"
            >
              ℹ️ Инфо
            </button>
            <button
              class="btn-success btn-small"
              @click="showMeta(user.userId)"
            >
              🏷️ Мета
            </button>
            <button
              class="btn-primary btn-small"
              @click="showEdit(user.userId)"
            >
              ✏️ Изменить Тип
            </button>
            <button
              class="btn-danger btn-small"
              @click="deleteUser(user.userId)"
            >
              🗑️ Удалить
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
interface User {
  userId: string;
  type?: string;
  createdAt?: string | number;
  dialogCount?: number;
  unreadDialogsCount?: number;
}

interface Props {
  users: User[];
  loading: boolean;
  error: string | null;
  getSortIndicator: (field: string) => string;
  formatTimestamp: (timestamp?: string | number) => string;
}

interface Emits {
  (e: 'toggle-sort', field: string): void;
  (e: 'show-info', userId: string): void;
  (e: 'show-meta', userId: string): void;
  (e: 'show-edit', userId: string): void;
  (e: 'delete', userId: string): void;
}

defineProps<Props>();
const emit = defineEmits<Emits>();

function toggleSort(field: string) {
  emit('toggle-sort', field);
}

function showInfo(userId: string) {
  emit('show-info', userId);
}

function showMeta(userId: string) {
  emit('show-meta', userId);
}

function showEdit(userId: string) {
  emit('show-edit', userId);
}

function deleteUser(userId: string) {
  emit('delete', userId);
}
</script>

<style scoped>
.content {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}

table {
  width: 100%;
  border-collapse: collapse;
}

thead {
  background: #f8f9fa;
  position: sticky;
  top: 0;
  z-index: 10;
}

th {
  padding: 12px 15px;
  text-align: left;
  font-weight: 600;
  color: #495057;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 2px solid #e9ecef;
  cursor: pointer;
  user-select: none;
}

th:hover {
  background: #e9ecef;
}

td {
  padding: 12px 15px;
  border-bottom: 1px solid #e9ecef;
  font-size: 13px;
}

tr:hover {
  background: #f8f9fa;
}

.no-data {
  text-align: center;
  padding: 40px;
  color: #6c757d;
  font-size: 14px;
}

.loading {
  text-align: center;
  padding: 40px;
  color: #667eea;
  font-size: 14px;
}

.error {
  background: #f8d7da;
  color: #721c24;
  padding: 15px;
  border-radius: 6px;
  margin: 15px;
  font-size: 13px;
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

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #667eea;
  color: white;
  border: none;
}

.btn-primary:hover:not(:disabled) {
  background: #5a6fd8;
}

.btn-success {
  background: #48bb78;
  color: white;
}

.btn-success:hover:not(:disabled) {
  background: #38a169;
}

.btn-danger {
  background: #dc3545;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #c82333;
}

.btn-small {
  padding: 4px 10px;
  font-size: 11px;
  margin-right: 5px;
}

.sort-indicator {
  margin-left: 5px;
  font-size: 10px;
  color: #667eea;
}
</style>
