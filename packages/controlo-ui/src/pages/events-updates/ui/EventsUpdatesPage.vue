<template>
  <div class="events-updates-page">
    <div class="container">
      <!-- Колонка События -->
      <div class="events-panel">
        <div class="panel">
          <div class="panel-header">
            <div class="header-left">
              <span>События</span>
            </div>
            <div class="header-right">
              <button class="btn btn-url" @click="showUrlModal('events')">URL</button>
            </div>
          </div>
          <EventFilterPanel
            :filter-input="eventsFilterInput"
            :filter-applied="eventsFilterApplied"
            @update:filter-input="eventsFilterInput = $event"
            @set-filter-example="(field, value) => setFilterExample('events', field, value)"
            @clear="clearFilter('events')"
            @apply="applyFilter('events')"
          />
          <EventPagination
            :pagination-info="eventsPaginationInfo"
            :current-page="currentEventsPage"
            :current-page-input="currentEventsPageInput"
            :total-pages="eventsTotalPages"
            v-model:current-limit="currentEventsLimit"
            :go-to-page="(page) => goToPage('events', page)"
            :change-limit="() => changeLimit('events')"
          />
          <EventTable
            :events="events"
            :loading="loadingEvents"
            :error="eventsError"
            :selected-event-id="selectedEventId"
            :format-timestamp="formatTimestamp"
            :sort-events="sortEvents"
            :select-event="selectEvent"
            :show-event-updates="showEventUpdates"
            :show-event-json="showEventJson"
          />
        </div>
      </div>

      <!-- Колонка Updates -->
      <div class="updates-panel">
        <div class="panel">
          <div class="panel-header">
            <div class="header-left">
              <span>Updates</span>
            </div>
            <div class="header-right">
              <button class="btn btn-url" @click="showUrlModal('updates')">URL</button>
            </div>
          </div>
          <UpdateFilterPanel
            :filter-input="updatesFilterInput"
            :filter-applied="updatesFilterApplied"
            @update:filter-input="updatesFilterInput = $event"
            @set-filter-example="(field, value) => setFilterExample('updates', field, value)"
            @clear="clearFilter('updates')"
            @apply="applyFilter('updates')"
          />
          <UpdatePagination
            :pagination-info="updatesPaginationInfo"
            :current-page="currentUpdatesPage"
            :current-page-input="currentUpdatesPageInput"
            :total-pages="updatesTotalPages"
            v-model:current-limit="currentUpdatesLimit"
            :go-to-page="(page) => goToPage('updates', page)"
            :change-limit="() => changeLimit('updates')"
          />
          <UpdateTable
            :updates="updates"
            :loading="loadingUpdates"
            :error="updatesError"
            :format-timestamp="formatTimestamp"
            :sort-updates="sortUpdates"
            :show-update-json="showUpdateJson"
          />
        </div>
      </div>
    </div>

    <!-- Модальное окно для URL -->
    <UrlModal
      :is-open="showUrlModalFlag"
      :url="urlModalContent"
      @close="closeUrlModal"
      @copy="copyUrl"
    />

    <!-- Модальное окно для JSON -->
    <JsonModal
      :is-open="showJsonModalFlag"
      :url="jsonModalUrl"
      :content="jsonModalContent"
      @close="closeJsonModal"
      @copy="copyJson"
    />
  </div>
</template>

<script setup lang="ts">
import { useEventsUpdatesPage } from '../model/useEventsUpdatesPage';
import { EventFilterPanel, UpdateFilterPanel } from './filters';
import { EventPagination, UpdatePagination } from './pagination';
import { EventTable } from '@/entities/event/ui';
import { UpdateTable } from '@/entities/update/ui';
import { UrlModal, JsonModal } from './modals';

const {
  // События
  events,
  loadingEvents,
  eventsError,
  currentEventsPage,
  currentEventsPageInput,
  eventsTotalPages,
  currentEventsLimit,
  eventsPaginationInfo,
  eventsFilterInput,
  eventsFilterApplied,
  selectedEventId,
  // Обновления
  updates,
  loadingUpdates,
  updatesError,
  currentUpdatesPage,
  currentUpdatesPageInput,
  updatesTotalPages,
  currentUpdatesLimit,
  updatesPaginationInfo,
  updatesFilterInput,
  updatesFilterApplied,
  // Модальные окна
  showUrlModalFlag,
  showJsonModalFlag,
  urlModalContent,
  jsonModalUrl,
  jsonModalContent,
  // Функции
  goToPage,
  changeLimit,
  setFilterExample,
  clearFilter,
  applyFilter,
  sortEvents,
  sortUpdates,
  selectEvent,
  showEventUpdates,
  showEventJson,
  showUpdateJson,
  showUrlModal,
  closeUrlModal,
  closeJsonModal,
  copyUrl,
  copyJson,
  formatTimestamp,
} = useEventsUpdatesPage();
</script>

<style scoped>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.events-updates-page {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f5f5f5;
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.container {
  display: flex;
  flex: 1;
  gap: 1px;
  background: #ddd;
  overflow: hidden;
}

.events-panel {
  width: 50%;
  min-width: 400px;
}

.updates-panel {
  width: 50%;
  min-width: 400px;
}

.panel {
  background: white;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.panel-header {
  background: #f8f9fa;
  padding: 15px 20px;
  border-bottom: 1px solid #e9ecef;
  font-weight: 600;
  color: #495057;
  font-size: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 59px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 15px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.btn {
  padding: 6px 12px;
  border: 1px solid #ced4da;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s;
}

.btn:hover {
  background: #e9ecef;
}

.btn-url {
  color: #667eea;
  border-color: #667eea;
}

.btn-url:hover {
  background: #667eea;
  color: white;
}
</style>
