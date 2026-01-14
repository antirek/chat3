<template>
  <div class="panel-content" id="updates-content">
    <div v-if="loading" class="loading">Загрузка обновлений...</div>
    <div v-else-if="error" class="error">Ошибка загрузки обновлений: {{ error }}</div>
    <div v-else-if="updates.length === 0" class="no-data">Обновления не найдены</div>
    <table v-else>
      <thead>
        <tr>
          <th @click="sortUpdates('userId')">
            userId <span class="sort-indicator">↕</span>
          </th>
          <th @click="sortUpdates('entityId')">
            entityId <span class="sort-indicator">↕</span>
          </th>
          <th @click="sortUpdates('eventType')">
            eventType <span class="sort-indicator">↕</span>
          </th>
          <th @click="sortUpdates('createdAt')">
            createdAt <span class="sort-indicator">↕</span>
          </th>
          <th @click="sortUpdates('published')">
            published <span class="sort-indicator">↕</span>
          </th>
          <th class="actions-column">Действия</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="update in updates" :key="update._id || update.id">
          <td>{{ update.userId || '-' }}</td>
          <td>{{ update.entityId || '-' }}</td>
          <td>{{ update.eventType || '-' }}</td>
          <td>{{ formatTimestamp(update.createdAt) }}</td>
          <td>{{ update.published ? 'Да' : 'Нет' }}</td>
          <td class="actions-column">
            <button
              class="action-button"
              @click="showUpdateJson(update._id || update.id, update)"
            >
              Инфо
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
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
.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  padding: 8px 10px;
  text-align: left;
  border-bottom: 1px solid #e9ecef;
  font-size: 13px;
}

th {
  background: #f8f9fa;
  font-weight: 600;
  color: #495057;
  cursor: pointer;
  user-select: none;
  font-size: 12px;
  position: sticky;
  top: 0;
  z-index: 10;
}

th:hover {
  background: #e9ecef;
}

.sort-indicator {
  margin-left: 5px;
  color: #6c757d;
  font-size: 10px;
}

tr:hover {
  background: #f8f9fa;
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
