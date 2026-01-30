<template>
  <div class="panel-content">
    <BaseTable
      class="dialogs-table"
      :items="dialogs"
      :loading="loading"
      :error="error"
      loading-text="Загрузка диалогов..."
      empty-text="Диалоги не найдены"
      :get-item-key="(dialog) => dialog.dialogId"
      :selectable="true"
      :selected-key="currentDialogId"
      :get-row-class="() => 'dialog-row'"
      @row-click="handleRowClick"
    >
      <template #header>
        <tr>
          <th>Dialog ID</th>
          <th @click="toggleSort('createdAt')" style="cursor: pointer;">
            Создан
            <span class="sort-indicator" :class="{ active: currentSort && currentSort.includes('createdAt') }">
              {{ getSortIndicator('createdAt') }}
            </span>
          </th>
          <th style="text-align: center;">Участники</th>
          <th style="text-align: center;">Топики</th>
          <th style="text-align: center;">Сообщения</th>
          <th>Инфо</th>
        </tr>
      </template>

      <template #row="{ item }">
        <td>{{ (item as Dialog).dialogId }}</td>
        <td>{{ formatTimestamp((item as Dialog).createdAt) }}</td>
        <td style="text-align: center;">{{ (item as Dialog).stats?.memberCount ?? '—' }}</td>
        <td style="text-align: center;">{{ (item as Dialog).stats?.topicCount ?? '—' }}</td>
        <td style="text-align: center;">{{ (item as Dialog).stats?.messageCount ?? '—' }}</td>
        <td>
          <BaseButton variant="primary" size="small" @click.stop="showInfo((item as Dialog).dialogId)">
            ℹ️ Инфо
          </BaseButton>
        </td>
      </template>
    </BaseTable>
  </div>
</template>

<script setup lang="ts">
import { BaseTable, BaseButton } from '@/shared/ui';

interface DialogStats {
  memberCount?: number;
  messageCount?: number;
  topicCount?: number;
}

interface Dialog {
  dialogId: string;
  createdAt?: string | number;
  stats?: DialogStats;
}

interface Props {
  dialogs: Dialog[];
  loading: boolean;
  error: string | null;
  currentDialogId: string | null;
  currentSort: string | null;
  getSortIndicator: (field: string) => string;
  formatTimestamp: (createdAt?: string | number) => string;
}

interface Emits {
  (e: 'toggle-sort', field: string): void;
  (e: 'select-dialog', dialogId: string): void;
  (e: 'show-info', dialogId: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

function toggleSort(field: string) {
  emit('toggle-sort', field);
}

function handleRowClick(dialog: Dialog, _index: number) {
  emit('select-dialog', dialog.dialogId);
}

function showInfo(dialogId: string) {
  emit('show-info', dialogId);
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

.sort-indicator {
  margin-left: 5px;
  font-size: 10px;
  color: #667eea;
}

.sort-indicator.active {
  font-weight: bold;
}

</style>
