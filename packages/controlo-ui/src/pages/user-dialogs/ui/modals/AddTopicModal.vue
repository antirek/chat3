<template>
  <div v-if="isOpen" class="modal" @click.self="$emit('close')">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h2 class="modal-title">Создать топик</h2>
        <span class="close" @click="$emit('close')">&times;</span>
      </div>
      <div class="modal-body">
        <form @submit.prevent="$emit('submit')">
          <div class="form-group">
            <label>Мета-теги (опционально):</label>
            <div style="margin-top: 10px;">
              <div
                v-for="(metaTag, index) in metaTags"
                :key="index"
                class="meta-tag-row"
                style="display: flex; gap: 10px; margin-bottom: 10px; align-items: center;"
              >
                <input
                  type="text"
                  :value="metaTag.key"
                  @input="$emit('update-meta-key', index, ($event.target as HTMLInputElement).value)"
                  placeholder="Ключ"
                  style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px;"
                />
                <input
                  type="text"
                  :value="metaTag.value"
                  @input="$emit('update-meta-value', index, ($event.target as HTMLInputElement).value)"
                  placeholder="Значение"
                  style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px;"
                />
                <button
                  type="button"
                  class="remove-meta-btn"
                  @click="$emit('remove-meta-row', index)"
                  v-show="metaTags.length > 1"
                  style="padding: 8px 12px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;"
                >
                  ✕
                </button>
              </div>
            </div>
            <button
              type="button"
              class="btn-add-tag"
              @click="$emit('add-meta-row')"
              style="margin-top: 10px; padding: 8px 16px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;"
            >
              ➕ Добавить мета-тег
            </button>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn-success">Создать</button>
            <button type="button" class="btn-secondary" @click="$emit('close')">Отмена</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface MetaTag {
  key: string;
  value: string;
}

interface Props {
  isOpen: boolean;
  metaTags: MetaTag[];
}

defineProps<Props>();
defineEmits<{
  (e: 'close'): void;
  (e: 'submit'): void;
  (e: 'add-meta-row'): void;
  (e: 'remove-meta-row', index: number): void;
  (e: 'update-meta-key', index: number, value: string): void;
  (e: 'update-meta-value', index: number, value: string): void;
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
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
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

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #495057;
}

.form-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 20px;
}

.btn-success {
  padding: 10px 20px;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
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
