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
          <th>Отправитель</th>
          <th>Время</th>
          <th>Содержимое</th>
          <th>Статус</th>
          <th>Инфо</th>
        </tr>
      </template>
      <template #row="{ item }">
        <td>
          {{ item.senderId }}
          <span v-if="item.context?.isMine" style="color: #4fc3f7; margin-left: 5px;" title="Ваше сообщение">👤</span>
        </td>
        <td>{{ formatMessageTime(item.createdAt) }}</td>
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
          <button class="info-button" @click="$emit('show-info', item.messageId)">ℹ️ Инфо</button>
          <button class="btn-success btn-small" @click="$emit('show-meta', item.messageId)">🏷️ Мета</button>
          <button class="action-button reactions-button" @click="$emit('show-reactions', item.messageId)">😊 Реакции</button>
          <button class="action-button events-button" @click="$emit('show-events', item.messageId)">📋 События</button>
          <button class="action-button status-matrix-button" @click="$emit('show-status-matrix', item.messageId)">📊 Матрица статусов</button>
          <button class="action-button statuses-button" @click="$emit('show-statuses', item.messageId)">📋 Статусы</button>
          <button class="action-button set-status-button" @click="$emit('show-set-status', item.messageId)">✏️ Установить статус</button>
        </td>
      </template>
    </BaseTable>
  </div>
</template>

<script setup lang="ts">
import { BaseTable } from '@/shared/ui';

interface Message {
  messageId: string;
  senderId: string;
  content: string;
  createdAt: string | number;
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
}

defineProps<Props>();
defineEmits<{
  (e: 'show-info', messageId: string): void;
  (e: 'show-meta', messageId: string): void;
  (e: 'show-reactions', messageId: string): void;
  (e: 'show-events', messageId: string): void;
  (e: 'show-status-matrix', messageId: string): void;
  (e: 'show-statuses', messageId: string): void;
  (e: 'show-set-status', messageId: string): void;
}>();

function formatMessageTime(createdAt: string | number): string {
  if (!createdAt) return '-';
  try {
    const date = new Date(createdAt);
    return date.toLocaleString('ru-RU');
  } catch {
    return '-';
  }
}

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

:deep(.messages-table.base-table-container) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
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

.actions-column {
  white-space: normal;
  min-width: 200px;
}

.info-button,
.action-button,
.btn-success {
  padding: 3px 6px;
  font-size: 10px;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  margin: 1px;
  display: inline-block;
}

.info-button {
  background: #667eea;
  color: white;
}

.info-button:hover {
  background: #5568d3;
}

.btn-success {
  background: #28a745;
  color: white;
}

.btn-success:hover {
  background: #218838;
}

.reactions-button {
  background: #ffc107;
  color: #212529;
}

.reactions-button:hover {
  background: #e0a800;
}

.events-button {
  background: #17a2b8;
  color: white;
}

.events-button:hover {
  background: #138496;
}

.status-matrix-button {
  background: #6f42c1;
  color: white;
}

.status-matrix-button:hover {
  background: #5a32a3;
}

.statuses-button {
  background: #20c997;
  color: white;
}

.statuses-button:hover {
  background: #1aa179;
}

.set-status-button {
  background: #fd7e14;
  color: white;
}

.set-status-button:hover {
  background: #e96b02;
}
</style>
