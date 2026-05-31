<template>
  <BaseModal :is-open="isOpen" title="События диалога" max-width="1500px" @close="$emit('close')">
    <div class="events-container">
      <div class="events-left">
        <h3 v-if="dialogEventUpdates.length > 0" class="section-title">События</h3>
        <div class="events-scroll">
          <div v-if="loading" class="loading">Загрузка событий...</div>
          <div v-else-if="error" class="error">{{ error }}</div>
          <div v-else-if="events.length === 0" class="no-data">События не найдены</div>
          <table v-else class="events-table">
            <thead>
              <tr>
                <th style="width: 15%;">Время</th>
                <th style="width: 35%;">Описание события</th>
                <th style="width: 25%;">Тип события</th>
                <th style="width: 25%;">Обновления</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(event, index) in events" :key="getDialogEventId(event) || `event-${index}`" class="event-row" :class="{ selected: selectedEventId === getDialogEventId(event) }" :style="{ cursor: ((event.updatesCount ?? 0) > 0 && getDialogEventId(event)) ? 'pointer' : 'default' }" @click="((event.updatesCount ?? 0) > 0 && getDialogEventId(event) && dialogId) && $emit('load-updates', dialogId, getDialogEventId(event)!)">
                <td class="time-cell">{{ formatEventTime(event.createdAt) }}</td>
                <td>
                  <span>{{ getDialogEventDescription(event.eventType || '', event.data ?? {}) }}</span>
                  <br v-if="event.actorId">
                  <small class="actor-info">Актор: {{ event.actorId }}{{ event.actorType ? ` (${event.actorType})` : '' }}</small>
                </td>
                <td><code>{{ event.eventType || '-' }}</code></td>
                <td>
                  <BaseButton v-if="(event.updatesCount ?? 0) > 0 && getDialogEventId(event) && dialogId" variant="primary" size="small" @click.stop="$emit('load-updates', dialogId, getDialogEventId(event)!)">🔄 Обновления</BaseButton>
                  <span v-else class="no-updates">{{ (event.updatesCount ?? 0) === 0 ? 'Нет обновлений' : '-' }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="events-right">
        <h3 v-if="dialogEventUpdates.length > 0" class="section-title">Обновления диалога</h3>
        <div class="events-scroll">
          <div v-if="dialogEventUpdates.length === 0" class="no-data">Нажмите "Обновления" для просмотра</div>
          <table v-else class="events-table">
            <thead>
              <tr>
                <th style="width: 20%;">Время</th>
                <th style="width: 40%;">Тип события</th>
                <th style="width: 40%;">Пользователь</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="update in dialogEventUpdates" :key="getUpdateId(update)">
                <td class="time-cell">{{ formatEventTime(update.createdAt) }}</td>
                <td>{{ update.updateType || '-' }}<span v-if="update.sourceEventType"> ({{ update.sourceEventType }})</span></td>
                <td>{{ update.userId || '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { BaseModal, BaseButton } from '@/shared/ui';

interface DialogEvent {
  _id?: string; id?: string; eventType?: string; createdAt?: string;
  actorId?: string; actorType?: string; updatesCount?: number; data?: Record<string, unknown>;
}
interface Update { _id?: string; id?: string; eventType?: string; createdAt?: string; userId?: string; }

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
defineEmits<{ (e: 'close'): void; (e: 'load-updates', dialogId: string, eventId: string): void; }>();
</script>

<style scoped>
.events-container { display: flex; gap: 20px; }
.events-left, .events-right { flex: 1; }
.section-title { margin: 0 0 15px; font-size: 16px; color: #495057; }
.events-scroll { max-height: 500px; overflow-y: auto; }
.events-table { width: 100%; border-collapse: collapse; }
.events-table th { text-align: left; padding: 10px; font-weight: 600; color: #495057; background: #f8f9fa; border-bottom: 2px solid #dee2e6; }
.events-table td { padding: 10px; border-bottom: 1px solid #e9ecef; vertical-align: top; }
.event-row:hover { background: #f8f9fa; }
.event-row.selected { background: #e3f2fd !important; }
.time-cell { color: #6c757d; font-size: 12px; }
.actor-info { color: #6c757d; font-size: 11px; }
code { font-family: monospace; font-size: 12px; font-weight: 500; }
.no-updates { color: #999; font-size: 12px; }
.loading, .error, .no-data { padding: 20px; text-align: center; color: #6c757d; }
.error { color: #dc3545; }
</style>
