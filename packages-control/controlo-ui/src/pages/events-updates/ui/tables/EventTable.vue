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
            eventId <span class="sort-indicator">{{ getSortIndicator('eventId') }}</span>
          </th>
          <th @click="sortEvents('eventType')" style="cursor: pointer;">
            eventType <span class="sort-indicator">{{ getSortIndicator('eventType') }}</span>
          </th>
          <th @click="sortEvents('actorId')" style="cursor: pointer;">
            actorId <span class="sort-indicator">{{ getSortIndicator('actorId') }}</span>
          </th>
          <th @click="sortEvents('createdAt')" style="cursor: pointer;">
            createdAt <span class="sort-indicator">{{ getSortIndicator('createdAt') }}</span>
          </th>
          <th class="actions-column">Действия</th>
        </tr>
      </template>

      <template #row="{ item }">
        <td>{{ (item as Event).eventId || '-' }}</td>
        <td>{{ (item as Event).eventType || '-' }}</td>
        <td>{{ (item as Event).actorId || '-' }}</td>
        <td :title="(item as Event).createdAt != null ? String((item as Event).createdAt) : undefined">{{ formatTimestamp((item as Event).createdAt) }}</td>
        <td class="actions-column">
          <BaseButton
            color="#ff9800"
            size="small"
            @click.stop="showEventUpdates((item as Event).eventId || String((item as Event)._id))"
          >
            🔄 Updates
          </BaseButton>
          <BaseButton
            variant="primary"
            size="small"
            @click.stop="showEventJson(item as Event)"
          >
          ℹ️ Инфо
          </BaseButton>
        </td>
      </template>
    </BaseTable>
  </div>
</template>

<script setup lang="ts">
import { BaseTable, BaseButton } from '@/shared/ui';

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
  getSortIndicator: (field: string) => string;
  selectEvent: (eventId: string) => void;
  showEventUpdates: (eventId: string) => void;
  showEventJson: (event: Event) => void;
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

.sort-indicator {
  margin-left: 5px;
  font-size: 10px;
  color: #667eea;
}

.actions-column {
  padding: 0;
  font-size: 0;
}

</style>
