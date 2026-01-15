<template>
  <div class="messages-content">
    <div v-if="!hasDialog" class="placeholder">Выберите диалог</div>
    <div v-else-if="loading" class="loading">Загрузка сообщений...</div>
    <div v-else-if="error" class="error">Ошибка: {{ error }}</div>
    <div v-else-if="messages.length === 0" class="no-data">Сообщения не найдены</div>
    <table v-else>
      <thead>
        <tr>
          <th>Отправитель</th>
          <th>Время</th>
          <th>Содержимое</th>
          <th>Статус</th>
          <th>Инфо</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="message in messages"
          :key="message.messageId"
          :data-message-id="message.messageId"
          :style="message.context?.isMine ? 'background-color: #f0f8ff;' : ''"
        >
          <td>
            {{ message.senderId }}
            <span v-if="message.context?.isMine" style="color: #4fc3f7; margin-left: 5px;" title="Ваше сообщение">👤</span>
          </td>
          <td>{{ formatMessageTime(message.createdAt) }}</td>
          <td class="message-content">{{ message.content }}</td>
          <td>
            <span
              v-if="message.context?.isMine && getMessageStatus(message)"
              :style="{ color: getStatusColor(getMessageStatus(message)), fontWeight: 'bold' }"
              :title="getMessageStatus(message) || undefined"
            >
              {{ getStatusIcon(getMessageStatus(message)) }}
            </span>
            <span v-else style="color: #999;">-</span>
          </td>
          <td class="actions-column">
            <button class="info-button" @click="$emit('show-info', message.messageId)">ℹ️ Инфо</button>
            <button class="btn-success btn-small" @click="$emit('show-meta', message.messageId)">🏷️ Мета</button>
            <button class="action-button reactions-button" @click="$emit('show-reactions', message.messageId)">😊 Реакции</button>
            <button class="action-button events-button" @click="$emit('show-events', message.messageId)">📋 События</button>
            <button class="action-button status-matrix-button" @click="$emit('show-status-matrix', message.messageId)">📊 Матрица статусов</button>
            <button class="action-button statuses-button" @click="$emit('show-statuses', message.messageId)">📋 Статусы</button>
            <button class="action-button set-status-button" @click="$emit('show-set-status', message.messageId)">✏️ Установить статус</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
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
  overflow: visible;
}

.loading,
.error,
.no-data,
.placeholder {
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
