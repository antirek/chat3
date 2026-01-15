<template>
  <div v-if="isOpen" class="modal" @click.self="$emit('close')">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h2 class="modal-title">События сообщения</h2>
        <h2 class="modal-title" v-show="eventUpdates.length > 0" style="margin: 0; color: #495057; font-size: 18px;">Обновления события</h2>
        <span class="close" @click="$emit('close')">&times;</span>
      </div>
      <div class="modal-body">
        <div class="modal-form-container">
          <div class="modal-form-left">
            <div style="max-height: 500px; overflow-y: auto;">
              <div v-if="loading" class="loading">Загрузка событий...</div>
              <div v-else-if="error" class="error">{{ error }}</div>
              <div v-else-if="events.length === 0" class="no-data">События не найдены</div>
              <table v-else style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="border-bottom: 2px solid #dee2e6; background: #f8f9fa;">
                    <th style="text-align: left; padding: 10px; font-weight: 600; color: #495057; width: 15%;">Время</th>
                    <th style="text-align: left; padding: 10px; font-weight: 600; color: #495057; width: 35%;">Описание события</th>
                    <th style="text-align: left; padding: 10px; font-weight: 600; color: #495057; width: 25%;">Тип события</th>
                    <th style="text-align: left; padding: 10px; font-weight: 600; color: #495057; width: 25%;">Обновления</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="event in events"
                    :key="getEventId(event)"
                    :data-event-id="getEventId(event)"
                    class="event-row"
                    :style="{ cursor: event.updatesCount > 0 ? 'pointer' : 'default' }"
                    @click="event.updatesCount > 0 && $emit('load-updates', getEventId(event))"
                  >
                    <td style="padding: 10px; color: #6c757d; font-size: 12px; vertical-align: top;">{{ formatEventTime(event.createdAt) }}</td>
                    <td style="padding: 10px; color: #495057; vertical-align: top;">
                      <span>{{ getEventDescription(event.eventType, event.data) }}</span>
                      <br v-if="event.actorId">
                      <span v-if="event.actorId" style="color: #6c757d; font-size: 11px;">
                        Актор: {{ event.actorId }}{{ event.actorType ? ` (${event.actorType})` : '' }}
                      </span>
                    </td>
                    <td style="padding: 10px; color: #495057; vertical-align: top;">
                      <span style="font-weight: 500; font-family: monospace; font-size: 12px;">{{ event.eventType || '-' }}</span>
                    </td>
                    <td style="padding: 10px; vertical-align: top;">
                      <button
                        v-if="event.updatesCount > 0"
                        class="action-button updates-button"
                        @click.stop="$emit('load-updates', getEventId(event))"
                        style="padding: 5px 10px; font-size: 12px;"
                      >
                        🔄 Обновления
                      </button>
                      <span v-else-if="event.updatesCount === 0" style="color: #999; font-size: 12px;">Нет обновлений</span>
                      <span v-else style="color: #999; font-size: 12px;">-</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div class="modal-form-right">
            <div style="max-height: 500px; overflow-y: auto;">
              <div v-if="eventUpdates.length === 0" style="padding: 20px; text-align: center; color: #6c757d;">
                <p>Нажмите "Обновления" для просмотра обновлений</p>
              </div>
              <table v-else style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="border-bottom: 2px solid #dee2e6; background: #f8f9fa;">
                    <th style="text-align: left; padding: 10px; font-weight: 600; color: #495057; width: 20%;">Время</th>
                    <th style="text-align: left; padding: 10px; font-weight: 600; color: #495057; width: 40%;">Тип события</th>
                    <th style="text-align: left; padding: 10px; font-weight: 600; color: #495057; width: 40%;">Пользователь</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="update in eventUpdates" :key="update._id || update.id" style="border-bottom: 1px solid #e9ecef;">
                    <td style="padding: 10px; color: #6c757d; font-size: 12px;">{{ formatEventTime(update.createdAt) }}</td>
                    <td style="padding: 10px; color: #495057; font-size: 12px;">{{ update.eventType || '-' }}</td>
                    <td style="padding: 10px; color: #495057; font-size: 12px;">{{ update.userId || '-' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Event {
  _id?: string;
  id?: string;
  eventType?: string;
  createdAt?: string;
  actorId?: string;
  actorType?: string;
  updatesCount?: number;
  data?: Record<string, unknown>;
}

interface Update {
  _id?: string;
  id?: string;
  eventType?: string;
  createdAt?: string;
  userId?: string;
}

interface Props {
  isOpen: boolean;
  events: Event[];
  eventUpdates: Update[];
  loading: boolean;
  error: string | null;
  getEventId: (event: Event) => string;
  getEventDescription: (eventType: string, data: unknown) => string;
  formatEventTime: (time: string | undefined) => string;
}

defineProps<Props>();
defineEmits<{
  (e: 'close'): void;
  (e: 'load-updates', eventId: string): void;
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
  max-width: 1200px;
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

.modal-form-container {
  display: flex;
  gap: 20px;
}

.modal-form-left,
.modal-form-right {
  flex: 1;
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

.event-row:hover {
  background: #f8f9fa;
}

.action-button {
  padding: 4px 8px;
  font-size: 11px;
  border: 1px solid transparent;
  background: #f8f9fa;
  color: #495057;
  border-radius: 4px;
  cursor: pointer;
}

.updates-button {
  background: #e7f3ff;
  color: #0066cc;
  border-color: #b8daff;
}

.updates-button:hover {
  background: #cce5ff;
}
</style>
