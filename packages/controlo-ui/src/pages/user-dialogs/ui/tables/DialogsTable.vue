<template>
  <div class="panel-content">
    <div v-if="!hasUser" class="placeholder">Выберите пользователя</div>
    <div v-else-if="loading" class="loading">Загрузка диалогов...</div>
    <div v-else-if="error" class="error">Ошибка: {{ error }}</div>
    <div v-else-if="dialogs.length === 0" class="no-data">Диалоги не найдены</div>
    <table v-else>
      <thead>
        <tr>
          <th>Dialog ID</th>
          <th>Unread</th>
          <th style="text-align: center;">📌 Топики</th>
          <th>Последний просмотр</th>
          <th>Действия</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="dialog in dialogs"
          :key="dialog.dialogId"
          @click="$emit('select', dialog.dialogId)"
          :class="['dialog-row', { 'dialog-row-selected': selectedDialogId === dialog.dialogId }]"
          :data-dialog-id="dialog.dialogId"
        >
          <td>{{ shortenDialogId(dialog.dialogId) }}</td>
          <td>{{ dialog.context?.unreadCount || 0 }}</td>
          <td style="text-align: center;">
            <span style="background: #f0f0f0; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; color: #495057;">
              {{ dialog.stats?.topicCount || 0 }}
            </span>
          </td>
          <td>{{ formatLastSeen(dialog.context?.lastSeenAt) }}</td>
          <td class="actions-column">
            <button class="info-button" @click.stop="$emit('show-info', dialog.dialogId)">ℹ️ Инфо</button>
            <button class="action-button events-button" @click.stop="$emit('show-events', dialog.dialogId)">📋 События</button>
            <button class="btn-success btn-small" @click.stop="$emit('show-meta', dialog.dialogId)">🏷️ Мета</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
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
defineEmits<{
  (e: 'select', dialogId: string): void;
  (e: 'show-info', dialogId: string): void;
  (e: 'show-events', dialogId: string): void;
  (e: 'show-meta', dialogId: string): void;
}>();

function shortenDialogId(dialogId: string): string {
  if (!dialogId) return '-';
  if (dialogId.length <= 20) return dialogId;
  return dialogId.substring(0, 8) + '...' + dialogId.substring(dialogId.length - 8);
}

function formatLastSeen(lastSeenAt?: string | number): string {
  if (!lastSeenAt) return '-';
  try {
    const date = new Date(lastSeenAt);
    return date.toLocaleString('ru-RU');
  } catch {
    return '-';
  }
}
</script>

<style scoped>
.panel-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
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

.dialog-row {
  cursor: pointer;
}

.dialog-row:hover {
  background: #f8f9fa;
}

.dialog-row-selected {
  background: #e3f2fd !important;
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
