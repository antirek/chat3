<template>
  <div class="members-content">
    <BaseTable
      class="members-table"
      :items="members"
      :loading="loading"
      :error="error"
      :get-item-key="(item) => item.userId"
      loading-text="Загрузка участников..."
      empty-text="Участников нет"
    >
      <template #header>
        <tr>
          <th>Пользователь</th>
          <th style="text-align: center;">Непрочитанные</th>
          <th style="text-align: center;">Активен</th>
          <th>Мета</th>
          <th style="text-align: center;">Действия</th>
        </tr>
      </template>
      <template #row="{ item }">
        <td class="user-cell">{{ item.userId }}</td>
        <td style="text-align: center; color: #6c757d;">{{ item.unreadCount || 0 }}</td>
        <td style="text-align: center;">
          <span :style="{ color: item.isActive ? '#28a745' : '#dc3545' }">{{ item.isActive ? '✓' : '✗' }}</span>
        </td>
        <td class="meta-cell">
          <div v-if="item.meta && Object.keys(item.meta).length > 0">
            <div v-for="(value, key) in item.meta" :key="key">
              <strong>{{ key }}:</strong> {{ value }}
            </div>
          </div>
          <span v-else style="color: #adb5bd;">—</span>
        </td>
        <td style="text-align: center;">
          <BaseButton variant="success" size="small" @click="$emit('show-meta', item.userId)">🏷️ Мета</BaseButton>
          <BaseButton variant="danger" size="small" @click="$emit('remove', item.userId)">🗑️ Удалить</BaseButton>
        </td>
      </template>
    </BaseTable>
  </div>
</template>

<script setup lang="ts">
import { BaseTable, BaseButton } from '@/shared/ui';

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
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}


.user-cell {
  font-weight: 500;
}

.meta-cell {
  color: #6c757d;
  font-size: 12px;
}

</style>
