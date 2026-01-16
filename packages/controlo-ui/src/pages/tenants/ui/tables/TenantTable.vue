<template>
  <div id="tenantsList">
    <BaseTable
      :items="tenants"
      :loading="loading"
      :error="error"
      loading-text="Загрузка..."
      empty-text="Тенанты не найдены"
      :get-item-key="(tenant) => tenant.tenantId"
    >
      <template #header>
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
      </template>

      <template #row="{ item }">
        <td><strong>{{ (item as Tenant).tenantId || '-' }}</strong></td>
        <td>{{ formatTimestamp((item as Tenant).createdAt) }}</td>
        <td>
          <button
            class="btn-primary btn-small"
            @click="showInfo((item as Tenant).tenantId)"
          >
            📋 Инфо
          </button>
          <button
            class="btn-success btn-small"
            @click="showMeta((item as Tenant).tenantId)"
          >
            🏷️ Мета
          </button>
          <button
            class="btn-danger btn-small"
            @click="deleteTenant((item as Tenant).tenantId)"
          >
            🗑️ Удалить
          </button>
        </td>
      </template>
    </BaseTable>
  </div>
</template>

<script setup lang="ts">
import { BaseTable } from '@/shared/ui';

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

.sort-indicator {
  margin-left: 5px;
  font-size: 10px;
  color: #667eea;
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

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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
</style>
