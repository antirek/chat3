<template>
  <div class="messages-page">
    <div class="page-header">
      <div class="page-header-left">
        <h1>📝 Сообщения</h1>
      </div>
      <div class="page-header-right">
        <button class="btn-primary btn-small" @click="showUrlModal">🔗 URL</button>
      </div>
    </div>

    <div class="page-container">
      <div class="filter-panel">
        <div class="form-section">
          <label for="messageFilterInput">
            🔍 Фильтр сообщений (формат: <code>(поле,оператор,значение)</code>)
          </label>
          <select
            id="messageFilterExample"
            v-model="selectedFilterExample"
            @change="selectMessageFilterExample"
            style="margin-bottom: 8px;"
          >
            <option value="">Выберите пример фильтра</option>
            <option value="(content,regex,встретимся)">📝 Содержит "встретимся"</option>
            <option value="(content,regex,спасибо)">📝 Содержит "спасибо"</option>
            <option value="(content,regex,привет)">📝 Содержит "привет"</option>
            <option value="(content,regex,хорошо)">📝 Содержит "хорошо"</option>
            <option value="(content,regex,интересно)">📝 Содержит "интересно"</option>
            <option value="(content,regex,отлично)">📝 Содержит "отлично"</option>
            <option value="(type,eq,internal.text)">📝 Тип = internal.text</option>
            <option value="(type,eq,system)">📝 Тип = system</option>
            <option value="(type,in,[text,system])">📝 Тип в [text,system]</option>
            <option value="(senderId,eq,carl)">👤 Отправитель = carl</option>
            <option value="(senderId,eq,sara)">👤 Отправитель = sara</option>
            <option value="(senderId,in,[carl,marta])">👥 Отправитель в [carl,marta]</option>
            <option value="(dialogId,eq,dlg_nfftyjrk53nn5w4bc94n)">💬 Диалог = Общий чат</option>
            <option value="(dialogId,eq,dlg_xndr7w5fhvazpvi8a35p)">💬 Диалог = Проектные обсуждения</option>
            <option value="(dialogId,eq,dlg_1qdl3ymr68r2ebve4tqt)">💬 Диалог = Техподдержка</option>
            <option value="(dialogId,in,[dlg_nfftyjrk53nn5w4bc94n,dlg_xndr7w5fhvazpvi8a35p])">💬 Диалог в [Общий чат,Проектные обсуждения]</option>
            <option value="(meta.channelType,eq,whatsapp)">📱 WhatsApp сообщения</option>
            <option value="(meta.channelType,eq,telegram)">📱 Telegram сообщения</option>
            <option value="(meta.channelId,eq,W0000)">📱 Канал W0000</option>
            <option value="(meta.channelId,eq,TG0000)">📱 Канал TG0000</option>
            <option value="(meta.channelType,in,[whatsapp,telegram])">📱 WhatsApp или Telegram</option>
            <option value="(createdAt,gte,2025-10-24)">📅 Создано ≥ 24.10.2025</option>
            <option value="(createdAt,gte,2025-10-22)">📅 Создано ≥ 22.10.2025</option>
            <option value="(createdAt,lt,2025-10-21)">📅 Создано < 21.10.2025</option>
            <option value="(content,regex,встретимся)&(type,eq,system)">📝 "встретимся" + system</option>
            <option value="(senderId,eq,carl)&(type,eq,system)">👤 Carl + system</option>
            <option value="(content,regex,спасибо)&(createdAt,gte,2025-10-24)">📝 "спасибо" + ≥24.10</option>
            <option value="(senderId,in,[carl,sara])&(type,eq,internal.text)&(content,regex,привет)">👥 Carl/Sara + internal.text + "привет"</option>
            <option value="(dialogId,eq,dlg_nfftyjrk53nn5w4bc94n)&(senderId,eq,carl)">💬 Общий чат + Carl</option>
            <option value="(dialogId,eq,dlg_xndr7w5fhvazpvi8a35p)&(type,eq,internal.text)">💬 Проектные обсуждения + internal.text</option>
            <option value="(dialogId,in,[dlg_nfftyjrk53nn5w4bc94n,dlg_xndr7w5fhvazpvi8a35p])&(senderId,eq,marta)">💬 Общий чат/Проектные + Marta</option>
            <option value="(meta.channelType,eq,whatsapp)&(senderId,eq,carl)">📱 WhatsApp + Carl</option>
            <option value="(meta.channelType,eq,telegram)&(type,eq,internal.text)">📱 Telegram + internal.text</option>
            <option value="(meta.channelId,eq,W0000)&(content,regex,привет)">📱 W0000 + "привет"</option>
            <option value="(meta.channelType,in,[whatsapp,telegram])&(senderId,in,[carl,sara])">📱 WhatsApp/Telegram + Carl/Sara</option>
            <option value="(dialogId,eq,dlg_nfftyjrk53nn5w4bc94n)&(meta.channelType,eq,telegram)">💬 Общий чат + Telegram</option>
            <option value="(meta.channelId,eq,TG0000)&(type,eq,system)">📱 TG0000 + system</option>
            <option value="(dialogId,in,[dlg_nfftyjrk53nn5w4bc94n,dlg_xndr7w5fhvazpvi8a35p])&(senderId,in,[carl,marta])&(meta.channelType,eq,telegram)">💬 2 диалога + 2 отправителя + Telegram</option>
            <option value="custom">✏️ Пользовательский фильтр</option>
          </select>
          <div class="input-with-clear" style="margin-bottom: 8px;">
            <input
              type="text"
              id="messageFilterInput"
              v-model="filterInput"
              placeholder="Введите или выберите фильтр сообщений"
              @keydown.enter="applyMessageFilter"
            />
            <button
              class="clear-field"
              type="button"
              @click="clearMessageFilter"
              title="Очистить поле"
            >
              ✕
            </button>
          </div>
          <small style="display: block; color: #6c757d;">
            Поддерживаются поля `content`, `type`, `senderId`, `dialogId`, `meta.*`, `createdAt`. Операторы: eq, ne, in, nin, regex, gt, lt, gte, lte.
          </small>
        </div>
        <div class="form-actions">
          <button class="btn-primary" type="button" @click="applyMessageFilter">Применить</button>
        </div>
      </div>

      <div class="pagination" id="messagesPagination">
        <div class="pagination-controls">
          <button
            @click="goToPreviousPage"
            :disabled="currentPage <= 1"
          >
            ← Предыдущая
          </button>
          <button
            v-for="pageNum in visiblePages"
            :key="pageNum"
            :class="{ active: pageNum === currentPage }"
            @click="goToPage(pageNum)"
          >
            {{ pageNum }}
          </button>
          <button
            @click="goToNextPage"
            :disabled="currentPage >= totalPages"
          >
            Следующая →
          </button>
        </div>
        <span class="pagination-info">
          Страница {{ currentPage }} из {{ totalPages }} (всего {{ totalMessages }} сообщений)
        </span>
      </div>

      <div class="content" id="messagesList">
        <div v-if="loading" class="loading">Загрузка...</div>
        <div v-else-if="error" class="error">Ошибка загрузки: {{ error }}</div>
        <div v-else-if="messages.length === 0" class="no-data">Сообщения не найдены</div>
        <table v-else>
          <thead>
            <tr>
              <th>ID сообщения</th>
              <th>Диалог</th>
              <th>Отправитель</th>
              <th @click="toggleSort('createdAt')" style="cursor: pointer;">
                Время
                <span class="sort-indicator">{{ getSortIndicator('createdAt') }}</span>
              </th>
              <th>Содержимое</th>
              <th>Тип</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="message in messages" :key="message.messageId">
              <td class="message-id">{{ message.messageId }}</td>
              <td>{{ getDialogName(message.dialogId) }}</td>
              <td>{{ message.senderId }}</td>
              <td>{{ formatTimestamp(message.createdAt) }}</td>
              <td class="message-content">{{ message.content }}</td>
              <td>{{ message.type }}</td>
              <td>
                <button class="info-button" @click="showInfoModal(message.messageId)">
                  ℹ️ Инфо
                </button>
                <button class="btn-success btn-small" @click="showMetaModal(message.messageId)">
                  🏷️ Мета
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal для просмотра информации о сообщении -->
    <div v-if="showInfoModalFlag" class="modal" @click.self="closeInfoModal">
      <div class="modal-content" style="max-width: 1200px;" @click.stop>
        <div class="modal-header">
          <h2 class="modal-title">Информация о сообщении</h2>
          <button class="modal-close" @click="closeInfoModal" title="Закрыть">×</button>
        </div>
        <div class="modal-body">
          <div
            class="info-url"
            style="margin-bottom: 15px; padding: 8px; background: #f8f9fa; border-radius: 4px; font-family: monospace; font-size: 12px; word-break: break-all; color: #495057;"
          >
            {{ infoUrl }}
          </div>
          <div class="json-viewer" id="jsonViewer">{{ jsonViewerContent }}</div>
          <div class="form-actions" style="margin-top: 15px;">
            <button
              type="button"
              class="btn-primary"
              id="copyJsonButton"
              @click="copyJsonToClipboard"
              style="margin-right: 10px;"
            >
              {{ copyJsonButtonText }}
            </button>
            <button type="button" class="btn-secondary" @click="closeInfoModal">Закрыть</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal для управления meta тегами сообщения -->
    <div v-if="showMetaModalFlag" class="modal" @click.self="closeMetaModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2>🏷️ Meta теги сообщения</h2>
          <button class="modal-close" @click="closeMetaModal" title="Закрыть">×</button>
        </div>
        <div class="modal-body">
          <div class="meta-list" id="messageMetaList">
            <h3 v-if="metaTags" style="margin-bottom: 15px; font-size: 14px;">Текущие Meta теги:</h3>
            <div v-if="!metaTags || Object.keys(metaTags).length === 0" class="no-data" style="padding: 20px;">
              Meta теги отсутствуют
            </div>
            <table v-else>
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Value</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(value, key) in metaTags" :key="key">
                  <td><strong>{{ key }}</strong></td>
                  <td>{{ JSON.stringify(value) }}</td>
                  <td>
                    <button class="btn-danger btn-small" @click="deleteMetaTag(key)">
                      🗑️ Удалить
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="meta-section">
            <h3>Добавить Meta тег</h3>
            <div class="meta-tag-row">
              <input
                type="text"
                id="newMessageMetaKey"
                v-model="newMetaKeyForEdit"
                placeholder="key (например: channelType)"
              />
              <input
                type="text"
                id="newMessageMetaValue"
                v-model="newMetaValueForEdit"
                placeholder="value (например: whatsapp)"
              />
              <button class="btn-success btn-small" @click="addMetaTag">➕ Добавить</button>
            </div>
          </div>
          <div class="form-actions">
            <button type="button" class="btn-secondary" @click="closeMetaModal">Закрыть</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal для просмотра URL -->
    <div v-if="showUrlModalFlag" class="modal" @click.self="closeUrlModal">
      <div class="modal-content" style="max-width: 800px;" @click.stop>
        <div class="modal-header">
          <h2>🔗 URL запроса к API</h2>
          <button class="modal-close" @click="closeUrlModal" title="Закрыть">×</button>
        </div>
        <div class="modal-body">
          <div class="url-info">
            <h4>API Endpoint:</h4>
            <div class="url-display">{{ generatedUrl }}</div>
            <h4>Параметры:</h4>
            <div class="params-list">
              <div><strong>page:</strong> {{ currentPage }}</div>
              <div><strong>limit:</strong> {{ currentLimit }}</div>
              <div v-if="currentFilter"><strong>filter:</strong> {{ currentFilter }}</div>
              <div v-if="currentSort"><strong>sort:</strong> {{ currentSort }}</div>
            </div>
            <h4>Полный URL для копирования:</h4>
            <div class="url-copy">
              <input
                type="text"
                :value="fullUrl"
                readonly
                @click="($event.target as HTMLInputElement).select()"
                style="width: 100%; padding: 8px; font-family: monospace; font-size: 12px;"
              />
              <button
                @click="copyUrlToClipboard"
                style="margin-top: 8px; padding: 6px 12px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;"
              >
                {{ copyUrlButtonText }}
              </button>
            </div>
          </div>
          <div class="form-actions" style="margin-top: 15px;">
            <button type="button" class="btn-secondary" @click="closeUrlModal">Закрыть</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, toRef } from 'vue';
import { useConfigStore } from '@/app/stores/config';
import { useCredentialsStore } from '@/app/stores/credentials';

// Конфигурация
const configStore = useConfigStore();
const credentialsStore = useCredentialsStore();

// Используем credentials из store (toRef для правильной типизации)
const apiKey = toRef(credentialsStore, 'apiKey');
const tenantId = toRef(credentialsStore, 'tenantId');

// Состояние
const currentPage = ref(1);
const currentLimit = ref(20);
const totalPages = ref(1);
const totalMessages = ref(0);
const messages = ref<any[]>([]);
const dialogs = ref<any[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

// Фильтры и сортировка
const currentFilter = ref('');
const filterInput = ref('');
const selectedFilterExample = ref('');
const currentSort = ref<string | null>(null);

// Модальные окна
const showInfoModalFlag = ref(false);
const showMetaModalFlag = ref(false);
const showUrlModalFlag = ref(false);

// Info modal
const infoUrl = ref('');
const jsonViewerContent = ref('');
const currentJsonForCopy = ref('');
const copyJsonButtonText = ref('📋 Копировать JSON');

// Meta теги
const metaMessageId = ref('');
const metaTags = ref<Record<string, any> | null>(null);
const newMetaKeyForEdit = ref('');
const newMetaValueForEdit = ref('');

// URL modal
const generatedUrl = ref('');
const copyUrlButtonText = ref('📋 Скопировать');

// Computed
const visiblePages = computed(() => {
  const startPage = Math.max(1, currentPage.value - 2);
  const endPage = Math.min(totalPages.value, currentPage.value + 2);
  const pages: number[] = [];
  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }
  return pages;
});

const fullUrl = computed(() => {
  const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
  return `${baseUrl}${generatedUrl.value}`;
});

// Функции
function getUrlParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    apiKey: params.get('apiKey') || '',
    tenantId: params.get('tenantId') || 'tnt_default',
  };
}

function setApiKeyFromExternal(extApiKey: string, extTenantId?: string) {
  if (!extApiKey) {
    console.warn('API Key не предоставлен');
    return;
  }

  credentialsStore.setCredentials(extApiKey, extTenantId);

  console.log('API Key set from external:', apiKey.value);
  console.log('Tenant ID set from external:', tenantId.value);

  loadMessages(1);
}

function getApiKey() {
  return apiKey.value;
}

async function loadDialogs() {
  try {
    const key = getApiKey();
    if (!key) {
      return;
    }

    const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/dialogs?limit=100`, {
      headers: credentialsStore.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    dialogs.value = data.data || [];
  } catch (error) {
    console.error('Error loading dialogs:', error);
  }
}

async function loadMessages(page = currentPage.value) {
  try {
    const key = getApiKey();

    if (!key) {
      throw new Error('API Key не указан');
    }

    currentPage.value = page;
    loading.value = true;
    error.value = null;

    const params = new URLSearchParams({
      page: page.toString(),
      limit: currentLimit.value.toString(),
    });

    if (currentFilter.value) {
      params.append('filter', currentFilter.value);
    }

    if (currentSort.value) {
      params.append('sort', currentSort.value);
    }

    const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/messages?${params.toString()}`, {
      headers: credentialsStore.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    totalMessages.value = data.pagination?.total || 0;
    totalPages.value = data.pagination?.pages || 1;

    if (data.data && data.data.length > 0) {
      messages.value = data.data;
    } else {
      messages.value = [];
    }
  } catch (err) {
    console.error('Error loading messages:', err);
    error.value = err instanceof Error ? err.message : 'Ошибка загрузки';
    messages.value = [];
  } finally {
    loading.value = false;
  }
}

function goToPreviousPage() {
  if (currentPage.value > 1) {
    loadMessages(currentPage.value - 1);
  }
}

function goToNextPage() {
  if (currentPage.value < totalPages.value) {
    loadMessages(currentPage.value + 1);
  }
}

function goToPage(page: number) {
  if (page >= 1 && page <= totalPages.value) {
    loadMessages(page);
  }
}

function getDialogName(dialogId: string) {
  const dialog = dialogs.value.find((d) => d.dialogId === dialogId);
  return dialog ? dialog.dialogId : dialogId;
}

function formatTimestamp(timestamp: string | number | undefined) {
  if (!timestamp) return '-';
  const ts = typeof timestamp === 'string' ? parseFloat(timestamp) : timestamp;
  const date = new Date(ts);
  return date.toLocaleString('ru-RU');
}

function getSortIndicator(field: string) {
  if (!currentSort.value || !currentSort.value.includes(field)) {
    return '◄';
  } else if (currentSort.value.includes('asc')) {
    return '▲';
  } else {
    return '▼';
  }
}

function toggleSort(field: string) {
  if (!currentSort.value || !currentSort.value.includes(field)) {
    currentSort.value = `(${field},asc)`;
  } else if (currentSort.value.includes('asc')) {
    currentSort.value = `(${field},desc)`;
  } else {
    currentSort.value = null;
  }
  loadMessages(1);
}

function selectMessageFilterExample() {
  if (selectedFilterExample.value && selectedFilterExample.value !== 'custom') {
    filterInput.value = selectedFilterExample.value;
  } else if (selectedFilterExample.value === 'custom') {
    filterInput.value = '';
  }
}

function clearMessageFilter() {
  filterInput.value = '';
  selectedFilterExample.value = '';
  currentFilter.value = '';
  currentSort.value = null;
  loadMessages(1);
}

function applyMessageFilter() {
  const filterValue = filterInput.value.trim();

  if (!filterValue) {
    alert('Введите фильтр сообщений');
    return;
  }

  currentFilter.value = filterValue;
  currentPage.value = 1;
  loadMessages(1);
}

async function showInfoModal(messageId: string) {
  try {
    const key = getApiKey();
    const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
    const url = `${baseUrl}/api/messages/${messageId}`;

    infoUrl.value = url;

    const messageResponse = await fetch(url, {
      headers: credentialsStore.getHeaders(),
    });

    const responseData = await messageResponse.json();

    if (!messageResponse.ok) {
      const errorJson = JSON.stringify(
        {
          status: messageResponse.status,
          statusText: messageResponse.statusText,
          error: responseData,
        },
        null,
        2,
      );
      jsonViewerContent.value = errorJson;
      currentJsonForCopy.value = errorJson;
    } else {
      const jsonStr = JSON.stringify(responseData, null, 2);
      jsonViewerContent.value = jsonStr;
      currentJsonForCopy.value = jsonStr;
    }

    showInfoModalFlag.value = true;
    copyJsonButtonText.value = '📋 Копировать JSON';
  } catch (err) {
    console.error('Error loading message info:', err);
    const errorJson = JSON.stringify(
      {
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      null,
      2,
    );
    jsonViewerContent.value = errorJson;
    currentJsonForCopy.value = errorJson;
    showInfoModalFlag.value = true;
  }
}

function closeInfoModal() {
  showInfoModalFlag.value = false;
}

async function copyJsonToClipboard() {
  const jsonText = jsonViewerContent.value || currentJsonForCopy.value;

  if (!jsonText) {
    alert('Нет данных для копирования');
    return;
  }

  try {
    await navigator.clipboard.writeText(jsonText);
    copyJsonButtonText.value = '✅ Скопировано!';
    setTimeout(() => {
      copyJsonButtonText.value = '📋 Копировать JSON';
    }, 2000);
  } catch (err) {
    console.error('Failed to copy JSON:', err);
    alert('Не удалось скопировать JSON');
  }
}

async function showMetaModal(messageId: string) {
  metaMessageId.value = messageId;
  showMetaModalFlag.value = true;
  await loadMetaTags(messageId);
}

function closeMetaModal() {
  showMetaModalFlag.value = false;
  metaTags.value = null;
  newMetaKeyForEdit.value = '';
  newMetaValueForEdit.value = '';
}

async function loadMetaTags(messageId: string) {
  try {
    const key = getApiKey();
    const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';

    const response = await fetch(`${baseUrl}/api/messages/${messageId}`, {
      headers: credentialsStore.getHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to load message meta');
    }

    const { data: message } = await response.json();
    const meta = message.meta || {};
    metaTags.value = meta;
  } catch (err) {
    console.error('Error loading meta tags:', err);
    metaTags.value = null;
  }
}

async function addMetaTag() {
  const messageId = metaMessageId.value;
  const key = newMetaKeyForEdit.value.trim();
  const valueStr = newMetaValueForEdit.value.trim();

  if (!key || !valueStr) {
    alert('Заполните ключ и значение');
    return;
  }

  let value: any;
  try {
    value = JSON.parse(valueStr);
  } catch (e) {
    value = valueStr;
  }

  try {
    const apiKeyValue = getApiKey();
    const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';

    const response = await fetch(`${baseUrl}/api/meta/message/${messageId}/${key}`, {
      method: 'PUT',
      headers: {
        ...credentialsStore.getHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ value }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to set meta tag');
    }

    newMetaKeyForEdit.value = '';
    newMetaValueForEdit.value = '';
    await loadMetaTags(messageId);
    alert('Meta тег успешно добавлен!');
  } catch (err) {
    console.error('Error adding meta tag:', err);
    alert('Ошибка добавления meta тега: ' + (err instanceof Error ? err.message : 'Unknown error'));
  }
}

async function deleteMetaTag(key: string) {
  if (!confirm(`Удалить meta тег "${key}"?`)) {
    return;
  }

  try {
    const apiKeyValue = getApiKey();
    const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';

    const response = await fetch(`${baseUrl}/api/meta/message/${metaMessageId.value}/${key}`, {
      method: 'DELETE',
      headers: credentialsStore.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete meta tag');
    }

    await loadMetaTags(metaMessageId.value);
    alert('Meta тег успешно удален!');
  } catch (err) {
    console.error('Error deleting meta tag:', err);
    alert('Ошибка удаления meta тега: ' + (err instanceof Error ? err.message : 'Unknown error'));
  }
}

function generateApiUrl() {
  const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
  const params = new URLSearchParams({
    page: currentPage.value.toString(),
    limit: currentLimit.value.toString(),
  });

  if (currentFilter.value) {
    params.append('filter', currentFilter.value);
  }

  if (currentSort.value) {
    params.append('sort', currentSort.value);
  }

  return `/api/messages?${params.toString()}`;
}

function showUrlModal() {
  generatedUrl.value = generateApiUrl();
  showUrlModalFlag.value = true;
  copyUrlButtonText.value = '📋 Скопировать';
}

function closeUrlModal() {
  showUrlModalFlag.value = false;
}

async function copyUrlToClipboard() {
  const url = fullUrl.value;
  try {
    await navigator.clipboard.writeText(url);
    copyUrlButtonText.value = '✓ Скопировано!';
    setTimeout(() => {
      copyUrlButtonText.value = '📋 Скопировать';
    }, 2000);
  } catch (err) {
    console.error('Ошибка копирования:', err);
    alert('Не удалось скопировать URL');
  }
}

// Инициализация
onMounted(() => {
  // Загружаем credentials из store (они уже загружены из localStorage при создании store)
  credentialsStore.loadFromStorage();

  // Загружаем диалоги
  if (apiKey.value) {
    loadDialogs();
  }

  // Проверяем URL параметры (для обратной совместимости с iframe)
  const params = getUrlParams();
  if (params.apiKey) {
    setApiKeyFromExternal(params.apiKey, params.tenantId);
  } else {
    // Если нет URL параметров, но есть API Key в store, загружаем сообщения
    const key = getApiKey();
    if (key) {
      loadMessages(1);
    }
  }

  // Обработка сообщений от родительского окна (для обратной совместимости)
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'setApiCredentials') {
      setApiKeyFromExternal(event.data.apiKey, event.data.tenantId);
    }
  });

  // Закрытие модальных окон при нажатии Esc
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' || event.key === 'Esc') {
      if (showInfoModalFlag.value) {
        closeInfoModal();
      } else if (showMetaModalFlag.value) {
        closeMetaModal();
      } else if (showUrlModalFlag.value) {
        closeUrlModal();
      }
    }
  });
});
</script>

<style scoped>
/* Переносим все стили из оригинального HTML */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.messages-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.page-header {
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

.page-header-left {
  display: flex;
  align-items: center;
  gap: 15px;
}

.page-header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.page-header h1 {
  font-size: 16px;
  color: #495057;
  font-weight: 600;
}

.page-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: white;
  overflow: hidden;
}

button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #667eea;
  color: white;
  border: none;
}

.btn-primary:hover:not(:disabled) {
  background: #5a6fd8;
}

.btn-success {
  background: #48bb78;
  color: white;
}

.btn-success:hover:not(:disabled) {
  background: #38a169;
}

.btn-danger {
  background: #dc3545;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #c82333;
}

.btn-secondary {
  background: #6c757d;
  color: white;
  border: none;
}

.btn-secondary:hover:not(:disabled) {
  background: #5a6268;
}

.btn-secondary.active {
  background: #667eea;
  color: white;
  border-color: #667eea;
}

.btn-small {
  padding: 4px 10px;
  font-size: 11px;
  margin-right: 5px;
}

.content {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}

table {
  width: 100%;
  border-collapse: collapse;
}

thead {
  background: #f8f9fa;
  position: sticky;
  top: 0;
  z-index: 10;
}

th {
  padding: 12px 15px;
  text-align: left;
  font-weight: 600;
  color: #495057;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 2px solid #e9ecef;
}

th[style*='cursor: pointer'] {
  cursor: pointer;
  user-select: none;
}

th[style*='cursor: pointer']:hover {
  background: #e9ecef;
}

td {
  padding: 12px 15px;
  border-bottom: 1px solid #e9ecef;
  font-size: 13px;
}

tr:hover {
  background: #f8f9fa;
}

.no-data {
  text-align: center;
  padding: 40px;
  color: #6c757d;
  font-size: 14px;
}

.loading {
  text-align: center;
  padding: 40px;
  color: #667eea;
  font-size: 14px;
}

.error {
  background: #f8d7da;
  color: #721c24;
  padding: 15px;
  border-radius: 6px;
  margin: 15px;
  font-size: 13px;
}

.message-content {
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.message-id {
  font-size: 13px;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #666;
}

.info-button {
  padding: 4px 10px;
  font-size: 11px;
  border: 1px solid #8ba0f5;
  background: #8ba0f5;
  color: white;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s;
  max-height: 25px;
  min-width: 69px;
}

.info-button:hover {
  background: #7c8ff0;
  border-color: #7c8ff0;
}

/* Modal */
.modal {
  position: fixed;
  z-index: 1000;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  animation: fadeIn 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.modal-content {
  background: white;
  margin: 50px auto;
  padding: 0;
  border-radius: 8px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  animation: slideIn 0.3s;
}

@keyframes slideIn {
  from {
    transform: translateY(-30px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.modal-header {
  padding: 15px 20px;
  background: #667eea;
  color: white;
  border-bottom: 1px solid #e9ecef;
  border-radius: 8px 8px 0 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-title {
  font-size: 18px;
  margin: 0;
  font-weight: 600;
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  color: white;
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.modal-close:hover {
  background: rgba(255, 255, 255, 0.2);
  opacity: 1;
}

.modal-body {
  padding: 20px;
}

.json-viewer {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  padding: 15px;
  max-height: 500px;
  overflow-y: auto;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.form-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 20px;
}

.form-actions button {
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
}

.pagination {
  padding: 15px 20px;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
}

.pagination-info {
  font-size: 11px;
  color: #666;
  margin-left: 10px;
}

.pagination-controls {
  display: flex;
  gap: 5px;
  align-items: center;
  flex-wrap: wrap;
}

.pagination button {
  padding: 5px 10px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.pagination button:hover:not(:disabled) {
  background: #e9ecef;
}

.pagination button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pagination button.active {
  background: #667eea;
  color: white;
  border-color: #667eea;
}

.filter-panel {
  padding: 15px 20px;
  border-bottom: 1px solid #e9ecef;
  background: #ffffff;
}

.filter-panel .form-section {
  margin-bottom: 12px;
}

.filter-panel label {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 500;
  color: #495057;
}

.filter-panel select,
.filter-panel input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 12px;
  background: white;
}

.filter-panel .input-with-clear {
  position: relative;
  display: flex;
  align-items: center;
}

.filter-panel .input-with-clear input {
  padding-right: 30px;
}

.filter-panel .clear-field {
  position: absolute;
  right: 5px;
  background: none;
  border: none;
  color: #6c757d;
  cursor: pointer;
  font-size: 16px;
  padding: 2px 6px;
  border-radius: 3px;
}

.filter-panel .clear-field:hover {
  background: #e9ecef;
  color: #333;
}

.filter-panel .form-actions {
  margin-top: 10px;
}

.sort-indicator {
  margin-left: 5px;
  font-size: 10px;
  color: #667eea;
}

.meta-section {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 2px solid #e9ecef;
}

.meta-section h3 {
  font-size: 14px;
  margin-bottom: 15px;
  color: #333;
}

.meta-tag-row {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
  align-items: center;
}

.meta-tag-row input {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 12px;
}

.meta-list {
  max-height: 300px;
  overflow-y: auto;
}

.url-info {
  margin-bottom: 15px;
}

.url-info h4 {
  margin: 15px 0 8px 0;
  color: #333;
  font-size: 14px;
}

.url-display {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  padding: 10px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  word-break: break-all;
  margin-bottom: 10px;
}

.params-list {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  padding: 10px;
  font-size: 12px;
  margin-bottom: 10px;
}

.params-list div {
  margin: 5px 0;
  font-family: 'Courier New', monospace;
  font-size: 12px;
}

.url-copy input {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  margin-bottom: 8px;
}
</style>
