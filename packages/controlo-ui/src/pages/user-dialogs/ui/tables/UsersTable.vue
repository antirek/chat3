<template>
  <div class="panel-content">
    <div v-if="loading" class="loading">Загрузка пользователей...</div>
    <div v-else-if="error" class="error">Ошибка: {{ error }}</div>
    <div v-else-if="users.length === 0" class="no-data">Пользователи не найдены</div>
    <table v-else>
      <thead>
        <tr>
          <th>User ID</th>
          <th style="text-align: center; width: 80px;" title="Общее количество диалогов">💬 Диалоги</th>
          <th style="text-align: center; width: 80px;" title="Диалоги с непрочитанными сообщениями">🔔 Непрочитано</th>
          <th>Действия</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="user in users"
          :key="user.userId"
          @click="$emit('select', user.userId, user.displayName || user.userId)"
          :class="['user-row', { 'user-row-selected': selectedUserId === user.userId }]"
          :data-user-id="user.userId"
          :title="`Диалогов: ${user.dialogCount || 0}, Непрочитано: ${user.unreadDialogsCount || 0}`"
          style="cursor: pointer;"
        >
          <td>{{ user.userId }}</td>
          <td style="text-align: center;">
            <span style="background: #f0f0f0; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; color: #495057;">
              {{ user.dialogCount !== undefined ? user.dialogCount : '-' }}
            </span>
          </td>
          <td style="text-align: center;">
            <span :style="{
              background: user.unreadDialogsCount > 0 ? '#fff3cd' : '#f0f0f0',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: '600',
              color: user.unreadDialogsCount > 0 ? '#856404' : '#495057'
            }">
              {{ user.unreadDialogsCount !== undefined ? user.unreadDialogsCount : '-' }}
            </span>
          </td>
          <td class="actions-column" @click.stop>
            <button class="info-button" @click="$emit('show-info', user.userId)">ℹ️ Инфо</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
interface User {
  userId: string;
  displayName?: string;
  dialogCount?: number;
  unreadDialogsCount?: number;
}

interface Props {
  users: User[];
  loading: boolean;
  error: string | null;
  selectedUserId: string | null;
}

defineProps<Props>();
defineEmits<{
  (e: 'select', userId: string, displayName: string): void;
  (e: 'show-info', userId: string): void;
}>();
</script>

<style scoped>
.panel-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

.loading,
.error,
.no-data {
  padding: 40px 20px;
  text-align: center;
  color: #6c757d;
}

.error {
  color: #dc3545;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th {
  text-align: left;
  padding: 12px 15px;
  background: #f8f9fa;
  border-bottom: 2px solid #dee2e6;
  font-weight: 600;
  color: #495057;
  font-size: 12px;
  position: sticky;
  top: 0;
  z-index: 1;
}

td {
  padding: 10px 15px;
  border-bottom: 1px solid #e9ecef;
  font-size: 13px;
  color: #495057;
}

.user-row:hover {
  background: #f8f9fa;
}

.user-row-selected {
  background: #e3f2fd !important;
}

.actions-column {
  padding: 0;
  font-size: 0;
}

.info-button {
  padding: 4px 6px;
  font-size: 11px;
  border: 1px solid #7c8ff0;
  background: #7c8ff0;
  color: white;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s;
  max-height: 25px;
}

.info-button:hover {
  background: #6d7ee0;
  border-color: #6d7ee0;
}
</style>
