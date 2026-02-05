<template>
  <div class="messages-content">
    <div v-if="!hasDialog" class="placeholder">Выберите диалог</div>
    <BaseTable
      v-else
      class="messages-table"
      :items="messages"
      :loading="loading"
      :error="error"
      :get-item-key="(item) => item.messageId"
      :get-row-class="(item) => item.context?.isMine ? 'message-row-mine' : ''"
      loading-text="Загрузка сообщений..."
      empty-text="Сообщения не найдены"
    >
      <template #header>
        <tr>
          <th v-if="showDialogColumn" style="text-align: center;">Диалог</th>
          <th style="text-align: center;">Отправитель</th>
          <th @click="toggleSort('createdAt')" style="cursor: pointer; text-align: center;">
            Время
            <span class="sort-indicator" :class="{ active: currentSort && currentSort.includes('createdAt') }">
              {{ getSortIndicator('createdAt') }}
            </span>
          </th>
          <th style="text-align: center;">Содержимое</th>
          <th style="text-align: center;">Статус</th>
          <th style="text-align: center;">Инфо</th>
        </tr>
      </template>
      <template #row="{ item }">
        <td v-if="showDialogColumn" :title="getMessageDialogId(item)" class="dialog-id-cell">
          {{ displayDialogId(item) }}
        </td>
        <td>
          {{ item.senderId }}
          <span v-if="item.context?.isMine" style="color: #4fc3f7; margin-left: 5px;" title="Ваше сообщение">👤</span>
        </td>
        <td :title="item.createdAt != null ? String(item.createdAt) : undefined">{{ formatTimestamp(item.createdAt) }}</td>
        <td class="message-content">{{ item.content }}</td>
        <td>
          <span
            v-if="item.context?.isMine && getMessageStatus(item)"
            :style="{ color: getStatusColor(getMessageStatus(item)), fontWeight: 'bold' }"
            :title="getMessageStatus(item) || undefined"
          >
            {{ getStatusIcon(getMessageStatus(item)) }}
          </span>
          <span v-else style="color: #999;">-</span>
        </td>
        <td class="actions-column">
          <BaseButton variant="primary" size="small" @click="$emit('show-info', item.messageId)">ℹ️ Инфо</BaseButton>
          <BaseButton variant="success" size="small" @click="$emit('show-meta', item.messageId)">🏷️ Мета</BaseButton>
          <BaseButton variant="reactions" size="small" @click="$emit('show-reactions', item.messageId)">😊 Реакции</BaseButton>
          <BaseButton variant="events" size="small" @click="$emit('show-events', item.messageId)">📋 События</BaseButton>
          <BaseButton variant="status-matrix" size="small" @click="$emit('show-status-matrix', item.messageId)">📊 Матрица статусов</BaseButton>
          <BaseButton variant="statuses" size="small" @click="$emit('show-statuses', item.messageId)">📋 Статусы</BaseButton>
          <BaseButton variant="set-status" size="small" @click="$emit('show-set-status', item.messageId)">✏️ Установить статус</BaseButton>
          <BaseButton variant="primary" size="small" @click="$emit('show-topic', item)">📌 Топик</BaseButton>
        </td>
      </template>
    </BaseTable>
  </div>
</template>

<script setup lang="ts">
import { BaseTable, BaseButton } from '@/shared/ui';
import { formatTimestamp } from '@/shared/lib/utils/date';

interface Message {
  messageId: string;
  senderId: string;
  content: string;
  createdAt: string | number;
  topicId?: string | null;
  dialogId?: string;
  sourceDialogId?: string;
  context?: {
    isMine?: boolean;
    status?: string;
  };
}

interface Props {
  messages: Message[];
  loading: boolean;
  error: string | null;
  hasDialog: boolean;
  currentSort: string | null;
  getSortIndicator: (field: string) => string;
  /** Показывать колонку «Диалог» (для сообщений пака) */
  showDialogColumn?: boolean;
  /** Функция сокращения dialogId для отображения */
  shortenDialogId?: (id: string) => string;
}

const props = withDefaults(defineProps<Props>(), {
  showDialogColumn: false
});

function getMessageDialogId(item: Message): string {
  return item.sourceDialogId || item.dialogId || '';
}

function displayDialogId(item: Message): string {
  const id = getMessageDialogId(item);
  if (!id) return '—';
  return props.shortenDialogId ? props.shortenDialogId(id) : (id.length <= 20 ? id : id.substring(0, 8) + '…' + id.slice(-8));
}

const emit = defineEmits<{
  (e: 'show-info', messageId: string): void;
  (e: 'show-meta', messageId: string): void;
  (e: 'show-reactions', messageId: string): void;
  (e: 'show-events', messageId: string): void;
  (e: 'show-status-matrix', messageId: string): void;
  (e: 'show-statuses', messageId: string): void;
  (e: 'show-set-status', messageId: string): void;
  (e: 'show-topic', message: Message): void;
  (e: 'toggle-sort', field: string): void;
}>();

function toggleSort(field: string) {
  emit('toggle-sort', field);
}

const formatMessageTime = formatTimestamp;

function getMessageStatus(message: Message): string | null {
  return message.context?.status || null;
}

function getStatusColor(status: string | null): string {
  if (!status) return '#999';
  switch (status) {
    case 'read': return '#28a745';
    case 'delivered': return '#17a2b8';
    case 'unread': return '#6c757d';
    default: return '#999';
  }
}

function getStatusIcon(status: string | null): string {
  if (!status) return '-';
  switch (status) {
    case 'read': return '✓✓';
    case 'delivered': return '✓';
    case 'unread': return '○';
    default: return '-';
  }
}
</script>

<style scoped>
.messages-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}


.placeholder {
  padding: 40px 20px;
  text-align: center;
  color: #6c757d;
}

:deep(.message-row-mine) {
  background-color: #f0f8ff;
}

.message-content {
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dialog-id-cell {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.actions-column {
  white-space: normal;
  min-width: 200px;
}

.sort-indicator {
  margin-left: 5px;
  font-size: 10px;
  color: #667eea;
}

.sort-indicator.active {
  font-weight: bold;
}

</style>
