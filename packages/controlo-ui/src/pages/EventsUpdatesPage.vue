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
          <div class="filter-form">
            <div class="filter-examples">
              <span class="filter-example" @click="setFilterExample('events', 'eventType', 'message.create')">message.create</span>
              <span class="filter-example" @click="setFilterExample('events', 'eventType', 'dialog.create')">dialog.create</span>
            </div>
            <div class="filter-row">
              <div class="filter-input-group">
                <input
                  type="text"
                  id="events-filter"
                  v-model="eventsFilterInput"
                  class="filter-input"
                  placeholder="Фильтр (например: eventType=message.create)"
                />
                <button class="filter-clear" @click="clearFilter('events')" title="Очистить">×</button>
              </div>
              <button class="filter-apply" :class="{ active: eventsFilterApplied }" @click="applyFilter('events')">Применить</button>
            </div>
          </div>
          <div class="pagination" id="events-pagination">
            <div class="pagination-info" id="events-pagination-info">
              {{ eventsPaginationInfo }}
            </div>
            <div class="pagination-controls">
              <button @click="goToPage('events', 1)" title="Первая">««</button>
              <button @click="goToPage('events', currentEventsPage - 1)" :disabled="currentEventsPage <= 1" title="Предыдущая">‹</button>
              <input
                type="number"
                id="events-page-input"
                v-model.number="currentEventsPageInput"
                min="1"
                :max="eventsTotalPages"
                @change="goToPage('events', currentEventsPageInput)"
              />
              <span>из</span>
              <span id="events-total-pages">{{ eventsTotalPages }}</span>
              <button @click="goToPage('events', currentEventsPage + 1)" :disabled="currentEventsPage >= eventsTotalPages" title="Следующая">›</button>
              <button @click="goToPage('events', eventsTotalPages)" :disabled="currentEventsPage >= eventsTotalPages" title="Последняя">»»</button>
              <select id="events-limit" v-model.number="currentEventsLimit" @change="changeLimit('events')">
                <option :value="10">10</option>
                <option :value="20">20</option>
                <option :value="50">50</option>
                <option :value="100">100</option>
              </select>
            </div>
          </div>
          <div class="panel-content" id="events-content">
            <div v-if="loadingEvents" class="loading">Загрузка событий...</div>
            <div v-else-if="eventsError" class="error">Ошибка загрузки событий: {{ eventsError }}</div>
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
          <div class="filter-form">
            <div class="filter-examples">
              <span class="filter-example" @click="setFilterExample('updates', 'eventType', 'message.create')">eventType: message.create</span>
              <span class="filter-example" @click="setFilterExample('updates', 'userId', '')">userId: </span>
              <span class="filter-example" @click="setFilterExample('updates', 'entityId', '')">entityId: </span>
            </div>
            <div class="filter-row">
              <div class="filter-input-group">
                <input
                  type="text"
                  id="updates-filter"
                  v-model="updatesFilterInput"
                  class="filter-input"
                  placeholder="Фильтр (например: eventType=message.create)"
                />
                <button class="filter-clear" @click="clearFilter('updates')" title="Очистить">×</button>
              </div>
              <button class="filter-apply" :class="{ active: updatesFilterApplied }" @click="applyFilter('updates')">Применить</button>
            </div>
          </div>
          <div class="pagination" id="updates-pagination">
            <div class="pagination-info" id="updates-pagination-info">
              {{ updatesPaginationInfo }}
            </div>
            <div class="pagination-controls">
              <button @click="goToPage('updates', 1)" title="Первая">««</button>
              <button @click="goToPage('updates', currentUpdatesPage - 1)" :disabled="currentUpdatesPage <= 1" title="Предыдущая">‹</button>
              <input
                type="number"
                id="updates-page-input"
                v-model.number="currentUpdatesPageInput"
                min="1"
                :max="updatesTotalPages"
                @change="goToPage('updates', currentUpdatesPageInput)"
              />
              <span>из</span>
              <span id="updates-total-pages">{{ updatesTotalPages }}</span>
              <button @click="goToPage('updates', currentUpdatesPage + 1)" :disabled="currentUpdatesPage >= updatesTotalPages" title="Следующая">›</button>
              <button @click="goToPage('updates', updatesTotalPages)" :disabled="currentUpdatesPage >= updatesTotalPages" title="Последняя">»»</button>
              <select id="updates-limit" v-model.number="currentUpdatesLimit" @change="changeLimit('updates')">
                <option :value="10">10</option>
                <option :value="20">20</option>
                <option :value="50">50</option>
                <option :value="100">100</option>
              </select>
            </div>
          </div>
          <div class="panel-content" id="updates-content">
            <div v-if="loadingUpdates" class="loading">Загрузка обновлений...</div>
            <div v-else-if="updatesError" class="error">Ошибка загрузки обновлений: {{ updatesError }}</div>
            <div v-else-if="updates.length === 0" class="no-data">Обновления не найдены</div>
            <table v-else>
              <thead>
                <tr>
                  <th @click="sortUpdates('userId')">
                    userId <span class="sort-indicator">↕</span>
                  </th>
                  <th @click="sortUpdates('entityId')">
                    entityId <span class="sort-indicator">↕</span>
                  </th>
                  <th @click="sortUpdates('eventType')">
                    eventType <span class="sort-indicator">↕</span>
                  </th>
                  <th @click="sortUpdates('createdAt')">
                    createdAt <span class="sort-indicator">↕</span>
                  </th>
                  <th @click="sortUpdates('published')">
                    published <span class="sort-indicator">↕</span>
                  </th>
                  <th class="actions-column">Действия</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="update in updates" :key="update._id || update.id">
                  <td>{{ update.userId || '-' }}</td>
                  <td>{{ update.entityId || '-' }}</td>
                  <td>{{ update.eventType || '-' }}</td>
                  <td>{{ formatTimestamp(update.createdAt) }}</td>
                  <td>{{ update.published ? 'Да' : 'Нет' }}</td>
                  <td class="actions-column">
                    <button
                      class="action-button"
                      @click="showUpdateJson(update._id || update.id, update)"
                    >
                      Инфо
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- Модальное окно для URL -->
    <div v-if="showUrlModalFlag" class="modal" @click.self="closeUrlModal">
      <div class="modal-content">
        <div class="modal-header">
          <div class="modal-title">URL запроса</div>
          <button class="modal-close" @click="closeUrlModal">×</button>
        </div>
        <div class="modal-body">
          <div class="modal-url" id="urlModal-url">{{ urlModalContent }}</div>
          <button class="btn-copy" @click="copyUrl">Скопировать URL</button>
        </div>
      </div>
    </div>

    <!-- Модальное окно для JSON -->
    <div v-if="showJsonModalFlag" class="modal" @click.self="closeJsonModal">
      <div class="modal-content">
        <div class="modal-header">
          <div class="modal-title">JSON данные</div>
          <button class="modal-close" @click="closeJsonModal">×</button>
        </div>
        <div class="modal-body">
          <div class="modal-url" id="jsonModal-url">{{ jsonModalUrl }}</div>
          <div class="json-viewer" id="jsonModal-content">{{ jsonModalContent }}</div>
          <button class="btn-copy" @click="copyJson">Скопировать JSON</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useConfigStore } from '@/app/stores/config';
import { useCredentialsStore } from '@/app/stores/credentials';

// Конфигурация
const configStore = useConfigStore();
const credentialsStore = useCredentialsStore();

// Состояние событий
const currentEventsPage = ref(1);
const currentEventsPageInput = ref(1);
const eventsTotalPages = ref(1);
const currentEventsLimit = ref(50);
const currentEventsFilter = ref('');
const eventsFilterInput = ref('');
const eventsFilterApplied = ref(false);
const selectedEventId = ref<string | null>(null);
const events = ref<any[]>([]);
const loadingEvents = ref(false);
const eventsError = ref<string | null>(null);

// Состояние обновлений
const currentUpdatesPage = ref(1);
const currentUpdatesPageInput = ref(1);
const updatesTotalPages = ref(1);
const currentUpdatesLimit = ref(50);
const currentUpdatesFilter = ref('');
const updatesFilterInput = ref('');
const updatesFilterApplied = ref(false);
const updates = ref<any[]>([]);
const loadingUpdates = ref(false);
const updatesError = ref<string | null>(null);

// Модальные окна
const showUrlModalFlag = ref(false);
const urlModalContent = ref('');
const showJsonModalFlag = ref(false);
const jsonModalUrl = ref('');
const jsonModalContent = ref('');

// Computed
const eventsPaginationInfo = computed(() => {
  const total = eventsTotalPages.value * currentEventsLimit.value;
  const start = (currentEventsPage.value - 1) * currentEventsLimit.value + 1;
  const end = Math.min(currentEventsPage.value * currentEventsLimit.value, total);
  return `${start}-${end} из ${total}`;
});

const updatesPaginationInfo = computed(() => {
  const total = updatesTotalPages.value * currentUpdatesLimit.value;
  const start = (currentUpdatesPage.value - 1) * currentUpdatesLimit.value + 1;
  const end = Math.min(currentUpdatesPage.value * currentUpdatesLimit.value, total);
  return `${start}-${end} из ${total}`;
});

// Получить URL для control-api
function getControlApiUrl(path = '') {
  if (typeof window !== 'undefined' && (window as any).CHAT3_CONFIG && (window as any).CHAT3_CONFIG.getControlApiUrl) {
    return (window as any).CHAT3_CONFIG.getControlApiUrl(path);
  }
  const controlApiUrl = configStore.config.CONTROL_APP_URL || 'http://localhost:3001';
  return `${controlApiUrl}${path}`;
}

// Получить tenantId
function getTenantId() {
  return credentialsStore.tenantId.value || 'tnt_default';
}

// Загрузить события
async function loadEvents() {
  loadingEvents.value = true;
  eventsError.value = null;
  
  try {
    const params = new URLSearchParams({
      tenantId: getTenantId(),
      page: currentEventsPage.value.toString(),
      limit: currentEventsLimit.value.toString(),
    });

    // Добавить фильтры
    if (currentEventsFilter.value) {
      const filterParts = currentEventsFilter.value.split('=');
      if (filterParts.length === 2) {
        params.append(filterParts[0].trim(), filterParts[1].trim());
      }
    }

    const url = getControlApiUrl(`/api/events?${params.toString()}`);
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const result = await response.json();
    const eventsData = result.data || [];
    const pagination = result.pagination || {};

    currentEventsPage.value = pagination.page || 1;
    currentEventsPageInput.value = currentEventsPage.value;
    eventsTotalPages.value = pagination.pages || 1;
    events.value = eventsData;
  } catch (error) {
    eventsError.value = error instanceof Error ? error.message : 'Unknown error';
    events.value = [];
  } finally {
    loadingEvents.value = false;
  }
}

// Загрузить обновления
async function loadUpdates() {
  loadingUpdates.value = true;
  updatesError.value = null;
  
  try {
    const params = new URLSearchParams({
      tenantId: getTenantId(),
      page: currentUpdatesPage.value.toString(),
      limit: currentUpdatesLimit.value.toString(),
    });

    // Если выбрано событие, фильтруем по eventId
    if (selectedEventId.value) {
      params.append('eventId', selectedEventId.value);
    }

    // Добавить фильтры
    if (currentUpdatesFilter.value) {
      const filterParts = currentUpdatesFilter.value.split('=');
      if (filterParts.length === 2) {
        params.append(filterParts[0].trim(), filterParts[1].trim());
      }
    }

    const url = getControlApiUrl(`/api/updates?${params.toString()}`);
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const result = await response.json();
    const updatesData = result.data || [];
    const pagination = result.pagination || {};

    currentUpdatesPage.value = pagination.page || 1;
    currentUpdatesPageInput.value = currentUpdatesPage.value;
    updatesTotalPages.value = pagination.pages || 1;
    updates.value = updatesData;
  } catch (error) {
    updatesError.value = error instanceof Error ? error.message : 'Unknown error';
    updates.value = [];
  } finally {
    loadingUpdates.value = false;
  }
}

// Выбрать событие и загрузить связанные обновления
function selectEvent(eventId: string) {
  selectedEventId.value = eventId;
  currentUpdatesPage.value = 1;
  loadUpdates();
}

// Показать обновления для события
function showEventUpdates(eventId: string) {
  selectEvent(eventId);
}

// Перейти на страницу
function goToPage(type: 'events' | 'updates', page: number) {
  if (type === 'events') {
    if (page < 1 || page > eventsTotalPages.value) return;
    currentEventsPage.value = page;
    currentEventsPageInput.value = page;
    loadEvents();
  } else {
    if (page < 1 || page > updatesTotalPages.value) return;
    currentUpdatesPage.value = page;
    currentUpdatesPageInput.value = page;
    loadUpdates();
  }
}

// Изменить лимит
function changeLimit(type: 'events' | 'updates') {
  if (type === 'events') {
    currentEventsPage.value = 1;
    currentEventsPageInput.value = 1;
    loadEvents();
  } else {
    currentUpdatesPage.value = 1;
    currentUpdatesPageInput.value = 1;
    loadUpdates();
  }
}

// Установить пример фильтра
function setFilterExample(type: 'events' | 'updates', field: string, value: string) {
  if (type === 'events') {
    eventsFilterInput.value = `${field}=${value}`;
  } else {
    updatesFilterInput.value = `${field}=${value}`;
  }
}

// Очистить фильтр
function clearFilter(type: 'events' | 'updates') {
  if (type === 'events') {
    eventsFilterInput.value = '';
    currentEventsFilter.value = '';
    eventsFilterApplied.value = false;
    currentEventsPage.value = 1;
    currentEventsPageInput.value = 1;
    loadEvents();
  } else {
    updatesFilterInput.value = '';
    currentUpdatesFilter.value = '';
    updatesFilterApplied.value = false;
    currentUpdatesPage.value = 1;
    currentUpdatesPageInput.value = 1;
    loadUpdates();
  }
}

// Применить фильтр
function applyFilter(type: 'events' | 'updates') {
  if (type === 'events') {
    currentEventsFilter.value = eventsFilterInput.value.trim();
    eventsFilterApplied.value = true;
    currentEventsPage.value = 1;
    currentEventsPageInput.value = 1;
    loadEvents();
    setTimeout(() => {
      eventsFilterApplied.value = false;
    }, 1000);
  } else {
    currentUpdatesFilter.value = updatesFilterInput.value.trim();
    updatesFilterApplied.value = true;
    currentUpdatesPage.value = 1;
    currentUpdatesPageInput.value = 1;
    loadUpdates();
    setTimeout(() => {
      updatesFilterApplied.value = false;
    }, 1000);
  }
}

// Сортировка (заглушка)
function sortEvents(field: string) {
  // TODO: реализовать сортировку
}

function sortUpdates(field: string) {
  // TODO: реализовать сортировку
}

// Показать JSON события
function showEventJson(eventId: string, eventJson: any) {
  const params = new URLSearchParams({
    tenantId: getTenantId(),
    page: currentEventsPage.value.toString(),
    limit: currentEventsLimit.value.toString(),
  });
  jsonModalUrl.value = getControlApiUrl(`/api/events?${params.toString()}`);
  jsonModalContent.value = JSON.stringify(eventJson, null, 2);
  showJsonModalFlag.value = true;
}

// Показать JSON обновления
function showUpdateJson(updateId: string, updateJson: any) {
  const params = new URLSearchParams({
    tenantId: getTenantId(),
    page: currentUpdatesPage.value.toString(),
    limit: currentUpdatesLimit.value.toString(),
  });
  if (selectedEventId.value) {
    params.append('eventId', selectedEventId.value);
  }
  jsonModalUrl.value = getControlApiUrl(`/api/updates?${params.toString()}`);
  jsonModalContent.value = JSON.stringify(updateJson, null, 2);
  showJsonModalFlag.value = true;
}

// Закрыть модальное окно JSON
function closeJsonModal() {
  showJsonModalFlag.value = false;
  jsonModalUrl.value = '';
  jsonModalContent.value = '';
}

// Показать модальное окно URL
function showUrlModal(type: 'events' | 'updates') {
  let url = '';
  
  if (type === 'events') {
    const params = new URLSearchParams({
      tenantId: getTenantId(),
      page: currentEventsPage.value.toString(),
      limit: currentEventsLimit.value.toString(),
    });
    if (currentEventsFilter.value) {
      const filterParts = currentEventsFilter.value.split('=');
      if (filterParts.length === 2) {
        params.append(filterParts[0].trim(), filterParts[1].trim());
      }
    }
    url = getControlApiUrl(`/api/events?${params.toString()}`);
  } else {
    const params = new URLSearchParams({
      tenantId: getTenantId(),
      page: currentUpdatesPage.value.toString(),
      limit: currentUpdatesLimit.value.toString(),
    });
    if (selectedEventId.value) {
      params.append('eventId', selectedEventId.value);
    }
    if (currentUpdatesFilter.value) {
      const filterParts = currentUpdatesFilter.value.split('=');
      if (filterParts.length === 2) {
        params.append(filterParts[0].trim(), filterParts[1].trim());
      }
    }
    url = getControlApiUrl(`/api/updates?${params.toString()}`);
  }
  
  urlModalContent.value = url;
  showUrlModalFlag.value = true;
}

// Закрыть модальное окно URL
function closeUrlModal() {
  showUrlModalFlag.value = false;
  urlModalContent.value = '';
}

// Копировать URL
async function copyUrl() {
  try {
    await navigator.clipboard.writeText(urlModalContent.value);
    alert('URL скопирован в буфер обмена');
  } catch (error) {
    console.error('Error copying URL:', error);
  }
}

// Копировать JSON
async function copyJson() {
  try {
    await navigator.clipboard.writeText(jsonModalContent.value);
    alert('JSON скопирован в буфер обмена');
  } catch (error) {
    console.error('Error copying JSON:', error);
  }
}

// Форматировать timestamp
function formatTimestamp(ts: string | number | null | undefined) {
  if (!ts) return '-';
  const timestamp = typeof ts === 'string' ? parseFloat(ts) : ts;
  const date = new Date(Math.floor(timestamp));
  return date.toLocaleString('ru-RU');
}

// Синхронизация currentEventsPageInput с currentEventsPage
watch(currentEventsPage, (newPage) => {
  currentEventsPageInput.value = newPage;
});

// Синхронизация currentUpdatesPageInput с currentUpdatesPage
watch(currentUpdatesPage, (newPage) => {
  currentUpdatesPageInput.value = newPage;
});

// Инициализация
onMounted(() => {
  credentialsStore.loadFromStorage();
  loadEvents();
  loadUpdates();

  // Закрытие модальных окон по Esc
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeUrlModal();
      closeJsonModal();
    }
  });
});
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

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}

.filter-form {
  padding: 15px;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
}

.filter-row {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 10px;
}

.filter-row:last-child {
  margin-bottom: 0;
}

.filter-examples {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.filter-example {
  padding: 4px 8px;
  background: #e9ecef;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
}

.filter-example:hover {
  background: #dee2e6;
}

.filter-input-group {
  flex: 1;
  display: flex;
  gap: 5px;
  align-items: center;
  position: relative;
}

.filter-input {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 12px;
}

.filter-input:focus {
  outline: none;
  border-color: #667eea;
}

.filter-clear {
  position: absolute;
  right: 30px;
  background: none;
  border: none;
  cursor: pointer;
  color: #6c757d;
  font-size: 16px;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.filter-clear:hover {
  color: #495057;
}

.filter-apply {
  padding: 6px 12px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
}

.filter-apply:hover {
  background: #5568d3;
}

.filter-apply.active {
  background: #28a745;
}

.pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  gap: 8px;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
  font-size: 11px;
}

.pagination-info {
  color: #6c757d;
  font-size: 11px;
  white-space: nowrap;
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.pagination button {
  padding: 4px 8px;
  border: 1px solid #ced4da;
  background: white;
  cursor: pointer;
  border-radius: 3px;
  font-size: 11px;
  min-width: 28px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pagination button:hover:not(:disabled) {
  background: #e9ecef;
}

.pagination button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.pagination input[type="number"] {
  width: 50px;
  padding: 3px 6px;
  border: 1px solid #ced4da;
  border-radius: 3px;
  font-size: 11px;
  text-align: center;
}

.pagination select {
  padding: 3px 6px;
  border: 1px solid #ced4da;
  border-radius: 3px;
  font-size: 11px;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th, td {
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

.sort-indicator.active {
  color: #667eea;
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

.loading, .error, .no-data {
  padding: 40px 20px;
  text-align: center;
  color: #6c757d;
}

.error {
  color: #dc3545;
}

.modal {
  position: fixed;
  z-index: 1000;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0,0,0,0.5);
}

.modal-content {
  background-color: white;
  margin: 5% auto;
  padding: 0;
  border-radius: 8px;
  width: 80%;
  max-width: 900px;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  padding: 20px;
  border-bottom: 1px solid #e9ecef;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-title {
  font-size: 18px;
  font-weight: 600;
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #6c757d;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-close:hover {
  color: #495057;
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.modal-url {
  padding: 10px;
  background: #f8f9fa;
  border-radius: 4px;
  margin-bottom: 15px;
  font-family: monospace;
  font-size: 12px;
  word-break: break-all;
}

.json-viewer {
  background: #f8f9fa;
  padding: 15px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
  white-space: pre-wrap;
  word-wrap: break-word;
  max-height: 60vh;
  overflow-y: auto;
}

.btn-copy {
  margin-top: 10px;
  padding: 8px 16px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.btn-copy:hover {
  background: #5568d3;
}
</style>
