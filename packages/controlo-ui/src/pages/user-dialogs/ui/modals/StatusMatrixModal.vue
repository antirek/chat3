<template>
  <div v-if="isOpen" class="modal" @click.self="$emit('close')">
    <div class="modal-content" style="max-width: 700px;" @click.stop>
      <div class="modal-header">
        <h2 class="modal-title">📊 Матрица статусов сообщения</h2>
        <span class="close" @click="$emit('close')">&times;</span>
      </div>
      <div class="modal-body">
        <div v-if="url" class="info-url" style="margin-bottom: 15px; padding: 8px; background: #f8f9fa; border-radius: 4px; font-family: monospace; font-size: 12px; word-break: break-all; color: #495057;">{{ url }}</div>
        <div>
          <div v-if="loading" class="loading">Загрузка матрицы статусов...</div>
          <div v-else-if="error" class="error">{{ error }}</div>
          <div v-else-if="statusMatrix.length === 0" class="no-data">Нет данных о статусах для этого сообщения</div>
          <table v-else style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <thead>
              <tr style="border-bottom: 2px solid #dee2e6; background: #f8f9fa;">
                <th style="text-align: left; padding: 12px; font-weight: 600; color: #495057;">Тип пользователя</th>
                <th style="text-align: left; padding: 12px; font-weight: 600; color: #495057;">Статус</th>
                <th style="text-align: right; padding: 12px; font-weight: 600; color: #495057;">Количество</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in statusMatrix" :key="`${item.userType}-${item.status}`" style="border-bottom: 1px solid #e9ecef;">
                <td style="padding: 12px; color: #495057; vertical-align: middle;">
                  <span style="font-weight: 500;">{{ item.userType || 'не указан' }}</span>
                </td>
                <td style="padding: 12px; color: #495057; vertical-align: middle;">
                  <span style="font-family: monospace; font-size: 13px;">{{ item.status || '-' }}</span>
                </td>
                <td style="padding: 12px; text-align: right; color: #495057; vertical-align: middle; font-weight: 600;">
                  {{ item.count || 0 }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface StatusMatrixItem {
  userType?: string;
  status?: string;
  count?: number;
}

interface Props {
  isOpen: boolean;
  statusMatrix: StatusMatrixItem[];
  loading: boolean;
  error: string | null;
  url?: string;
}

defineProps<Props>();
defineEmits<{
  (e: 'close'): void;
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
  max-width: 700px;
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

.loading,
.error,
.no-data {
  padding: 20px;
  text-align: center;
  color: #6c757d;
}

.error {
  color: #dc3545;
}
</style>
