<template>
  <div class="panel-content">
    <BaseTable
      class="topics-table"
      :items="topics"
      :loading="loading"
      :error="error"
      loading-text="Загрузка топиков..."
      empty-text="Топики не найдены"
      :get-item-key="(item) => item.topicId"
      :selectable="true"
      :selected-key="selectedTopicKey"
      :get-row-class="() => 'topic-row'"
      @row-click="handleRowClick"
    >
      <template #header>
        <tr>
          <th>Topic ID</th>
          <th>Dialog ID</th>
          <th>Действия</th>
        </tr>
      </template>

      <template #row="{ item }">
        <td :title="(item as Topic).topicId">{{ shortenId((item as Topic).topicId) }}</td>
        <td :title="(item as Topic).dialogId">{{ shortenId((item as Topic).dialogId) }}</td>
        <td>
          <BaseButton variant="primary" size="small" @click.stop="showMeta(item as Topic)" title="Мета-теги">
            🏷️ Мета
          </BaseButton>
          <BaseButton variant="primary" size="small" @click.stop="showInfo(item as Topic)" title="JSON топика">
            ℹ️ Инфо
          </BaseButton>
        </td>
      </template>
    </BaseTable>
  </div>
</template>

<script setup lang="ts">
import { BaseTable, BaseButton } from '@/shared/ui';

interface Topic {
  topicId: string;
  dialogId: string;
  meta?: Record<string, unknown>;
  createdAt?: number;
}

interface Props {
  topics: Topic[];
  loading: boolean;
  error: string | null;
  selectedTopicId: string | null;
  selectedTopicKey: string | null;
}

interface Emits {
  (e: 'select-topic', topic: Topic): void;
  (e: 'show-info', topic: Topic): void;
  (e: 'show-meta', topic: Topic): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

function shortenId(id: string): string {
  if (!id) return '—';
  if (id.length <= 16) return id;
  return id.slice(0, 8) + '…' + id.slice(-8);
}

function handleRowClick(topic: Topic) {
  emit('select-topic', topic);
}

function showInfo(topic: Topic) {
  emit('show-info', topic);
}

function showMeta(topic: Topic) {
  emit('show-meta', topic);
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
</style>
