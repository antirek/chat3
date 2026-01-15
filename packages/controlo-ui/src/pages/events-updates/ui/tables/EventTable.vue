<template>
  <div class="panel-content" id="events-content">
    <div v-if="loading" class="loading">Загрузка событий...</div>
    <div v-else-if="error" class="error">Ошибка загрузки событий: {{ error }}</div>
    <div v-else-if="events.length === 0" class="no-data">События не найдены</div>
    <table v-else>
      <thead>
        <tr>
          <th @click="sortEvents('eventId')">
            eventId <span class="sort-indicator">↕</span>
          </th>
          <th @click="sortEvents('eventType')">
            eventType <span class="sort-indicator">↕</span>
          </th>
          <th @click="sortEvents('actorId')">
            actorId <span class="sort-indicator">↕</span>
          </th>
          <th @click="sortEvents('createdAt')">
            createdAt <span class="sort-indicator">↕</span>
          </th>
          <th class="actions-column">Действия</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="event in events"
          :key="event.eventId || event._id"
          :class="['event-row', { 'event-row-selected': selectedEventId === (event.eventId || String(event._id)) }]"
          @click="selectEvent(event.eventId || String(event._id))"
        >
          <td>{{ event.eventId || '-' }}</td>
          <td>{{ event.eventType || '-' }}</td>
          <td>{{ event.actorId || '-' }}</td>
          <td>{{ formatTimestamp(event.createdAt) }}</td>
          <td class="actions-column">
            <button
              class="action-button updates-button"
              @click.stop="showEventUpdates(event.eventId || String(event._id))"
            >
              Updates
            </button>
            <button
              class="action-button"
              @click.stop="showEventJson(event._id, event)"
            >
              Инфо
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
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

defineProps<Props>();
</script>

<style scoped>
.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  padding: 8px 10px;
  text-align: left;
  border-bottom: 1px solid #e9ecef;
  font-size: 13px;
}

th {
  background: #f8f9fa;
  font-weight: 600;
  color: #495057;
  cursor: pointer;
  user-select: none;
  font-size: 12px;
  position: sticky;
  top: 0;
  z-index: 10;
}

th:hover {
  background: #e9ecef;
}

.sort-indicator {
  margin-left: 5px;
  color: #6c757d;
  font-size: 10px;
}

tr:hover {
  background: #f8f9fa;
}

.event-row {
  cursor: pointer;
}

.event-row:hover {
  background: #e3f2fd;
}

.event-row-selected {
  background-color: #e9ecef !important;
}

.event-row-selected:hover {
  background-color: #dee2e6 !important;
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

.loading,
.error,
.no-data {
  padding: 40px 20px;
  text-align: center;
  color: #6c757d;
}

.error {
  color: #dc3545;
}
</style>
