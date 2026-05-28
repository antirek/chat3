<template>
  <div class="topics-content">
    <div v-if="!currentDialogId" class="placeholder">Выберите диалог</div>
    <BaseTable
      v-else
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
          <th>Meta</th>
        </tr>
      </template>
      <template #row="{ item }">
        <td :title="item.topicId">{{ shortenTopicId(item.topicId) }}</td>
        <td>
          <pre v-if="item.meta && Object.keys(item.meta).length > 0" class="meta-pre">{{ JSON.stringify(item.meta, null, 2) }}</pre>
          <span v-else style="color: #adb5bd;">—</span>
        </td>
      </template>
    </BaseTable>
  </div>
</template>

<script setup lang="ts">
import { BaseTable } from '@/shared/ui';

interface Topic {
  topicId: string;
  meta?: Record<string, unknown>;
}

defineProps<{
  topics: Topic[];
  loading: boolean;
  error: string | null;
  currentDialogId: string | null;
}>();

function shortenTopicId(topicId: string): string {
  if (!topicId) return '-';
  if (topicId.length <= 20) return topicId;
  return topicId.substring(0, 8) + '...' + topicId.substring(topicId.length - 8);
}
</script>

<style scoped>
.topics-content {
  padding: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

.placeholder {
  padding: 20px;
  color: #6c757d;
  text-align: center;
}

.meta-pre {
  margin: 0;
  font-size: 11px;
  max-width: 400px;
  overflow-x: auto;
  white-space: pre-wrap;
}
</style>
