<template>
  <div class="panel-content">
    <div v-if="!hasPack" class="placeholder">Выберите пак</div>
    <BaseTable
      v-else
      class="pack-dialogs-table"
      :items="items"
      :loading="loading"
      :error="error"
      :get-item-key="(item) => item.dialogId"
      :selectable="false"
      loading-text="Загрузка диалогов пака..."
      empty-text="В паке нет диалогов"
    >
      <template #header>
        <tr>
          <th>dialogId</th>
          <th>Добавлен в пак</th>
          <th>Действия</th>
        </tr>
      </template>
      <template #row="{ item }">
        <td>{{ shortenDialogId(item.dialogId) }}</td>
        <td>{{ formatTimestamp(item.addedAt) }}</td>
        <td class="actions-column">
          <BaseButton variant="primary" size="small" @click.stop="$emit('show-info', item.dialogId)">ℹ️ Инфо</BaseButton>
          <BaseButton variant="success" size="small" @click.stop="$emit('show-meta', item.dialogId)">🏷️ Мета</BaseButton>
          <BaseButton variant="secondary" size="small" @click.stop="$emit('go-to-dialog', item.dialogId)">↗️ Переход</BaseButton>
        </td>
      </template>
    </BaseTable>
  </div>
</template>

<script setup lang="ts">
import { BaseTable, BaseButton } from '@/shared/ui';
import { formatTimestamp } from '@/shared/lib/utils/date';

interface PackDialogItem {
  dialogId: string;
  addedAt: number;
}

interface Props {
  items: PackDialogItem[];
  loading: boolean;
  error: string | null;
  hasPack: boolean;
}

defineProps<Props>();
defineEmits<{
  (e: 'show-info', dialogId: string): void;
  (e: 'show-meta', dialogId: string): void;
  (e: 'go-to-dialog', dialogId: string): void;
}>();

function shortenDialogId(dialogId: string): string {
  if (!dialogId) return '-';
  if (dialogId.length <= 20) return dialogId;
  return dialogId.substring(0, 8) + '...' + dialogId.substring(dialogId.length - 8);
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
</style>
