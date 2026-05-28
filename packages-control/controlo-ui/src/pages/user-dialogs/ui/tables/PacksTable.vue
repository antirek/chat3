<template>
  <div class="panel-content">
    <div v-if="!hasUser" class="placeholder">Выберите пользователя</div>
    <BaseTable
      v-else
      class="packs-table"
      :items="packs"
      :loading="loading"
      :error="error"
      :get-item-key="(item) => item.packId"
      :selectable="true"
      :selected-key="selectedPackId"
      loading-text="Загрузка паков..."
      empty-text="Паки не найдены"
      @row-click="handleRowClick"
    >
      <template #header>
        <tr>
          <th>packId</th>
          <th style="text-align: center;">Диалоги</th>
          <th
            style="text-align: center; cursor: pointer;"
            @click="toggleSort('unreadCount')"
          >
            Непроч.
            <span class="sort-indicator" :class="{ active: currentSort === 'unreadCount' }">
              {{ getSortIndicator('unreadCount') }}
            </span>
          </th>
          <th
            style="cursor: pointer; white-space: nowrap;"
            @click="toggleSort('lastActivityAt')"
          >
            Последняя активность
            <span class="sort-indicator" :class="{ active: currentSort === 'lastActivityAt' }">
              {{ getSortIndicator('lastActivityAt') }}
            </span>
          </th>
          <th>Действия</th>
        </tr>
      </template>
      <template #row="{ item }">
        <td>{{ shortenPackId(item.packId) }}</td>
        <td style="text-align: center;">{{ item.stats?.dialogCount ?? 0 }}</td>
        <td style="text-align: center;">{{ item.stats?.unreadCount ?? 0 }}</td>
        <td>{{ formatLastActivity(item.lastActivityAt) }}</td>
        <td class="actions-column">
          <BaseButton
            v-if="(item.stats?.unreadCount ?? 0) > 0"
            variant="primary"
            size="small"
            :disabled="markAllReadLoading === item.packId"
            @click.stop="$emit('mark-all-read', item.packId)"
          >
            {{ markAllReadLoading === item.packId ? '…' : '✓' }} Отметить прочитанным
          </BaseButton>
          <BaseButton variant="primary" size="small" @click.stop="$emit('show-info', item.packId)">ℹ️ Инфо</BaseButton>
          <BaseButton variant="success" size="small" @click.stop="$emit('show-meta', item.packId)">🏷️ Мета</BaseButton>
        </td>
      </template>
    </BaseTable>
  </div>
</template>

<script setup lang="ts">
import { BaseTable, BaseButton } from '@/shared/ui';

interface Pack {
  packId: string;
  lastActivityAt?: number | null;
  stats?: {
    unreadCount?: number;
    dialogCount?: number;
    lastUpdatedAt?: number | null;
    createdAt?: number | null;
  };
}

interface Props {
  packs: Pack[];
  loading: boolean;
  error: string | null;
  hasUser: boolean;
  selectedPackId: string | null;
  currentSort: string | null;
  getSortIndicator: (field: string) => string;
  markAllReadLoading?: string | null;
}

defineProps<Props>();
const emit = defineEmits<{
  (e: 'select', packId: string): void;
  (e: 'show-info', packId: string): void;
  (e: 'show-meta', packId: string): void;
  (e: 'mark-all-read', packId: string): void;
  (e: 'toggle-sort', field: string): void;
}>();

function handleRowClick(item: Pack) {
  emit('select', item.packId);
}

function toggleSort(field: string) {
  emit('toggle-sort', field);
}

function shortenPackId(packId: string): string {
  if (!packId) return '-';
  if (packId.startsWith('pck_') && packId.length > 12) {
    return `pck_${packId.substring(4, 8)}...`;
  }
  return packId.length > 16 ? packId.substring(0, 16) + '...' : packId;
}

function formatLastActivity(ts: number | null | undefined): string {
  if (ts == null || ts === 0) return '—';
  const date = new Date(ts > 1000000000000 ? ts : ts * 1000);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
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

.actions-column {
  white-space: normal;
}

.sort-indicator {
  margin-left: 5px;
  font-size: 10px;
  color: #667eea;
}

.sort-indicator.active {
  font-weight: bold;
}
</style>
