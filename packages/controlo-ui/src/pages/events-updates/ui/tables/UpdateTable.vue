<template>
  <div id="updates-content" class="updates-content-container">
    <BaseTable
      class="updates-table"
      :items="updates"
      :loading="loading"
      :error="error"
      loading-text="Загрузка обновлений..."
      empty-text="Обновления не найдены"
      :get-item-key="(update) => update._id || update.id"
    >
      <template #header>
        <tr>
          <th @click="sortUpdates('userId')" style="cursor: pointer;">
            userId <span class="sort-indicator">↕</span>
          </th>
          <th @click="sortUpdates('entityId')" style="cursor: pointer;">
            entityId <span class="sort-indicator">↕</span>
          </th>
          <th @click="sortUpdates('eventType')" style="cursor: pointer;">
            eventType <span class="sort-indicator">↕</span>
          </th>
          <th @click="sortUpdates('createdAt')" style="cursor: pointer;">
            createdAt <span class="sort-indicator">↕</span>
          </th>
          <th @click="sortUpdates('published')" style="cursor: pointer;">
            published <span class="sort-indicator">↕</span>
          </th>
          <th class="actions-column">Действия</th>
        </tr>
      </template>

      <template #row="{ item }">
        <td>{{ (item as Update).userId || '-' }}</td>
        <td>{{ (item as Update).entityId || '-' }}</td>
        <td>{{ (item as Update).eventType || '-' }}</td>
        <td>{{ formatTimestamp((item as Update).createdAt) }}</td>
        <td>{{ (item as Update).published ? 'Да' : 'Нет' }}</td>
        <td class="actions-column">
          <button
            class="action-button"
            @click="showUpdateJson(String((item as Update)._id || (item as Update).id || ''), item as Update)"
          >
            Инфо
          </button>
        </td>
      </template>
    </BaseTable>
  </div>
</template>

<script setup lang="ts">
import { BaseTable } from '@/shared/ui';

interface Update {
  _id?: string;
  id?: string;
  userId?: string;
  entityId?: string;
  eventType?: string;
  createdAt?: string | number;
  published?: boolean;
}

interface Props {
  updates: Update[];
  loading: boolean;
  error: string | null;
  formatTimestamp: (ts?: string | number | null) => string;
  sortUpdates: (field: string) => void;
  showUpdateJson: (updateId: string, update: Update) => void;
}

defineProps<Props>();
</script>

<style scoped>
.updates-content-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

:deep(.updates-table.base-table-container) {
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
  color: #6c757d;
  font-size: 10px;
}

.actions-column {
  padding: 0;
  font-size: 0;
}

.action-button {
  padding: 4px 8px;
  font-size: 11px;
  border: 1px solid #ced4da;
  background: white;
  border-radius: 3px;
  cursor: pointer;
  height: 25px;
}

.action-button:hover {
  background: #e9ecef;
}
</style>
