<template>
  <div v-if="isOpen" class="modal" @click.self="$emit('close')">
    <div class="modal-content width-60" @click.stop>
      <div class="modal-header">
        <h2 class="modal-title">🏷️ Meta теги топика</h2>
        <span class="close" @click="$emit('close')">&times;</span>
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
                      @click="$emit('delete-tag', key)"
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
              :value="newKey"
              @input="$emit('update:newKey', ($event.target as HTMLInputElement).value)"
              placeholder="key (например: category)"
            />
            <input
              type="text"
              :value="newValue"
              @input="$emit('update:newValue', ($event.target as HTMLInputElement).value)"
              placeholder='value (например: "general" или {"foo": "bar"})'
            />
            <button
              type="button"
              class="btn-success btn-add-meta-tag"
              @click="$emit('add-tag')"
            >
              ➕ Добавить
            </button>
          </div>
        </div>

        <div class="form-actions">
          <button type="button" class="btn-secondary" @click="$emit('close')">
            Закрыть
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  isOpen: boolean;
  metaTags: Record<string, unknown>;
  loading: boolean;
  newKey: string;
  newValue: string;
}

defineProps<Props>();
defineEmits<{
  (e: 'close'): void;
  (e: 'delete-tag', key: string): void;
  (e: 'add-tag'): void;
  (e: 'update:newKey', value: string): void;
  (e: 'update:newValue', value: string): void;
}>();
</script>

<style scoped>
.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background-color: #fefefe;
  margin: 3% auto;
  padding: 0;
  border: none;
  border-radius: 8px;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.modal-content.width-60 {
  width: 60%;
  max-width: 800px;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 15px 20px;
  border-bottom: 1px solid #e9ecef;
  background: #f8f9fa;
}

.modal-title {
  margin: 0;
  font-size: 18px;
  color: #495057;
}

.close {
  font-size: 24px;
  cursor: pointer;
  color: #6c757d;
}

.close:hover {
  color: #495057;
}

.modal-body {
  padding: 20px;
  max-height: calc(90vh - 60px);
  overflow-y: auto;
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
  font-size: 14px;
  color: #495057;
}

.meta-tag-row {
  display: flex;
  gap: 10px;
  align-items: center;
}

.meta-tag-row input {
  flex: 1;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.loading,
.no-data {
  padding: 20px;
  text-align: center;
  color: #6c757d;
}

.form-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 20px;
}

.btn-danger {
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.btn-danger:hover {
  background: #c82333;
}

.btn-small {
  padding: 4px 8px;
  font-size: 12px;
}

.btn-success {
  padding: 8px 16px;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.btn-success:hover {
  background: #218838;
}

.btn-secondary {
  padding: 10px 20px;
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
}

.btn-secondary:hover {
  background: #5a6268;
}
</style>
