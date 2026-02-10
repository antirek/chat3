<template>
  <div id="usersList" class="users-list-container">
    <BaseTable
      class="users-table"
      :items="users"
      :loading="loading"
      :error="error"
      loading-text="Загрузка..."
      empty-text="Пользователи не найдены"
      :get-item-key="(user) => user.userId"
    >
    <template #header>
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
        <th title="Общее количество диалогов">Диалоги</th>
        <th title="Диалоги с непрочитанными сообщениями">Непрочитано</th>
        <th title="Действия">Действия</th>
      </tr>
    </template>

    <template #row="{ item }">
      <td><strong>{{ (item as User).userId || '-' }}</strong></td>
      <td>
        <span class="type-badge">
          {{ (item as User).type || 'user' }}
        </span>
      </td>
      <td :title="(item as User).createdAt != null ? String((item as User).createdAt) : undefined">{{ formatTimestamp((item as User).createdAt) }}</td>
      <td>
        <span class="dialog-count-badge">
          {{ (item as User).stats?.dialogCount ?? '-' }}
        </span>
      </td>
      <td>
        <span
          :class="['unread-count-badge', { 'has-unread': ((item as User).stats?.unreadDialogsCount ?? 0) > 0 }]"
        >
          {{ (item as User).stats?.unreadDialogsCount ?? '-' }}
        </span>
      </td>
      <td>
        <BaseButton
          variant="primary"
          size="small"
          @click="showInfo((item as User).userId)"
        >
          ℹ️ Инфо
        </BaseButton>
        <BaseButton
          variant="success"
          size="small"
          @click="showMeta((item as User).userId)"
        >
          🏷️ Мета
        </BaseButton>
        <BaseButton
          variant="primary"
          size="small"
          @click="showEdit((item as User).userId)"
        >
          ✏️ Изменить Тип
        </BaseButton>
        <BaseButton
          variant="danger"
          size="small"
          @click="deleteUser((item as User).userId)"
        >
          🗑️ Удалить
        </BaseButton>
      </td>
    </template>
    </BaseTable>
  </div>
</template>

<script setup lang="ts">
import { BaseTable, BaseButton } from '@/shared/ui';

interface User {
  userId: string;
  type?: string;
  createdAt?: string | number;
  stats?: {
    dialogCount?: number;
    unreadDialogsCount?: number;
  };
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
.users-list-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}



.sort-indicator {
  margin-left: 5px;
  font-size: 10px;
  color: #667eea;
}

.type-badge {
  background: #e3f2fd;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.dialog-count-badge {
  background: #f0f0f0;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  color: #495057;
}

.unread-count-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  background: #f0f0f0;
  color: #495057;
}

.unread-count-badge.has-unread {
  background: #fff3cd;
  color: #856404;
}

</style>
