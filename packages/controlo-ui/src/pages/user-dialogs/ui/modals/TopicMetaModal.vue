<template>
  <BaseModal :is-open="isOpen" title="🏷️ Meta теги топика" max-width="800px" @close="$emit('close')">
    <div class="meta-list">
      <div v-if="loading" class="loading">Загрузка meta тегов...</div>
      <template v-else>
        <h3>Текущие Meta теги:</h3>
        <div v-if="Object.keys(metaTags).length === 0" class="no-data">Meta теги отсутствуют</div>
        <table v-else class="meta-table">
          <thead>
            <tr><th>Key</th><th>Value</th><th>Действия</th></tr>
          </thead>
          <tbody>
            <tr v-for="(value, key) in metaTags" :key="key">
              <td><strong>{{ key }}</strong></td>
              <td>{{ JSON.stringify(value) }}</td>
              <td><button type="button" class="btn-danger btn-small" @click="$emit('delete-tag', String(key))">🗑️ Удалить</button></td>
            </tr>
          </tbody>
        </table>
      </template>
    </div>

    <div class="meta-section">
      <h3>Добавить Meta тег</h3>
      <div class="meta-row">
        <input type="text" :value="newKey" @input="$emit('update:newKey', ($event.target as HTMLInputElement).value)" placeholder="key" />
        <input type="text" :value="newValue" @input="$emit('update:newValue', ($event.target as HTMLInputElement).value)" placeholder="value" />
        <button type="button" class="btn-success" @click="$emit('add-tag')">➕ Добавить</button>
      </div>
    </div>

    <template #footer>
      <button type="button" class="btn-secondary" @click="$emit('close')">Закрыть</button>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { BaseModal } from '@/shared/ui';

interface Props { isOpen: boolean; metaTags: Record<string, unknown>; loading: boolean; newKey: string; newValue: string; }

defineProps<Props>();
defineEmits<{
  (e: 'close'): void; (e: 'delete-tag', key: string): void; (e: 'add-tag'): void;
  (e: 'update:newKey', value: string): void; (e: 'update:newValue', value: string): void;
}>();
</script>

<style scoped>
.meta-list { margin-bottom: 20px; }
.meta-list h3, .meta-section h3 { margin-bottom: 15px; font-size: 14px; color: #495057; }
.meta-table { width: 100%; border-collapse: collapse; }
.meta-table th { text-align: left; padding: 10px; font-weight: 600; color: #495057; background: #f8f9fa; border-bottom: 2px solid #dee2e6; }
.meta-table td { padding: 10px; border-bottom: 1px solid #e9ecef; }
.meta-section { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e9ecef; }
.meta-row { display: flex; gap: 10px; align-items: center; }
.meta-row input { flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
.loading, .no-data { padding: 20px; text-align: center; color: #6c757d; }
.btn-danger { background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; }
.btn-small { padding: 4px 8px; font-size: 12px; }
.btn-success { padding: 8px 16px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; }
.btn-secondary { padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500; }
</style>
