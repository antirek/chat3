<template>
  <div v-if="isOpen" class="modal" @click.self="close">
    <div class="modal-content width-60" @click.stop>
      <div class="modal-header">
        <h2 class="modal-title">{{ title }}</h2>
        <span class="close" @click="close">&times;</span>
      </div>
      <div class="modal-body">
        <div class="meta-list">
          <div v-if="loading" class="loading">Загрузка meta тегов...</div>
          <template v-else>
            <h3 style="margin-bottom: 15px; font-size: 14px;">Текущие Meta теги:</h3>
            <div v-if="Object.keys(metaTags).length === 0" class="no-data">
              Meta теги отсутствуют
            </div>
            <table v-else style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="border-bottom: 2px solid #dee2e6; background: #f8f9fa;">
                  <th style="text-align: left; padding: 10px; font-weight: 600; color: #495057;">Key</th>
                  <th style="text-align: left; padding: 10px; font-weight: 600; color: #495057;">Value</th>
                  <th style="text-align: left; padding: 10px; font-weight: 600; color: #495057;">Действия</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(value, key) in metaTags"
                  :key="key"
                  style="border-bottom: 1px solid #e9ecef;"
                >
                  <td style="padding: 10px;">
                    <strong>{{ key }}</strong>
                  </td>
                  <td style="padding: 10px;">
                    {{ JSON.stringify(value) }}
                  </td>
                  <td style="padding: 10px;">
                    <button
                      type="button"
                      class="btn-danger btn-small"
                      @click="deleteTag(key)"
                    >
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
            <input
              type="text"
              v-model="newKey"
              :placeholder="keyPlaceholder"
            />
            <input
              type="text"
              v-model="newValue"
              :placeholder="valuePlaceholder"
            />
            <button
              type="button"
              class="btn-success btn-add-meta-tag"
              @click="addTag"
            >
              ➕ Добавить
            </button>
          </div>
        </div>

        <div class="form-actions">
          <button type="button" class="btn-secondary" @click="close">
            Закрыть
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

interface Props {
  isOpen: boolean;
  title: string;
  loading: boolean;
  metaTags: Record<string, any>;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}

interface Emits {
  (e: 'close'): void;
  (e: 'add-tag', key: string, value: string): void;
  (e: 'delete-tag', key: string): void;
}

const props = withDefaults(defineProps<Props>(), {
  keyPlaceholder: 'key (например: type)',
  valuePlaceholder: 'value (например: "internal" или {"foo": "bar"})',
});

const emit = defineEmits<Emits>();

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
.modal {
  display: block;
  position: fixed;
  z-index: 1000;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
}

.modal-content {
  background-color: #fefefe;
  margin: 3% auto;
  padding: 0;
  border: none;
  border-radius: 8px;
  width: 90%;
  max-width: 1200px;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.width-60 {
  width: 60% !important;
  max-width: 800px;
}

.modal-header {
  background: #f8f9fa;
  padding: 20px;
  border-bottom: 1px solid #e9ecef;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-title {
  margin: 0;
  color: #333;
  font-size: 18px;
}

.close {
  color: #aaa;
  font-size: 28px;
  font-weight: bold;
  cursor: pointer;
  line-height: 1;
}

.close:hover,
.close:focus {
  color: #000;
  text-decoration: none;
}

.modal-body {
  padding: 20px;
  max-height: calc(90vh - 100px);
  overflow-y: auto;
}

.loading,
.no-data {
  padding: 20px;
  text-align: center;
  color: #6c757d;
}

.meta-list {
  margin-bottom: 20px;
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
  margin-bottom: 10px;
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
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
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
  border-radius: 3px;
  cursor: pointer;
}

.btn-add-meta-tag {
  padding: 6px 12px;
  font-size: 12px;
  line-height: 1;
  height: auto;
  border-radius: 4px;
}

.form-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.form-actions button {
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  background: white;
  transition: all 0.2s;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background: #5a6268;
}
</style>
