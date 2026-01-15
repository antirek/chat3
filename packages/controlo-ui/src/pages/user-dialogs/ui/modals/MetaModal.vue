<template>
  <BaseModal :is-open="isOpen" :title="title" max-width="800px" @close="close">
    <div class="meta-list">
      <div v-if="loading" class="loading">Загрузка meta тегов...</div>
      <template v-else>
        <h3 style="margin-bottom: 15px; font-size: 14px;">Текущие Meta теги:</h3>
        <div v-if="Object.keys(metaTags).length === 0" class="no-data">
          Meta теги отсутствуют
        </div>
        <table v-else class="meta-table">
          <thead>
            <tr>
              <th>Key</th>
              <th>Value</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(value, key) in metaTags" :key="key">
              <td><strong>{{ key }}</strong></td>
              <td>{{ JSON.stringify(value) }}</td>
              <td>
                <button type="button" class="btn-danger btn-small" @click="deleteTag(String(key))">
                  🗑️ Удалить
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </template>
    </div>

    <div class="meta-section">
      <h3>Добавить Meta тег</h3>
      <div class="meta-tag-row">
        <input type="text" v-model="newKey" :placeholder="keyPlaceholder" />
        <input type="text" v-model="newValue" :placeholder="valuePlaceholder" />
        <button type="button" class="btn-success" @click="addTag">➕ Добавить</button>
      </div>
    </div>

    <template #footer>
      <button type="button" class="btn-secondary" @click="close">Закрыть</button>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { BaseModal } from '@/shared/ui';

interface Props {
  isOpen: boolean;
  title: string;
  loading: boolean;
  metaTags: Record<string, any>;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}

const props = withDefaults(defineProps<Props>(), {
  keyPlaceholder: 'key (например: type)',
  valuePlaceholder: 'value (например: "internal" или {"foo": "bar"})',
});

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'add-tag', key: string, value: string): void;
  (e: 'delete-tag', key: string): void;
}>();

const newKey = ref('');
const newValue = ref('');

function close() {
  newKey.value = '';
  newValue.value = '';
  emit('close');
}

function addTag() {
  if (newKey.value && newValue.value) {
    emit('add-tag', newKey.value, newValue.value);
    newKey.value = '';
    newValue.value = '';
  }
}

function deleteTag(key: string) {
  emit('delete-tag', key);
}
</script>

<style scoped>
.loading,
.no-data {
  padding: 20px;
  text-align: center;
  color: #6c757d;
}

.meta-list {
  margin-bottom: 20px;
}

.meta-table {
  width: 100%;
  border-collapse: collapse;
}

.meta-table th,
.meta-table td {
  text-align: left;
  padding: 10px;
}

.meta-table thead tr {
  border-bottom: 2px solid #dee2e6;
  background: #f8f9fa;
}

.meta-table th {
  font-weight: 600;
  color: #495057;
}

.meta-table tbody tr {
  border-bottom: 1px solid #e9ecef;
}

.meta-section {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #e9ecef;
}

.meta-section h3 {
  margin-bottom: 15px;
  font-size: 16px;
  color: #495057;
}

.meta-tag-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.meta-tag-row input {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 12px;
}

.btn-success {
  background: #28a745;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.btn-success:hover {
  background: #218838;
}

.btn-danger {
  background: #dc3545;
  color: white;
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.btn-danger:hover {
  background: #c82333;
}

.btn-small {
  padding: 4px 5px;
  font-size: 11px;
}

.btn-secondary {
  background: #6c757d;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.btn-secondary:hover {
  background: #5a6268;
}
</style>
