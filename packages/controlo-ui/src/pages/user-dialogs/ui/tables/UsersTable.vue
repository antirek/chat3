<template>
  <div class="panel-content">
    <BaseTable
      class="users-table"
      :items="users"
      :loading="loading"
      :error="error"
      :get-item-key="(item) => item.userId"
      :selectable="true"
      :selected-key="selectedUserId"
      :get-row-class="() => 'user-row'"
      loading-text="Загрузка пользователей..."
      empty-text="Пользователи не найдены"
      @row-click="handleRowClick"
    >
      <template #header>
        <tr>
          <th>User ID</th>
          <th style="text-align: center; width: 80px;" title="Общее количество диалогов">💬 Диалоги</th>
          <th style="text-align: center; width: 80px;" title="Диалоги с непрочитанными сообщениями">🔔 Непрочитано</th>
          <th>Действия</th>
        </tr>
      </template>
      <template #row="{ item }">
        <td>{{ item.userId }}</td>
        <td style="text-align: center;">
          <span style="background: #f0f0f0; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; color: #495057;">
            {{ item.dialogCount !== undefined ? item.dialogCount : '-' }}
          </span>
        </td>
        <td style="text-align: center;">
          <span :style="{
            background: item.unreadDialogsCount > 0 ? '#fff3cd' : '#f0f0f0',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: '600',
            color: item.unreadDialogsCount > 0 ? '#856404' : '#495057'
          }">
            {{ item.unreadDialogsCount !== undefined ? item.unreadDialogsCount : '-' }}
          </span>
        </td>
        <td class="actions-column" @click.stop>
          <button class="info-button" @click="$emit('show-info', item.userId)">ℹ️ Инфо</button>
        </td>
      </template>
    </BaseTable>
  </div>
</template>

<script setup lang="ts">
import { BaseTable } from '@/shared/ui';

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
const emit = defineEmits<{
  (e: 'select', userId: string, displayName: string): void;
  (e: 'show-info', userId: string): void;
}>();

function handleRowClick(item: User) {
  emit('select', item.userId, item.displayName || item.userId);
}
</script>

<style scoped>
.panel-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

:deep(.users-table.base-table-container) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
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
