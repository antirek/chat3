<template>
  <div class="topics-content">
    <BaseTable
      class="topics-table"
      :items="topics"
      :loading="loading"
      :error="error"
      :get-item-key="(item) => item.topicId"
      loading-text="Загрузка топиков..."
      empty-text="Топики не найдены"
    >
      <template #header>
        <tr>
          <th>Topic ID</th>
          <th>Unread</th>
          <th>Meta</th>
          <th>Действия</th>
        </tr>
      </template>
      <template #row="{ item }">
        <td :title="item.topicId">{{ shortenTopicId(item.topicId) }}</td>
        <td style="text-align: center;">
          <span v-if="item.unreadCount > 0" style="color: #dc3545; font-weight: bold;">{{ item.unreadCount }}</span>
          <span v-else style="color: #6c757d;">0</span>
        </td>
        <td>
          <pre v-if="item.meta && Object.keys(item.meta).length > 0" style="margin: 0; font-size: 11px; max-width: 400px; overflow-x: auto; white-space: pre-wrap;">{{ JSON.stringify(item.meta, null, 2) }}</pre>
          <span v-else style="color: #adb5bd;">—</span>
        </td>
        <td class="actions-column">
          <BaseButton variant="success" size="small" @click="$emit('show-meta', item.topicId)">🏷️ Мета</BaseButton>
        </td>
      </template>
    </BaseTable>
  </div>
</template>

<script setup lang="ts">
import { BaseTable, BaseButton } from '@/shared/ui';

interface Topic {
  topicId: string;
  unreadCount?: number;
  meta?: Record<string, any>;
}

interface Props {
  topics: Topic[];
  loading: boolean;
  error: string | null;
}

defineProps<Props>();
defineEmits<{
  (e: 'show-meta', topicId: string): void;
}>();

function shortenTopicId(topicId: string): string {
  if (!topicId) return '-';
  if (topicId.length <= 20) return topicId;
  return topicId.substring(0, 8) + '...' + topicId.substring(topicId.length - 8);
}
</script>

<style scoped>
.topics-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0;
  min-height: 0;
}

.actions-column {
  white-space: nowrap;
}

</style>
