<template>
  <div class="pack-messages-table">
    <BaseTable
      :items="messages"
      :loading="loading"
      :error="error"
      loading-text="Загрузка сообщений..."
      empty-text="В паке пока нет сообщений."
      :get-item-key="(msg) => (msg as PackMessage).messageId"
    >
      <template #header>
        <tr>
          <th>Dialog ID</th>
          <th>Message</th>
          <th>Sender</th>
          <th>Создан</th>
        </tr>
      </template>

      <template #row="{ item }">
        <td class="cell-dialog"><code>{{ (item as PackMessage).sourceDialogId || (item as PackMessage).dialogId }}</code></td>
        <td class="cell-message">
          <span class="message-type" v-if="(item as PackMessage).type">{{ (item as PackMessage).type }}</span>
          <span class="message-content">{{ summarizeContent(item as PackMessage) }}</span>
        </td>
        <td class="cell-sender">
          <span>{{ renderSender(item as PackMessage) }}</span>
        </td>
        <td class="cell-created">
          <span :title="String((item as PackMessage).createdAt)">{{ formatTimestamp((item as PackMessage).createdAt) }}</span>
        </td>
      </template>
    </BaseTable>
  </div>
</template>

<script setup lang="ts">
import { BaseTable } from '@/shared/ui';

interface SenderInfo {
  userId?: string;
  meta?: Record<string, unknown>;
}

interface PackMessage {
  messageId: string;
  dialogId: string;
  sourceDialogId?: string;
  content?: unknown;
  type?: string;
  senderId?: string;
  senderInfo?: SenderInfo | null;
  createdAt: number;
  meta?: Record<string, unknown>;
}

interface Props {
  messages: PackMessage[];
  loading: boolean;
  error: string | null;
  formatTimestamp: (timestamp: number) => string;
}

const props = defineProps<Props>();

function summarizeContent(message: PackMessage): string {
  const { content } = message;
  if (typeof content === 'string') {
    return content.trim().length > 0 ? content : '(пустое сообщение)';
  }
  if (content && typeof content === 'object') {
    try {
      return JSON.stringify(content);
    } catch {
      return '[object]';
    }
  }
  return message.meta && Object.keys(message.meta).length > 0 ? JSON.stringify(message.meta) : '(нет содержимого)';
}

function renderSender(message: PackMessage): string {
  if (message.senderInfo?.userId) {
    return message.senderInfo.userId;
  }
  if (message.senderId) {
    return message.senderId;
  }
  return '—';
}

const formatTimestamp = props.formatTimestamp;
</script>

<style scoped>
.pack-messages-table {
  flex: 1;
  overflow: auto;
  display: flex;
  flex-direction: column;
}

.cell-dialog {
  white-space: nowrap;
}

.cell-message {
  max-width: 360px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.message-type {
  font-size: 12px;
  color: #6c757d;
  margin-right: 6px;
}

.cell-sender {
  white-space: nowrap;
}

.cell-created {
  white-space: nowrap;
}
</style>
