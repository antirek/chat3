<template>
  <div class="messages-content">
    <div v-if="!currentDialogId" class="placeholder">Выберите диалог</div>
    <BaseTable
      v-else
      class="messages-table"
      :items="messages"
      :loading="loading"
      :error="error"
      loading-text="Загрузка сообщений..."
      empty-text="Сообщения не найдены"
      :get-item-key="(message) => message.messageId"
    >
      <template #header>
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
      </template>

      <template #row="{ item }">
        <td>{{ (item as Message).senderId }}</td>
        <td>{{ formatTimestamp((item as Message).createdAt) }}</td>
        <td class="message-content">{{ (item as Message).content }}</td>
        <td>{{ (item as Message).type }}</td>
        <td>
          <button class="info-button" @click="showInfo(item as Message)">
            ℹ️ Инфо
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

:deep(th[style*='cursor: pointer']) {
  cursor: pointer;
  user-select: none;
}

:deep(th[style*='cursor: pointer']:hover) {
  background: #e9ecef;
}

.message-content {
  max-width: 100%;
  word-wrap: break-word;
  white-space: pre-wrap;
}

.sort-indicator {
  margin-left: 5px;
  font-size: 10px;
  color: #667eea;
}

.sort-indicator.active {
  font-weight: bold;
}

.placeholder {
  padding: 40px 20px;
  text-align: center;
  color: #6c757d;
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
</style>
