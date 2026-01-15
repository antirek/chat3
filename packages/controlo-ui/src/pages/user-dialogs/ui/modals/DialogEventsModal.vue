<template>
  <div v-if="isOpen" class="modal" @click.self="$emit('close')">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h2 class="modal-title modal-title-left">События диалога</h2>
        <h2 class="modal-title modal-title-right" v-show="dialogEventUpdates.length > 0" style="margin: 0; color: #495057; font-size: 18px;">Обновления диалога</h2>
        <span class="close" @click="$emit('close')">&times;</span>
      </div>
      <div class="modal-body">
        <div class="modal-form-container">
          <div class="modal-form-left">
            <div style="max-height: 500px; overflow-y: auto;">
              <div v-if="loading" class="loading">Загрузка событий...</div>
              <div v-else-if="error" class="error">{{ error }}</div>
              <div v-else-if="events.length === 0" style="padding: 20px; text-align: center; color: #6c757d;">
                События не найдены
              </div>
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
                    v-for="(event, index) in events"
                    :key="getDialogEventId(event) || `event-${index}`"
                    :data-event-id="getDialogEventId(event) || ''"
                    class="event-row"
                    :class="{ 'event-row-selected': selectedEventId === getDialogEventId(event) }"
                    :style="{ cursor: (event.updatesCount > 0 && getDialogEventId(event)) ? 'pointer' : 'default' }"
                    @click="(event.updatesCount > 0 && getDialogEventId(event) && dialogId) && $emit('load-updates', dialogId, getDialogEventId(event)!)"
                  >
                    <td style="padding: 10px; color: #6c757d; font-size: 12px; vertical-align: top;">{{ formatEventTime(event.createdAt) }}</td>
                    <td style="padding: 10px; color: #495057; vertical-align: top;">
                      <span>{{ getDialogEventDescription(event.eventType, event.data) }}</span>
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
                        v-if="event.updatesCount > 0 && getDialogEventId(event) && dialogId"
                        class="action-button updates-button"
                        @click.stop="$emit('load-updates', dialogId, getDialogEventId(event)!)"
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
              <div v-if="dialogEventUpdates.length === 0" style="padding: 20px; text-align: center; color: #6c757d;">
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
                  <tr v-for="update in dialogEventUpdates" :key="getUpdateId(update)" style="border-bottom: 1px solid #e9ecef;">
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
interface DialogEvent {
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
  events: DialogEvent[];
  dialogEventUpdates: Update[];
  loading: boolean;
  error: string | null;
  dialogId: string | null;
  selectedEventId: string | null;
  getDialogEventId: (event: DialogEvent) => string | null;
  getDialogEventDescription: (eventType: string, data: unknown) => string;
  formatEventTime: (time: string | undefined) => string;
  getUpdateId: (update: Update) => string;
}

defineProps<Props>();
defineEmits<{
  (e: 'close'): void;
  (e: 'load-updates', dialogId: string, eventId: string): void;
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
  background: white;
  border-radius: 8px;
  max-width: 900px;
  width: 90%;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
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
.error {
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

.event-row-selected {
  background: #e3f2fd !important;
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
