<template>
  <BaseModal :is-open="isOpen" title="📊 Матрица статусов сообщения" max-width="700px" @close="$emit('close')">
    <div v-if="url" class="url-info">{{ url }}</div>
    <div v-if="loading" class="loading">Загрузка матрицы статусов...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else-if="statusMatrix.length === 0" class="no-data">Нет данных о статусах</div>
    <table v-else class="status-table">
      <thead>
        <tr>
          <th>Тип пользователя</th>
          <th>Статус</th>
          <th style="text-align: right;">Количество</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in statusMatrix" :key="`${item.userType}-${item.status}`">
          <td><strong>{{ item.userType || 'не указан' }}</strong></td>
          <td><code>{{ item.status || '-' }}</code></td>
          <td style="text-align: right; font-weight: 600;">{{ item.count || 0 }}</td>
        </tr>
      </tbody>
    </table>
  </BaseModal>
</template>

<script setup lang="ts">
import { BaseModal } from '@/shared/ui';

interface StatusMatrixItem { userType?: string; status?: string; count?: number; }
interface Props { isOpen: boolean; statusMatrix: StatusMatrixItem[]; loading: boolean; error: string | null; url?: string; }

defineProps<Props>();
defineEmits<{ (e: 'close'): void; }>();
</script>

<style scoped>
.url-info { margin-bottom: 15px; padding: 8px; background: #f8f9fa; border-radius: 4px; font-family: monospace; font-size: 12px; word-break: break-all; color: #495057; }
.status-table { width: 100%; border-collapse: collapse; }
.status-table th { text-align: left; padding: 12px; font-weight: 600; color: #495057; background: #f8f9fa; border-bottom: 2px solid #dee2e6; }
.status-table td { padding: 12px; border-bottom: 1px solid #e9ecef; vertical-align: middle; }
code { font-family: monospace; font-size: 13px; }
.loading, .error, .no-data { padding: 20px; text-align: center; color: #6c757d; }
.error { color: #dc3545; }
</style>
