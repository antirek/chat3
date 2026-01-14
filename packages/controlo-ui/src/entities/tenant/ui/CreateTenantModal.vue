<template>
  <div v-if="isOpen" class="modal" @click.self="close">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h2>Создать тенант</h2>
        <button class="modal-close" @click="close" title="Закрыть">×</button>
      </div>
      <div class="modal-body">
        <form @submit.prevent="handleSubmit">
          <div class="form-group">
            <label for="createTenantId">Tenant ID</label>
            <input
              type="text"
              id="createTenantId"
              v-model="tenantId"
              placeholder="my_tenant"
              maxlength="20"
            />
            <small>
              Опционально. Максимум 20 символов. Если не указан, будет сгенерирован автоматически.
            </small>
          </div>
          <div class="meta-section">
            <h3>Мета-теги (опционально)</h3>
            <div id="createMetaTagsList">
              <div v-if="metaTags.length === 0" style="padding: 10px; color: #6c757d; font-size: 12px;">
                Мета-теги не добавлены
              </div>
              <table v-else style="width: 100%; margin-bottom: 10px;">
                <thead>
                  <tr>
                    <th style="padding: 6px; font-size: 11px;">Key</th>
                    <th style="padding: 6px; font-size: 11px;">Value</th>
                    <th style="padding: 6px; font-size: 11px;">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="tag in metaTags" :key="tag.key">
                    <td style="padding: 6px; font-size: 12px;"><strong>{{ tag.key }}</strong></td>
                    <td style="padding: 6px; font-size: 12px;">{{ JSON.stringify(tag.value) }}</td>
                    <td style="padding: 6px;">
                      <button
                        type="button"
                        class="btn-danger btn-small"
                        @click="removeMetaTag(tag.key)"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="meta-tag-row">
              <input
                type="text"
                id="createMetaKey"
                v-model="newMetaKey"
                placeholder="key (например: company)"
              />
              <input
                type="text"
                id="createMetaValue"
                v-model="newMetaValue"
                placeholder="value (например: My Company)"
              />
              <button
                type="button"
                class="btn-success btn-small"
                @click="addMetaTag"
              >
                ➕ Добавить
              </button>
            </div>
          </div>
          <div class="form-actions">
            <button type="button" class="btn-secondary" @click="close">Отмена</button>
            <button type="submit" class="btn-success">Создать</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

interface Props {
  isOpen: boolean;
  tenantId: string;
  metaTags: Array<{ key: string; value: any }>;
  newMetaKey: string;
  newMetaValue: string;
}

interface Emits {
  (e: 'close'): void;
  (e: 'submit'): void;
  (e: 'add-meta-tag'): void;
  (e: 'remove-meta-tag', key: string): void;
  (e: 'update:tenantId', value: string): void;
  (e: 'update:newMetaKey', value: string): void;
  (e: 'update:newMetaValue', value: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const tenantId = ref(props.tenantId);
const newMetaKey = ref(props.newMetaKey);
const newMetaValue = ref(props.newMetaValue);

watch(() => props.tenantId, (val) => {
  tenantId.value = val;
});

watch(() => props.newMetaKey, (val) => {
  newMetaKey.value = val;
});

watch(() => props.newMetaValue, (val) => {
  newMetaValue.value = val;
});

watch(tenantId, (val) => {
  emit('update:tenantId', val);
});

watch(newMetaKey, (val) => {
  emit('update:newMetaKey', val);
});

watch(newMetaValue, (val) => {
  emit('update:newMetaValue', val);
});

function close() {
  emit('close');
}

function handleSubmit() {
  emit('submit');
}

function addMetaTag() {
  emit('add-meta-tag');
}

function removeMetaTag(key: string) {
  emit('remove-meta-tag', key);
}
</script>

<style scoped>
/* Modal */
.modal {
  position: fixed;
  z-index: 1000;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  animation: fadeIn 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.modal-content {
  background: white;
  margin: 50px auto;
  padding: 0;
  border-radius: 8px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  animation: slideIn 0.3s;
}

@keyframes slideIn {
  from {
    transform: translateY(-30px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.modal-header {
  padding: 15px 20px;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
  border-radius: 8px 8px 0 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h2 {
  font-size: 16px;
  margin: 0;
  color: #333;
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  color: #6c757d;
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.modal-close:hover {
  background: #e9ecef;
  color: #333;
}

.modal-body {
  padding: 20px;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  color: #495057;
  font-size: 13px;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 13px;
}

.form-group small {
  display: block;
  margin-top: 4px;
  color: #6c757d;
  font-size: 11px;
}

.form-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 20px;
}

.form-actions button {
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
}

button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-success {
  background: #48bb78;
  color: white;
}

.btn-success:hover:not(:disabled) {
  background: #38a169;
}

.btn-danger {
  background: #dc3545;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #c82333;
}

.btn-secondary {
  background: #6c757d;
  color: white;
  border: none;
}

.btn-secondary:hover:not(:disabled) {
  background: #5a6268;
}

.btn-small {
  padding: 4px 10px;
  font-size: 11px;
  margin-right: 5px;
}

.meta-section {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 2px solid #e9ecef;
}

.meta-section h3 {
  font-size: 14px;
  margin-bottom: 15px;
  color: #333;
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

table {
  width: 100%;
  border-collapse: collapse;
}

thead {
  background: #f8f9fa;
}

th {
  padding: 6px;
  font-size: 11px;
  text-align: left;
  font-weight: 600;
  border-bottom: 1px solid #e9ecef;
}

td {
  padding: 6px;
  font-size: 12px;
  border-bottom: 1px solid #e9ecef;
}
</style>
