<template>
  <div class="panel-content">
    <div v-if="!hasUser" class="placeholder">Выберите пользователя</div>
    <BaseTable
      v-else
      class="dialogs-table"
      :items="dialogs"
      :loading="loading"
      :error="error"
      :get-item-key="(item) => item.dialogId"
      :selectable="true"
      :selected-key="selectedDialogId"
      :get-row-class="() => 'dialog-row'"
      loading-text="Загрузка диалогов..."
      empty-text="Диалоги не найдены"
      @row-click="handleRowClick"
    >
      <template #header>
        <tr>
          <th>👥 Dialog ID</th>
          <th style="text-align: center;">🔔 Непроч.</th>
          <th style="text-align: center;">📌 Топики</th>
          <th>👁‍🗨 Последний просмотр</th>
          <th>⚡ Действия</th>
        </tr>
      </template>
      <template #row="{ item }">
        <td>{{ shortenDialogId(item.dialogId) }}</td>
        <td style="text-align: center;">{{ item.context?.unreadCount || 0 }}</td>
        <td style="text-align: center;">
          <span style="background: #f0f0f0; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; color: #495057;">
            {{ item.stats?.topicCount || 0 }}
          </span>
        </td>
        <td>{{ formatLastSeen(item.context?.lastSeenAt) }}</td>
        <td class="actions-column">
          <button class="info-button" @click.stop="$emit('show-info', item.dialogId)">ℹ️ Инфо</button>
          <button class="action-button events-button" @click.stop="$emit('show-events', item.dialogId)">📋 События</button>
          <button class="btn-success btn-small" @click.stop="$emit('show-meta', item.dialogId)">🏷️ Мета</button>
        </td>
      </template>
    </BaseTable>
  </div>
</template>

<script setup lang="ts">
import { BaseTable } from '@/shared/ui';

interface Dialog {
  dialogId: string;
  context?: {
    unreadCount?: number;
    lastSeenAt?: string | number;
  };
  stats?: {
    topicCount?: number;
  };
}

interface Props {
  dialogs: Dialog[];
  loading: boolean;
  error: string | null;
  selectedDialogId: string | null;
  hasUser: boolean;
}

defineProps<Props>();
const emit = defineEmits<{
  (e: 'select', dialogId: string): void;
  (e: 'show-info', dialogId: string): void;
  (e: 'show-events', dialogId: string): void;
  (e: 'show-meta', dialogId: string): void;
}>();

function handleRowClick(item: Dialog) {
  emit('select', item.dialogId);
}

function shortenDialogId(dialogId: string): string {
  if (!dialogId) return '-';
  if (dialogId.length <= 20) return dialogId;
  return dialogId.substring(0, 8) + '...' + dialogId.substring(dialogId.length - 8);
}

function formatLastSeen(lastSeenAt?: string | number): string {
  if (!lastSeenAt) return '-';
  try {
    // Конвертируем строку в число, если это timestamp
    const ts = typeof lastSeenAt === 'string' ? parseFloat(lastSeenAt) : lastSeenAt;
    if (isNaN(ts)) return '-';
    const date = new Date(ts);
    // Проверяем, что дата валидна
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleString('ru-RU');
  } catch {
    return '-';
  }
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


.placeholder {
  padding: 40px 20px;
  text-align: center;
  color: #6c757d;
}

.actions-column {
  white-space: normal;
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

.events-button {
  background: #17a2b8;
  color: white;
}

.events-button:hover {
  background: #138496;
}

.btn-success {
  background: #28a745;
  color: white;
}

.btn-success:hover {
  background: #218838;
}
</style>
