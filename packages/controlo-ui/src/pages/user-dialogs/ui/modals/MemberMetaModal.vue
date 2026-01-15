<template>
  <div v-if="isOpen" class="modal" @click.self="$emit('close')">
    <div class="modal-content width-60" @click.stop>
      <div class="modal-header">
        <h2 class="modal-title">Мета-теги участника: {{ userId }}</h2>
        <span class="close" @click="$emit('close')">&times;</span>
      </div>
      <div class="modal-body">
        <div class="form-section">
          <label>Участник:</label>
          <div style="padding: 10px; background: #f8f9fa; border-radius: 4px; margin-bottom: 15px;">
            Диалог: {{ dialogId }}<br />
            Участник: {{ userId }}
          </div>
        </div>
        <div class="member-meta-editor">
          <div v-if="metaTags.length === 0" class="member-meta-empty">Мета-теги отсутствуют</div>
          <div v-else>
            <div v-for="(metaTag, index) in metaTags" :key="index" class="member-meta-row">
              <input
                type="text"
                :value="metaTag.key"
                @input="$emit('update-meta-key', index, ($event.target as HTMLInputElement).value)"
                placeholder="Ключ"
                :readonly="metaTag.isExisting"
                class="member-meta-key"
              />
              <input
                type="text"
                :value="metaTag.value"
                @input="$emit('update-meta-value', index, ($event.target as HTMLInputElement).value)"
                placeholder="Значение"
                class="member-meta-value"
              />
              <button
                type="button"
                class="remove-meta-btn"
                @click="$emit('remove-meta-row', index)"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
        <div class="meta-editor-actions" style="margin-top: 15px;">
          <button type="button" class="btn-add-tag" @click="$emit('add-meta-row')">➕ Добавить тег</button>
        </div>
        <div class="form-actions" style="margin-top: 20px;">
          <button type="button" class="btn-primary" @click="$emit('save')">Сохранить</button>
          <button type="button" class="btn-secondary" @click="$emit('close')">Отмена</button>
        </div>
        <div v-if="status" class="status-message" style="margin-top: 15px; padding: 10px; border-radius: 4px; background: #d4edda; color: #155724; border: 1px solid #c3e6cb;">
          {{ status }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface MetaTag {
  key: string;
  value: string;
  isExisting?: boolean;
}

interface Props {
  isOpen: boolean;
  dialogId: string;
  userId: string;
  metaTags: MetaTag[];
  status?: string;
}

defineProps<Props>();
defineEmits<{
  (e: 'close'): void;
  (e: 'save'): void;
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

.form-section label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #495057;
}

.member-meta-editor {
  margin-top: 10px;
}

.member-meta-empty {
  padding: 20px;
  text-align: center;
  color: #6c757d;
  background: #f8f9fa;
  border-radius: 4px;
}

.member-meta-row {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
  align-items: center;
}

.member-meta-key,
.member-meta-value {
  flex: 1;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.member-meta-key[readonly] {
  background: #e9ecef;
}

.remove-meta-btn {
  padding: 8px 12px;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.remove-meta-btn:hover {
  background: #c82333;
}

.btn-add-tag {
  padding: 8px 16px;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.btn-add-tag:hover {
  background: #218838;
}

.form-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.btn-primary {
  padding: 10px 20px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
}

.btn-primary:hover {
  background: #5568d3;
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
