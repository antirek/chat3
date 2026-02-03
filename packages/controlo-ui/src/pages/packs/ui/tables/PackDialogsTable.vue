<template>
  <div class="pack-dialogs-table">
    <BaseTable
      :items="dialogs"
      :loading="loading"
      :error="error"
      loading-text="Загрузка диалогов..."
      empty-text="В паке нет диалогов. Добавьте диалог кнопкой «➕ Диалог»."
      :get-item-key="(d) => d.dialogId"
    >
      <template #header>
        <tr>
          <th>Dialog ID</th>
          <th>Добавлен</th>
          <th>Действия</th>
        </tr>
      </template>
      <template #row="{ item }">
        <td><strong>{{ (item as PackDialog).dialogId }}</strong></td>
        <td :title="(item as PackDialog).addedAt != null ? String((item as PackDialog).addedAt) : undefined">
          {{ formatTimestamp((item as PackDialog).addedAt) }}
        </td>
        <td>
          <BaseButton
            variant="primary"
            size="small"
            @click="showInfo((item as PackDialog).dialogId)"
          >
            📋 Инфо
          </BaseButton>
        </td>
      </template>
    </BaseTable>
  </div>
</template>

<script setup lang="ts">
import { BaseTable, BaseButton } from '@/shared/ui';
import { formatTimestamp } from '@/shared/lib/utils/date';

interface PackDialog {
  dialogId: string;
  addedAt: number;
}

interface Props {
  dialogs: PackDialog[];
  loading: boolean;
  error: string | null;
}

interface Emits {
  (e: 'show-dialog-info', dialogId: string): void;
}

defineProps<Props>();
const emit = defineEmits<Emits>();

function showInfo(dialogId: string) {
  emit('show-dialog-info', dialogId);
}
</script>

<style scoped>
.pack-dialogs-table {
  flex: 1;
  overflow: auto;
}
</style>
