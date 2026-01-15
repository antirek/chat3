<template>
  <div class="panel-content" id="messagesList">
    <div v-if="!currentDialogId" class="placeholder">Выберите диалог</div>
    <div v-else-if="loading" class="loading">Загрузка сообщений...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else-if="messages.length === 0" class="no-data">Сообщения не найдены</div>
    <table v-else>
      <thead>
        <tr>
          <th>Отправитель</th>
          <th @click="toggleSort('createdAt')" style="cursor: pointer;">
            Время
            <span class="sort-indicator" :class="{ active: currentSort && currentSort.includes('createdAt') }">
              {{ getSortIndicator('createdAt') }}
            </span>
          </th>
          <th>Содержимое</th>
          <th>Тип</th>
          <th>Инфо</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="message in messages" :key="message.messageId">
          <td>{{ message.senderId }}</td>
          <td>{{ formatTimestamp(message.createdAt) }}</td>
          <td class="message-content">{{ message.content }}</td>
          <td>{{ message.type }}</td>
          <td>
            <button class="info-button" @click="showInfo(message)">
              ℹ️ Инфо
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
  senderId: string;
  createdAt?: string | number;
  content?: string;
  type?: string;
}

interface Props {
  messages: Message[];
  loading: boolean;
  error: string | null;
  currentDialogId: string | null;
  currentSort: string | null;
  getSortIndicator: (field: string) => string;
  toggleSort: (field: string) => void;
  formatTimestamp: (timestamp?: string | number) => string;
  showInfo: (message: Message) => void;
}

defineProps<Props>();
</script>

<style scoped>
.panel-content {
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
  padding: 10px 12px;
  text-align: left;
  font-weight: 600;
  color: #495057;
  font-size: 11px;
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
  padding: 10px 12px;
  border-bottom: 1px solid #e9ecef;
  font-size: 12px;
}

tr:hover {
  background: #f8f9fa;
}

.message-content {
  max-width: 100%;
  word-wrap: break-word;
  white-space: pre-wrap;
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
}

.info-button:hover {
  background: #7c8ff0;
  border-color: #7c8ff0;
}

.sort-indicator {
  margin-left: 5px;
  font-size: 10px;
  color: #667eea;
}

.sort-indicator.active {
  font-weight: bold;
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
</style>
