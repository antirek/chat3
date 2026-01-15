<template>
  <BaseModal :is-open="isOpen" title="📋 Статусы сообщения" max-width="900px" @close="$emit('close')">
    <div v-if="url" class="url-info">{{ url }}</div>
    <div v-if="loading" class="loading">Загрузка статусов...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else-if="statuses.length === 0" class="no-data">Нет статусов для этого сообщения</div>
    <table v-else class="statuses-table">
      <thead>
        <tr>
          <th>userId</th>
          <th>userType</th>
          <th>status</th>
          <th>createdAt</th>
          <th>updatedAt</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="status in statuses" :key="`${status.userId}-${status.status}`">
          <td><code>{{ status.userId || '-' }}</code></td>
          <td>{{ status.userType || '-' }}</td>
          <td><code>{{ status.status || '-' }}</code></td>
          <td class="time-cell">{{ formatEventTime(status.createdAt) }}</td>
          <td class="time-cell">{{ formatEventTime(status.updatedAt) }}</td>
        </tr>
      </tbody>
    </table>
    <div v-show="totalPages > 1" class="pagination-bar">
      <div class="pagination-info">Всего: {{ total }} | Страница {{ currentPage }} из {{ totalPages }}</div>
      <div class="pagination-controls">
        <button v-if="currentPage > 1" @click="$emit('go-to-page', currentPage - 1)">◀</button>
        <button v-if="currentPage < totalPages" @click="$emit('go-to-page', currentPage + 1)">▶</button>
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { BaseModal } from '@/shared/ui';

interface Status { userId?: string; userType?: string; status?: string; createdAt?: string; updatedAt?: string; }
interface Props {
  isOpen: boolean; statuses: Status[]; loading: boolean; error: string | null; url?: string;
  total: number; currentPage: number; totalPages: number;
  formatEventTime: (time: string | undefined) => string;
}

defineProps<Props>();
defineEmits<{ (e: 'close'): void; (e: 'go-to-page', page: number): void; }>();
</script>

<style scoped>
.url-info { margin-bottom: 15px; padding: 8px; background: #f8f9fa; border-radius: 4px; font-family: monospace; font-size: 12px; word-break: break-all; color: #495057; }
.statuses-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.statuses-table th { text-align: left; padding: 10px; font-weight: 600; color: #495057; background: #f8f9fa; border-bottom: 2px solid #dee2e6; }
.statuses-table td { padding: 10px; border-bottom: 1px solid #e9ecef; vertical-align: middle; }
code { font-family: monospace; font-size: 12px; }
.time-cell { font-size: 12px; }
.pagination-bar { margin-top: 15px; display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #f8f9fa; border-radius: 4px; }
.pagination-info { font-size: 12px; color: #6c757d; }
.pagination-controls { display: flex; gap: 5px; }
.pagination-controls button { padding: 5px 10px; font-size: 12px; border: 1px solid #dee2e6; background: white; border-radius: 4px; cursor: pointer; }
.loading, .error, .no-data { padding: 20px; text-align: center; color: #6c757d; }
.error { color: #dc3545; }
</style>
