<template>
  <div class="events-updates-page">
    <div class="container">
      <!-- Колонка События -->
      <BasePanel width="50%">
        <template #header-left>
          <span>События</span>
        </template>
        <template #header-right>
          <BaseButton variant="url" @click="showUrlModal('events')">🔗 URL</BaseButton>
        </template>
        <EventFilterPanel
          :filter-input="eventsFilterInput"
          @update:filter-input="eventsFilterInput = $event"
          @clear="clearFilter('events')"
          @apply="applyFilter('events')"
        />
        <EventPagination
          :pagination-info="eventsPaginationInfo"
          :current-page="currentEventsPage"
          :current-page-input="currentEventsPageInput"
          :total-pages="eventsTotalPages"
          :total="eventsTotal"
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
      </BasePanel>

      <!-- Колонка Updates -->
      <BasePanel width="50%">
        <template #header-left>
          <span>Updates</span>
        </template>
        <template #header-right>
          <BaseButton variant="url" @click="showUrlModal('updates')">🔗 URL</BaseButton>
        </template>
        <UpdateFilterPanel
          :filter-input="updatesFilterInput"
          @update:filter-input="updatesFilterInput = $event"
          @clear="clearFilter('updates')"
          @apply="applyFilter('updates')"
        />
        <UpdatePagination
          :pagination-info="updatesPaginationInfo"
          :current-page="currentUpdatesPage"
          :current-page-input="currentUpdatesPageInput"
          :total-pages="updatesTotalPages"
          :total="updatesTotal"
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
      </BasePanel>
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
import { BasePanel, BaseButton } from '@/shared/ui';
import { useEventsUpdatesPage } from '../model/useEventsUpdatesPage';
import { EventFilterPanel, UpdateFilterPanel } from './filters';
import { EventPagination, UpdatePagination } from './pagination';
import { EventTable, UpdateTable } from './tables';
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
  eventsTotal,
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
  updatesTotal,
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

</style>
