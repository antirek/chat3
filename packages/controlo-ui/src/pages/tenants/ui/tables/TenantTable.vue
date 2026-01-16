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
          <BaseButton
            variant="primary"
            size="small"
            @click="showInfo((item as Tenant).tenantId)"
          >
            📋 Инфо
          </BaseButton>
          <BaseButton
            variant="success"
            size="small"
            @click="showMeta((item as Tenant).tenantId)"
          >
            🏷️ Мета
          </BaseButton>
          <BaseButton
            variant="danger"
            size="small"
            @click="deleteTenant((item as Tenant).tenantId)"
          >
            🗑️ Удалить
          </BaseButton>
        </td>
      </template>
    </BaseTable>
  </div>
</template>

<script setup lang="ts">
import { BaseTable, BaseButton } from '@/shared/ui';

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

</style>
