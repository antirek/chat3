<template>
  <div class="content" id="messagesList">
    <div v-if="loading" class="loading">Загрузка...</div>
    <div v-else-if="error" class="error">Ошибка загрузки: {{ error }}</div>
    <div v-else-if="messages.length === 0" class="no-data">Сообщения не найдены</div>
    <table v-else>
      <thead>
        <tr>
          <th>ID сообщения</th>
          <th>Диалог</th>
          <th>Отправитель</th>
          <th @click="toggleSort('createdAt')" style="cursor: pointer;">
            Время
            <span class="sort-indicator">{{ getSortIndicator('createdAt') }}</span>
          </th>
          <th>Содержимое</th>
          <th>Тип</th>
          <th>Действия</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="message in messages" :key="message.messageId">
          <td class="message-id">{{ message.messageId }}</td>
          <td>{{ getDialogName(message.dialogId) }}</td>
          <td>{{ message.senderId }}</td>
          <td>{{ formatTimestamp(message.createdAt) }}</td>
          <td class="message-content">{{ message.content }}</td>
          <td>{{ message.type }}</td>
          <td>
            <button class="info-button" @click="showInfo(message.messageId)">
              ℹ️ Инфо
            </button>
            <button class="btn-success btn-small" @click="showMeta(message.messageId)">
              🏷️ Мета
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
interface Message {
  messageId: string;
  dialogId: string;
  senderId: string;
  createdAt?: string | number;
  content?: string;
  type?: string;
}

interface Props {
  messages: Message[];
  loading: boolean;
  error: string | null;
  getSortIndicator: (field: string) => string;
  toggleSort: (field: string) => void;
  formatTimestamp: (timestamp?: string | number) => string;
  getDialogName: (dialogId: string) => string;
  showInfo: (messageId: string) => void;
  showMeta: (messageId: string) => void;
}

defineProps<Props>();
</script>

<style scoped>
.content {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}

table {
  width: 100%;
  border-collapse: collapse;
}

thead {
  background: #f8f9fa;
  position: sticky;
  top: 0;
  z-index: 10;
}

th {
  padding: 12px 15px;
  text-align: left;
  font-weight: 600;
  color: #495057;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 2px solid #e9ecef;
}

th[style*='cursor: pointer'] {
  cursor: pointer;
  user-select: none;
}

th[style*='cursor: pointer']:hover {
  background: #e9ecef;
}

td {
  padding: 12px 15px;
  border-bottom: 1px solid #e9ecef;
  font-size: 13px;
}

tr:hover {
  background: #f8f9fa;
}

.no-data {
  text-align: center;
  padding: 40px;
  color: #6c757d;
  font-size: 14px;
}

.loading {
  text-align: center;
  padding: 40px;
  color: #667eea;
  font-size: 14px;
}

.error {
  background: #f8d7da;
  color: #721c24;
  padding: 15px;
  border-radius: 6px;
  margin: 15px;
  font-size: 13px;
}

.message-content {
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.message-id {
  font-size: 13px;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #666;
}

.info-button {
  padding: 4px 10px;
  font-size: 11px;
  border: 1px solid #8ba0f5;
  background: #8ba0f5;
  color: white;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s;
  max-height: 25px;
  min-width: 69px;
  margin-right: 6px;
}

.info-button:hover {
  background: #7c8ff0;
  border-color: #7c8ff0;
}

button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-success {
  background: #48bb78;
  color: white;
}

.btn-success:hover:not(:disabled) {
  background: #38a169;
}

.btn-small {
  padding: 4px 10px;
  font-size: 11px;
}

.sort-indicator {
  margin-left: 5px;
  font-size: 10px;
  color: #667eea;
}
</style>
