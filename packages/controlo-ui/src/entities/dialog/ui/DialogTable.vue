<template>
  <div class="panel-content" id="dialogsList">
    <div v-if="loading" class="loading">Загрузка диалогов...</div>
    <div v-else-if="error" class="error">Ошибка загрузки: {{ error }}</div>
    <div v-else-if="dialogs.length === 0 && !loading" class="no-data">Диалоги не найдены</div>
    <table v-else-if="!loading && dialogs.length > 0">
      <thead>
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
      </thead>
      <tbody>
        <tr
          v-for="dialog in dialogs"
          :key="dialog.dialogId"
          @click="selectDialog(dialog.dialogId)"
          :class="['dialog-row', { 'dialog-row-selected': currentDialogId === dialog.dialogId }]"
          :data-dialog-id="dialog.dialogId"
        >
          <td>{{ dialog.dialogId }}</td>
          <td>{{ formatUpdatedAt(dialog.createdAt) }}</td>
          <td>{{ formatMembers(dialog.members) }}</td>
          <td>
            <button class="info-button" @click.stop="showInfo(dialog.dialogId)">
              ℹ️ Инфо
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
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

defineProps<Props>();
const emit = defineEmits<Emits>();

function toggleSort(field: string) {
  emit('toggle-sort', field);
}

function selectDialog(dialogId: string) {
  emit('select-dialog', dialogId);
}

function showInfo(dialogId: string) {
  emit('show-info', dialogId);
}
</script>

<style scoped>
.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}

table {
  width: 100%;
  border-collapse: collapse;
}

thead {
  background: #f8f9fa;
  position: sticky;
  top: 0;
  z-index: 10;
}

th {
  padding: 10px 12px;
  text-align: left;
  font-weight: 600;
  color: #495057;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 2px solid #e9ecef;
}

th[style*='cursor: pointer'] {
  cursor: pointer;
  user-select: none;
}

th[style*='cursor: pointer']:hover {
  background: #e9ecef;
}

td {
  padding: 10px 12px;
  border-bottom: 1px solid #e9ecef;
  font-size: 12px;
}

tr:hover {
  background: #f8f9fa;
}

.dialog-row {
  cursor: pointer;
  transition: background-color 0.2s;
}

.dialog-row:hover {
  background: #f0f0f0 !important;
}

.dialog-row-selected {
  background: #e3f2fd !important;
}

.dialog-row-selected:hover {
  background: #d1e7ff !important;
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

.sort-indicator {
  margin-left: 5px;
  font-size: 10px;
  color: #667eea;
}

.sort-indicator.active {
  font-weight: bold;
}

.loading,
.error,
.no-data {
  padding: 40px 20px;
  text-align: center;
  color: #6c757d;
}

.error {
  color: #dc3545;
}
</style>
