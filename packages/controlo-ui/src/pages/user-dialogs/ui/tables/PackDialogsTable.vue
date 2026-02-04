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
        </tr>
      </template>
      <template #row="{ item }">
        <td>{{ shortenDialogId(item.dialogId) }}</td>
        <td>{{ formatTimestamp(item.addedAt) }}</td>
      </template>
    </BaseTable>
  </div>
</template>

<script setup lang="ts">
import { BaseTable } from '@/shared/ui';
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
</style>
