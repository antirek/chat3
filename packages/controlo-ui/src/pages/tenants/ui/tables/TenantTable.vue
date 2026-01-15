<template>
  <div class="content" id="tenantsList">
    <div v-if="loading" class="loading">Загрузка...</div>
    <div v-else-if="error" class="error">Ошибка загрузки: {{ error }}</div>
    <div v-else-if="tenants.length === 0" class="no-data">Тенанты не найдены</div>
    <table v-else>
      <thead>
        <tr>
          <th @click="toggleSort('tenantId')" style="cursor: pointer;">
            Tenant ID
            <span class="sort-indicator">{{ getSortIndicator('tenantId') }}</span>
          </th>
          <th @click="toggleSort('createdAt')" style="cursor: pointer;">
            Создан
            <span class="sort-indicator">{{ getSortIndicator('createdAt') }}</span>
          </th>
          <th>Действия</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="tenant in tenants" :key="tenant.tenantId">
          <td><strong>{{ tenant.tenantId || '-' }}</strong></td>
          <td>{{ formatTimestamp(tenant.createdAt) }}</td>
          <td>
            <button
              class="btn-primary btn-small"
              @click="showInfo(tenant.tenantId)"
            >
              📋 Инфо
            </button>
            <button
              class="btn-success btn-small"
              @click="showMeta(tenant.tenantId)"
            >
              🏷️ Мета
            </button>
            <button
              class="btn-danger btn-small"
              @click="deleteTenant(tenant.tenantId)"
            >
              🗑️ Удалить
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
interface Tenant {
  tenantId: string;
  createdAt?: string | number;
}

interface Props {
  tenants: Tenant[];
  loading: boolean;
  error: string | null;
  getSortIndicator: (field: string) => string;
  formatTimestamp: (timestamp?: string | number) => string;
}

interface Emits {
  (e: 'toggle-sort', field: string): void;
  (e: 'show-info', tenantId: string): void;
  (e: 'show-meta', tenantId: string): void;
  (e: 'delete', tenantId: string): void;
}

defineProps<Props>();
const emit = defineEmits<Emits>();

function toggleSort(field: string) {
  emit('toggle-sort', field);
}

function showInfo(tenantId: string) {
  emit('show-info', tenantId);
}

function showMeta(tenantId: string) {
  emit('show-meta', tenantId);
}

function deleteTenant(tenantId: string) {
  emit('delete', tenantId);
}
</script>

<style scoped>
.content {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}

.loading {
  text-align: center;
  padding: 40px;
  color: #667eea;
  font-size: 14px;
}

.error {
  background: #f8d7da;
  color: #721c24;
  padding: 15px;
  border-radius: 6px;
  margin: 15px;
  font-size: 13px;
}

.no-data {
  text-align: center;
  padding: 40px;
  color: #6c757d;
  font-size: 14px;
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
  padding: 12px 15px;
  text-align: left;
  font-weight: 600;
  color: #495057;
  font-size: 12px;
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
  padding: 12px 15px;
  border-bottom: 1px solid #e9ecef;
  font-size: 13px;
}

tr:hover {
  background: #f8f9fa;
}

button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #667eea;
  color: white;
  border: none;
}

.btn-primary:hover:not(:disabled) {
  background: #5a6fd8;
}

.btn-success {
  background: #48bb78;
  color: white;
}

.btn-success:hover:not(:disabled) {
  background: #38a169;
}

.btn-danger {
  background: #dc3545;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #c82333;
}

.btn-small {
  padding: 4px 10px;
  font-size: 11px;
  margin-right: 5px;
}

.sort-indicator {
  margin-left: 5px;
  font-size: 10px;
  color: #667eea;
}
</style>
