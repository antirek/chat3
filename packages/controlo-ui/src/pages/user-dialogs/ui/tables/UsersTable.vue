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
          <th class="user-id-column">👤 User ID</th>
          <th title="Всего / Непрочитанные">💬 Диалоги</th>
          <th title="Всего / Непрочитанные">💬 Сообщения</th>
          <th>⚡ Действия</th>
        </tr>
      </template>
      <template #row="{ item }">
        <td class="user-id-column" :title="item.userId">{{ item.userId }}</td>
        <td style="text-align: center;">
          <span :style="{
            background: (item.stats?.unreadDialogsCount || 0) > 0 ? '#fff3cd' : '#f0f0f0',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: '600',
            color: (item.stats?.unreadDialogsCount || 0) > 0 ? '#856404' : '#495057'
          }">
            {{ formatCount(item.stats?.dialogCount, item.stats?.unreadDialogsCount) }}
          </span>
        </td>
        <td style="text-align: center;">
          <span :style="{
            background: (item.stats?.totalUnreadCount || 0) > 0 ? '#fff3cd' : '#f0f0f0',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: '600',
            color: (item.stats?.totalUnreadCount || 0) > 0 ? '#856404' : '#495057'
          }">
            {{ formatCount(item.stats?.totalMessagesCount, item.stats?.totalUnreadCount) }}
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
  stats?: {
    dialogCount?: number;
    unreadDialogsCount?: number;
    totalMessagesCount?: number;
    totalUnreadCount?: number;
  };
}

function formatCount(total: number | undefined, unread: number | undefined): string {
  const totalValue = total !== undefined ? total : 0;
  const unreadValue = unread !== undefined ? unread : 0;
  return `${totalValue}/${unreadValue}`;
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
:deep(.user-id-column) {
  width: 120px;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
