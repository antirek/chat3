<template>
  <div id="messagesList" class="messages-list-container">
    <BaseTable
      class="messages-table"
      :items="messages"
      :loading="loading"
      :error="error"
      loading-text="Загрузка..."
      empty-text="Сообщения не найдены"
      :get-item-key="(message) => message.messageId"
    >
      <template #header>
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
      </template>

      <template #row="{ item }">
        <td class="message-id">{{ (item as Message).messageId }}</td>
        <td>{{ getDialogName((item as Message).dialogId) }}</td>
        <td>{{ (item as Message).senderId }}</td>
        <td>{{ formatTimestamp((item as Message).createdAt) }}</td>
        <td class="message-content">{{ (item as Message).content }}</td>
        <td>{{ (item as Message).type }}</td>
        <td>
          <button class="info-button" @click="showInfo((item as Message).messageId)">
            ℹ️ Инфо
          </button>
          <button class="btn-success btn-small" @click="showMeta((item as Message).messageId)">
            🏷️ Мета
          </button>
        </td>
      </template>
    </BaseTable>
  </div>
</template>

<script setup lang="ts">
import { BaseTable } from '@/shared/ui';

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
.messages-list-container {
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

:deep(th[style*='cursor: pointer']) {
  cursor: pointer;
  user-select: none;
}

:deep(th[style*='cursor: pointer']:hover) {
  background: #e9ecef;
}

.sort-indicator {
  margin-left: 5px;
  font-size: 10px;
  color: #667eea;
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
</style>
