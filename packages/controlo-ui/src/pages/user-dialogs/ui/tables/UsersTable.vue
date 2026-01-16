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
          <th>👤 User ID</th>
          <th title="Общее количество диалогов">💬 Диалоги</th>
          <th title="Диалоги с непрочитанными сообщениями">🔔 Непроч.</th>
          <th>⚡ Действия</th>
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
          <BaseButton variant="primary" size="small" @click="$emit('show-info', item.userId)">ℹ️ Инфо</BaseButton>
        </td>
      </template>
    </BaseTable>
  </div>
</template>

<script setup lang="ts">
import { BaseTable, BaseButton } from '@/shared/ui';

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
</style>
