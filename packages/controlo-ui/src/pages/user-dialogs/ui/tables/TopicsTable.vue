<template>
  <div class="topics-content">
    <div v-if="loading" class="loading">Загрузка топиков...</div>
    <div v-else-if="error" class="error">Ошибка: {{ error }}</div>
    <div v-else-if="topics.length === 0" class="no-data">Топики не найдены</div>
    <table v-else>
      <thead>
        <tr>
          <th>Topic ID</th>
          <th>Unread</th>
          <th>Meta</th>
          <th>Действия</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="topic in topics" :key="topic.topicId">
          <td :title="topic.topicId">{{ shortenTopicId(topic.topicId) }}</td>
          <td style="text-align: center;">
            <span v-if="topic.unreadCount > 0" style="color: #dc3545; font-weight: bold;">{{ topic.unreadCount }}</span>
            <span v-else style="color: #6c757d;">0</span>
          </td>
          <td>
            <pre v-if="topic.meta && Object.keys(topic.meta).length > 0" style="margin: 0; font-size: 11px; max-width: 400px; overflow-x: auto; white-space: pre-wrap;">{{ JSON.stringify(topic.meta, null, 2) }}</pre>
            <span v-else style="color: #adb5bd;">—</span>
          </td>
          <td class="actions-column">
            <button class="btn-success btn-small" @click="$emit('show-meta', topic.topicId)">🏷️ Мета</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
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
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0;
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

.actions-column {
  white-space: nowrap;
}

.btn-success {
  padding: 4px 8px;
  font-size: 11px;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.btn-success:hover {
  background: #218838;
}
</style>
