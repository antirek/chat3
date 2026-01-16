<template>
  <div id="events-content" class="events-content-container">
    <BaseTable
      class="events-table"
      :items="events"
      :loading="loading"
      :error="error"
      loading-text="Загрузка событий..."
      empty-text="События не найдены"
      :get-item-key="(event) => event.eventId || String(event._id)"
      :selectable="true"
      :selected-key="selectedEventId"
      :get-row-class="() => 'event-row'"
      @row-click="handleRowClick"
    >
      <template #header>
        <tr>
          <th @click="sortEvents('eventId')" style="cursor: pointer;">
            eventId <span class="sort-indicator">↕</span>
          </th>
          <th @click="sortEvents('eventType')" style="cursor: pointer;">
            eventType <span class="sort-indicator">↕</span>
          </th>
          <th @click="sortEvents('actorId')" style="cursor: pointer;">
            actorId <span class="sort-indicator">↕</span>
          </th>
          <th @click="sortEvents('createdAt')" style="cursor: pointer;">
            createdAt <span class="sort-indicator">↕</span>
          </th>
          <th class="actions-column">Действия</th>
        </tr>
      </template>

      <template #row="{ item }">
        <td>{{ (item as Event).eventId || '-' }}</td>
        <td>{{ (item as Event).eventType || '-' }}</td>
        <td>{{ (item as Event).actorId || '-' }}</td>
        <td>{{ formatTimestamp((item as Event).createdAt) }}</td>
        <td class="actions-column">
          <button
            class="action-button updates-button"
            @click.stop="showEventUpdates((item as Event).eventId || String((item as Event)._id))"
          >
            Updates
          </button>
          <button
            class="action-button"
            @click.stop="showEventJson(String((item as Event)._id || ''), item as Event)"
          >
            Инфо
          </button>
        </td>
      </template>
    </BaseTable>
  </div>
</template>

<script setup lang="ts">
import { BaseTable } from '@/shared/ui';

interface Event {
  eventId?: string;
  _id?: string;
  eventType?: string;
  actorId?: string;
  createdAt?: string | number;
}

interface Props {
  events: Event[];
  loading: boolean;
  error: string | null;
  selectedEventId: string | null;
  formatTimestamp: (ts?: string | number | null) => string;
  sortEvents: (field: string) => void;
  selectEvent: (eventId: string) => void;
  showEventUpdates: (eventId: string) => void;
  showEventJson: (eventId: string, event: Event) => void;
}

const props = defineProps<Props>();

function handleRowClick(event: Event, _index: number) {
  props.selectEvent(event.eventId || String(event._id));
}
</script>

<style scoped>
.events-content-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

:deep(.events-table.base-table-container) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

:deep(th[style*='cursor: pointer']) {
  cursor: pointer;
  user-select: none;
}

:deep(th[style*='cursor: pointer']:hover) {
  background: #e9ecef;
}

.sort-indicator {
  margin-left: 5px;
  color: #6c757d;
  font-size: 10px;
}

.actions-column {
  padding: 0;
  font-size: 0;
}

.action-button {
  padding: 4px 8px;
  font-size: 11px;
  border: 1px solid #ced4da;
  background: white;
  border-radius: 3px;
  cursor: pointer;
  height: 25px;
  margin-right: 2px;
}

.action-button:last-child {
  margin-right: 0;
}

.action-button:hover {
  background: #e9ecef;
}

.action-button.updates-button {
  background: #ff9800;
  color: white;
  border-color: #ff9800;
}

.action-button.updates-button:hover {
  background: #f57c00;
}
</style>
