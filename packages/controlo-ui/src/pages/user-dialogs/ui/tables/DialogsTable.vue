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
          <th>Dialog ID</th>
          <th style="text-align: center;">Непроч.</th>
          <th style="text-align: center;">Топики</th>
          <th>Последний просмотр</th>
          <th>Действия</th>
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
        <td>{{ formatTimestamp(item.context?.lastSeenAt) }}</td>
        <td class="actions-column">
          <BaseButton variant="primary" size="small" @click.stop="$emit('show-info', item.dialogId)">ℹ️ Инфо</BaseButton>
          <BaseButton variant="events" size="small" @click.stop="$emit('show-events', item.dialogId)">📋 События</BaseButton>
          <BaseButton variant="success" size="small" @click.stop="$emit('show-meta', item.dialogId)">🏷️ Мета</BaseButton>
        </td>
      </template>
    </BaseTable>
  </div>
</template>

<script setup lang="ts">
import { BaseTable, BaseButton } from '@/shared/ui';
import { formatTimestamp } from '@/shared/lib/utils/date';

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

const formatLastSeen = formatTimestamp;
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

</style>
