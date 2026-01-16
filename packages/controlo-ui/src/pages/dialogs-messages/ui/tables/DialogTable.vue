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
          <th>Пользователи</th>
          <th>Инфо</th>
        </tr>
      </template>

      <template #row="{ item }">
        <td>{{ (item as Dialog).dialogId }}</td>
        <td>{{ formatUpdatedAt((item as Dialog).createdAt) }}</td>
        <td>{{ formatMembers((item as Dialog).members) }}</td>
        <td>
          <button class="info-button" @click.stop="showInfo((item as Dialog).dialogId)">
            ℹ️ Инфо
          </button>
        </td>
      </template>
    </BaseTable>
  </div>
</template>

<script setup lang="ts">
import { BaseTable } from '@/shared/ui';

interface Dialog {
  dialogId: string;
  createdAt?: string | number;
  members?: Array<{ userId: string; isActive?: boolean }>;
}

interface Props {
  dialogs: Dialog[];
  loading: boolean;
  error: string | null;
  currentDialogId: string | null;
  currentSort: string;
  getSortIndicator: (field: string) => string;
  formatUpdatedAt: (createdAt?: string | number) => string;
  formatMembers: (members?: Array<{ userId: string; isActive?: boolean }>) => string;
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

:deep(.dialogs-table.base-table-container) {
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

.sort-indicator.active {
  font-weight: bold;
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
