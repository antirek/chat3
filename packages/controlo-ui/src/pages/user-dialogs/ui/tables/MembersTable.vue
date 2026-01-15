<template>
  <div class="members-content">
    <div v-if="loading" class="loading">Загрузка участников...</div>
    <div v-else-if="error" class="error">Ошибка: {{ error }}</div>
    <div v-else-if="members.length === 0" class="no-data">Участников нет</div>
    <table v-else>
      <thead>
        <tr>
          <th>Пользователь</th>
          <th style="text-align: center;">Непрочитанные</th>
          <th style="text-align: center;">Активен</th>
          <th>Мета</th>
          <th style="text-align: center;">Действия</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="member in members" :key="member.userId">
          <td class="user-cell">{{ member.userId }}</td>
          <td style="text-align: center; color: #6c757d;">{{ member.unreadCount || 0 }}</td>
          <td style="text-align: center;">
            <span :style="{ color: member.isActive ? '#28a745' : '#dc3545' }">{{ member.isActive ? '✓' : '✗' }}</span>
          </td>
          <td class="meta-cell">
            <div v-if="member.meta && Object.keys(member.meta).length > 0">
              <div v-for="(value, key) in member.meta" :key="key">
                <strong>{{ key }}:</strong> {{ value }}
              </div>
            </div>
            <span v-else style="color: #adb5bd;">—</span>
          </td>
          <td style="text-align: center;">
            <button class="btn-success btn-small" @click="$emit('show-meta', member.userId)">🏷️ Мета</button>
            <button class="btn-danger btn-small" @click="$emit('remove', member.userId)">🗑️ Удалить</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
interface Member {
  userId: string;
  unreadCount?: number;
  isActive?: boolean;
  meta?: Record<string, any>;
}

interface Props {
  members: Member[];
  loading: boolean;
  error: string | null;
}

defineProps<Props>();
defineEmits<{
  (e: 'show-meta', userId: string): void;
  (e: 'remove', userId: string): void;
}>();
</script>

<style scoped>
.members-content {
  padding: 0;
  flex: 1;
  overflow-y: auto;
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
  padding: 8px;
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
  padding: 8px;
  border-bottom: 1px solid #e9ecef;
  font-size: 13px;
  color: #495057;
}

.user-cell {
  font-weight: 500;
}

.meta-cell {
  color: #6c757d;
  font-size: 12px;
}

.btn-success,
.btn-danger {
  padding: 4px 12px;
  font-size: 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin-right: 5px;
}

.btn-success {
  background: #28a745;
  color: white;
}

.btn-success:hover {
  background: #218838;
}

.btn-danger {
  background: #dc3545;
  color: white;
}

.btn-danger:hover {
  background: #c82333;
}
</style>
