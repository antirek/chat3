<template>
  <div v-if="isOpen" class="modal" @click.self="$emit('close')">
    <div class="modal-content" style="max-width: 900px;" @click.stop>
      <div class="modal-header">
        <h2 class="modal-title">📋 Статусы сообщения</h2>
        <span class="close" @click="$emit('close')">&times;</span>
      </div>
      <div class="modal-body">
        <div v-if="url" class="info-url" style="margin-bottom: 15px; padding: 8px; background: #f8f9fa; border-radius: 4px; font-family: monospace; font-size: 12px; word-break: break-all; color: #495057;">{{ url }}</div>
        <div>
          <div v-if="loading" class="loading">Загрузка статусов...</div>
          <div v-else-if="error" class="error">{{ error }}</div>
          <div v-else-if="statuses.length === 0" class="no-data">Нет статусов для этого сообщения</div>
          <table v-else style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px;">
            <thead>
              <tr style="border-bottom: 2px solid #dee2e6; background: #f8f9fa;">
                <th style="text-align: left; padding: 10px; font-weight: 600; color: #495057;">userId</th>
                <th style="text-align: left; padding: 10px; font-weight: 600; color: #495057;">userType</th>
                <th style="text-align: left; padding: 10px; font-weight: 600; color: #495057;">status</th>
                <th style="text-align: left; padding: 10px; font-weight: 600; color: #495057;">createdAt</th>
                <th style="text-align: left; padding: 10px; font-weight: 600; color: #495057;">updatedAt</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="status in statuses" :key="`${status.userId}-${status.status}`" style="border-bottom: 1px solid #e9ecef;">
                <td style="padding: 10px; color: #495057; vertical-align: middle;">
                  <span style="font-family: monospace; font-size: 12px;">{{ status.userId || '-' }}</span>
                </td>
                <td style="padding: 10px; color: #495057; vertical-align: middle;">{{ status.userType || '-' }}</td>
                <td style="padding: 10px; color: #495057; vertical-align: middle;">
                  <span style="font-family: monospace; font-size: 12px;">{{ status.status || '-' }}</span>
                </td>
                <td style="padding: 10px; color: #495057; vertical-align: middle; font-size: 12px;">
                  {{ formatEventTime(status.createdAt) }}
                </td>
                <td style="padding: 10px; color: #495057; vertical-align: middle; font-size: 12px;">
                  {{ formatEventTime(status.updatedAt) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-show="totalPages > 1" style="margin-top: 15px; display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #f8f9fa; border-radius: 4px;">
          <div style="font-size: 12px; color: #6c757d;">
            Всего: {{ total }} | Страница {{ currentPage }} из {{ totalPages }}
          </div>
          <div style="display: flex; gap: 5px;">
            <button
              v-if="currentPage > 1"
              @click="$emit('go-to-page', currentPage - 1)"
              style="padding: 5px 10px; font-size: 12px; border: 1px solid #dee2e6; background: white; border-radius: 4px; cursor: pointer;"
            >
              ◀
            </button>
            <button
              v-if="currentPage < totalPages"
              @click="$emit('go-to-page', currentPage + 1)"
              style="padding: 5px 10px; font-size: 12px; border: 1px solid #dee2e6; background: white; border-radius: 4px; cursor: pointer;"
            >
              ▶
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Status {
  userId?: string;
  userType?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface Props {
  isOpen: boolean;
  statuses: Status[];
  loading: boolean;
  error: string | null;
  url?: string;
  total: number;
  currentPage: number;
  totalPages: number;
  formatEventTime: (time: string | undefined) => string;
}

defineProps<Props>();
defineEmits<{
  (e: 'close'): void;
  (e: 'go-to-page', page: number): void;
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
  max-width: 900px;
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
