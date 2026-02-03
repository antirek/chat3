<template>
  <div id="packsList">
    <BaseTable
      :items="packs"
      :loading="loading"
      :error="error"
      loading-text="Загрузка..."
      empty-text="Паки не найдены. Создайте пак или примените другой фильтр."
      :get-item-key="(pack) => (pack as Pack).packId"
      :selected-key="selectedPackId"
    >
      <template #header>
        <tr>
          <th @click="toggleSort('packId')" style="cursor: pointer;">
            Pack ID
            <span class="sort-indicator">{{ getSortIndicator('packId') }}</span>
          </th>
          <th @click="toggleSort('createdAt')" style="cursor: pointer;">
            Создан
            <span class="sort-indicator">{{ getSortIndicator('createdAt') }}</span>
          </th>
          <th>Диалоги</th>
          <th>Действия</th>
        </tr>
      </template>

      <template #row="{ item }">
        <td
          class="pack-id-cell"
          @click="selectPack((item as Pack).packId)"
        >
          <strong>{{ (item as Pack).packId || '-' }}</strong>
        </td>
        <td :title="(item as Pack).createdAt != null ? String((item as Pack).createdAt) : undefined">{{ formatTimestamp((item as Pack).createdAt) }}</td>
        <td
          class="dialog-count-cell"
          @click="selectPack((item as Pack).packId)"
        >
          {{ dialogCount((item as Pack).stats) }}
        </td>
        <td @click.stop>
          <BaseButton
            variant="primary"
            size="small"
            @click="showInfo((item as Pack).packId)"
          >
            📋 Инфо
          </BaseButton>
          <BaseButton
            variant="success"
            size="small"
            @click="showAddDialog((item as Pack).packId)"
          >
            ➕ Диалог
          </BaseButton>
          <BaseButton
            variant="success"
            size="small"
            @click="showMeta((item as Pack).packId)"
          >
            🏷️ Мета
          </BaseButton>
          <BaseButton
            variant="danger"
            size="small"
            @click="deletePack((item as Pack).packId)"
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

interface Pack {
  packId: string;
  createdAt?: string | number;
  meta?: Record<string, unknown>;
  stats?: { dialogCount?: number };
}

interface Props {
  packs: Pack[];
  loading: boolean;
  error: string | null;
  selectedPackId: string | null;
  getSortIndicator: (field: string) => string;
  formatTimestamp: (timestamp?: string | number) => string;
}

interface Emits {
  (e: 'toggle-sort', field: string): void;
  (e: 'select-pack', packId: string): void;
  (e: 'show-info', packId: string): void;
  (e: 'show-add-dialog', packId: string): void;
  (e: 'show-meta', packId: string): void;
  (e: 'delete', packId: string): void;
}

defineProps<Props>();
const emit = defineEmits<Emits>();

function dialogCount(stats: Pack['stats']): string | number {
  const n = stats?.dialogCount;
  return n !== undefined && n !== null ? n : '—';
}

function selectPack(packId: string) {
  emit('select-pack', packId);
}

function toggleSort(field: string) {
  emit('toggle-sort', field);
}

function showInfo(packId: string) {
  emit('show-info', packId);
}
function showAddDialog(packId: string) {
  emit('show-add-dialog', packId);
}
function showMeta(packId: string) {
  emit('show-meta', packId);
}

function deletePack(packId: string) {
  emit('delete', packId);
}
</script>

<style scoped>
.sort-indicator {
  margin-left: 5px;
  font-size: 10px;
  color: #667eea;
}
.pack-id-cell,
.dialog-count-cell {
  cursor: pointer;
}
.pack-id-cell:hover,
.dialog-count-cell:hover {
  background: #f0f4ff;
}
</style>
