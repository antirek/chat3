<template>
  <div class="dialogs-messages-page">
    <div class="container">
      <!-- Диалоги -->
      <div class="panel dialogs-panel">
        <div class="panel-header">
          <div class="header-left">
            <span>💬 Диалоги</span>
            <button @click="showAddDialogModal" class="url-button" title="Создать диалог">➕ Добавить</button>
          </div>
          <div class="header-right">
            <button @click="showCurrentUrl" class="url-button" title="Показать URL запроса">🔗 URL</button>
          </div>
        </div>

        <div class="filter-panel" id="combinedForm">
          <div class="form-section">
            <label>🔍 Фильтр:</label>
            <select id="filterExample" v-model="selectedFilterExample" @change="updateFilterInput">
              <option value="">Выберите пример фильтра</option>
              <option value="(meta.channelType,eq,whatsapp)">meta. Тип канала = whatsapp</option>
              <option value="(meta.channelType,ne,telegram)">meta. Тип канала ≠ telegram</option>
              <option value="(meta.type,eq,internal)">meta. Тип диалога = internal</option>
              <option value="(meta.type,ne,external)">meta. Тип диалога ≠ external</option>
              <option value="(meta.securityLevel,eq,high)">meta. Уровень безопасности = high</option>
              <option value="(meta.securityLevel,in,[high,medium])">meta. Уровень безопасности в [high,medium]</option>
              <option value="(meta.maxParticipants,gt,50)">meta. Макс. участников > 50</option>
              <option value="(meta.maxParticipants,gte,100)">meta. Макс. участников ≥ 100</option>
              <option value="(meta.channelType,regex,^whats)">meta. Тип канала начинается с 'whats'</option>
              <option value="(meta.channelType,eq,whatsapp)&(meta.securityLevel,in,[high,medium])">meta. WhatsApp + высокий/средний уровень безопасности</option>
              <option value="(meta.type,eq,internal)&(meta.maxParticipants,eq,50)">meta. Внутренний + 50 участников</option>
              <option value="(meta.channelType,eq,telegram)&(meta.securityLevel,eq,high)">meta. Telegram + высокий уровень безопасности</option>
              <option value="(member,eq,carl)">👤 Диалоги с Carl</option>
              <option value="(member,eq,marta)">👤 Диалоги с Marta</option>
              <option value="(member,eq,sara)">👤 Диалоги с Sara</option>
              <option value="(member,eq,kirk)">👤 Диалоги с Kirk</option>
              <option value="(member,eq,john)">👤 Диалоги с John</option>
              <option value="(member,in,[carl,marta])">👥 Диалоги с Carl или Marta</option>
              <option value="(member,in,[sara,kirk,john])">👥 Диалоги с Sara, Kirk или John</option>
              <option value="(member,all,[carl,marta])">👥 Диалоги с Carl И Marta (оба участника)</option>
              <option value="(member,all,[carl,sara,kirk])">👥 Диалоги с Carl, Sara И Kirk (все трое)</option>
              <option value="(member,eq,carl)&(meta.channelType,eq,whatsapp)">👤 Carl + WhatsApp</option>
              <option value="(member,eq,marta)&(meta.type,eq,internal)">👤 Marta + Внутренний</option>
              <option value="(member,eq,sara)&(meta.securityLevel,eq,high)">👤 Sara + Высокий уровень безопасности</option>
              <option value="(member,in,[carl,marta])&(meta.channelType,eq,telegram)">👥 Carl/Marta + Telegram</option>
              <option value="(member,eq,kirk)&(meta.maxParticipants,gte,50)">👤 Kirk + ≥50 участников</option>
              <option value="(member,eq,john)&(meta.channelType,eq,whatsapp)&(meta.securityLevel,eq,high)">👤 John + WhatsApp + Высокий уровень</option>
              <option value="(member,all,[carl,marta])&(meta.type,eq,internal)&(meta.maxParticipants,eq,50)">👥 Carl+Marta + Внутренний + 50 участников</option>
              <option value="(member,in,[sara,kirk])&(meta.channelType,in,[whatsapp,telegram])&(meta.securityLevel,in,[high,medium])">👥 Sara/Kirk + WhatsApp/Telegram + Высокий/Средний уровень</option>
              <option value="(member[carl].unreadCount,gte,4)&(meta.channelType,eq,whatsapp)">📬 Carl ≥4 непрочитанных + WhatsApp</option>
              <option value="(member[carl].unreadCount,eq,0)&(meta.type,eq,internal)">📬 Carl 0 непрочитанных + Внутренний</option>
              <option value="(member[carl].unreadCount,gte,2)&(meta.securityLevel,eq,high)">📬 Carl ≥2 непрочитанных + Высокий уровень</option>
              <option value="custom">Пользовательский фильтр</option>
            </select>
            <div class="input-with-clear">
              <input type="text" id="filterValue" v-model="filterValue" placeholder="Введите или выберите фильтр" />
              <button class="clear-field" @click="clearAll" title="Очистить фильтр">✕</button>
            </div>
          </div>

          <div class="form-section">
            <label>🔄 Сортировка:</label>
            <select id="sortExample" v-model="selectedSortExample" @change="updateSortInput">
              <option value="">Выберите пример сортировки</option>
              <option value="(createdAt,desc)">🕒 Создание диалога (новые сверху)</option>
              <option value="(createdAt,asc)">🕒 Создание диалога (старые сверху)</option>
              <option value="(member[carl].unreadCount,desc)">📬 Непрочитанные Carl (больше сверху)</option>
              <option value="(member[carl].unreadCount,asc)">📬 Непрочитанные Carl (меньше сверху)</option>
              <option value="(member[marta].unreadCount,desc)">📬 Непрочитанные Marta (больше сверху)</option>
              <option value="(member[marta].unreadCount,asc)">📬 Непрочитанные Marta (меньше сверху)</option>
              <option value="(member[sara].unreadCount,desc)">📬 Непрочитанные Sara (больше сверху)</option>
              <option value="(member[sara].unreadCount,asc)">📬 Непрочитанные Sara (меньше сверху)</option>
              <option value="(member[kirk].unreadCount,desc)">📬 Непрочитанные Kirk (больше сверху)</option>
              <option value="(member[kirk].unreadCount,asc)">📬 Непрочитанные Kirk (меньше сверху)</option>
              <option value="(member[john].unreadCount,desc)">📬 Непрочитанные John (больше сверху)</option>
              <option value="(member[john].unreadCount,asc)">📬 Непрочитанные John (меньше сверху)</option>
              <option value="custom">Пользовательская сортировка</option>
            </select>
            <div class="input-with-clear">
              <input type="text" id="sortValue" v-model="sortValue" placeholder="Введите или выберите сортировку" />
              <button class="clear-field" @click="clearAll" title="Очистить сортировку">✕</button>
            </div>
          </div>

          <div class="form-actions">
            <button class="btn-primary" @click="applyCombined" :disabled="applying">
              {{ applying ? 'Применяется...' : applyButtonText }}
            </button>
          </div>
        </div>

        <div class="pagination" id="dialogsPagination" v-show="showDialogsPagination">
          <button @click="changePage(currentPage - 1)" :disabled="currentPage <= 1">← Предыдущая</button>
          <button
            v-for="pageNum in visibleDialogPages"
            :key="pageNum"
            :class="{ active: pageNum === currentPage }"
            @click="changePage(pageNum)"
          >
            {{ pageNum }}
          </button>
          <button @click="changePage(currentPage + 1)" :disabled="currentPage >= totalPages">
            Следующая →
          </button>
          <span>Страница {{ currentPage }} из {{ totalPages }} (всего {{ totalDialogs }} диалогов)</span>
        </div>

        <div class="panel-content" id="dialogsList">
          <div v-if="loadingDialogs" class="loading">Загрузка диалогов...</div>
          <div v-else-if="dialogsError" class="error">Ошибка загрузки: {{ dialogsError }}</div>
          <div v-else-if="dialogs.length === 0 && !loadingDialogs" class="no-data">Диалоги не найдены</div>
          <table v-else-if="!loadingDialogs && dialogs.length > 0">
            <thead>
              <tr>
                <th>Dialog ID</th>
                <th @click="toggleSort('createdAt')" style="cursor: pointer;">
                  Создан
                  <span class="sort-indicator" :class="{ active: currentSort && currentSort.includes('createdAt') }">
                    {{ getDialogSortIndicator('createdAt') }}
                  </span>
                </th>
                <th>Пользователи</th>
                <th>Инфо</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="dialog in dialogs"
                :key="dialog.dialogId"
                @click="selectDialog(dialog.dialogId)"
                :class="['dialog-row', { 'dialog-row-selected': currentDialogId === dialog.dialogId }]"
                :data-dialog-id="dialog.dialogId"
              >
                <td>{{ dialog.dialogId }}</td>
                <td>{{ formatUpdatedAt(dialog.createdAt) }}</td>
                <td>{{ formatMembers(dialog.members) }}</td>
                <td>
                  <button class="info-button" @click.stop="showDialogInfo(dialog.dialogId)">
                    ℹ️ Инфо
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Сообщения -->
      <div class="panel messages-panel">
        <div class="panel-header">
          <div class="header-left">
            <span>📝 Сообщения</span>
          </div>
          <div class="header-right">
            <button
              @click="showCurrentMessageUrl"
              class="url-button"
              title="Показать URL запроса"
              v-show="currentDialogId"
            >
              🔗 URL
            </button>
          </div>
        </div>

        <div class="filter-panel" id="messageFilterForm" v-show="currentDialogId">
          <div class="form-section">
            <label>🔍 Фильтр:</label>
            <select id="messageFilterExample" v-model="selectedMessageFilterExample" @change="updateMessageFilterInput">
              <option value="">Выберите пример фильтра</option>
              <option value="(content,regex,встретимся)">📝 Содержит "встретимся"</option>
              <option value="(content,regex,спасибо)">📝 Содержит "спасибо"</option>
              <option value="(content,regex,привет)">📝 Содержит "привет"</option>
              <option value="(type,eq,internal.text)">📝 Тип = internal.text</option>
              <option value="(type,eq,system)">📝 Тип = system</option>
              <option value="(senderId,eq,carl)">👤 Отправитель = carl</option>
              <option value="(senderId,eq,sara)">👤 Отправитель = sara</option>
              <option value="custom">✏️ Пользовательский фильтр</option>
            </select>
            <div class="input-with-clear">
              <input
                type="text"
                id="messageFilterValue"
                v-model="messageFilterValue"
                placeholder="Введите или выберите фильтр"
              />
              <button class="clear-field" @click="clearMessageFilter" title="Очистить фильтр">✕</button>
            </div>
          </div>
          <div class="form-actions">
            <button class="btn-primary" @click="applyMessageFilter">Применить</button>
          </div>
        </div>

        <div class="pagination" id="messagesPagination" v-show="showMessagesPagination">
          <button @click="changeMessagePage(currentMessagePage - 1)" :disabled="currentMessagePage <= 1">
            ← Предыдущая
          </button>
          <button
            v-for="pageNum in visibleMessagePages"
            :key="pageNum"
            :class="{ active: pageNum === currentMessagePage }"
            @click="changeMessagePage(pageNum)"
          >
            {{ pageNum }}
          </button>
          <button
            @click="changeMessagePage(currentMessagePage + 1)"
            :disabled="currentMessagePage >= totalMessagePages"
          >
            Следующая →
          </button>
          <span>Страница {{ currentMessagePage }} из {{ totalMessagePages }} (всего {{ totalMessages }} сообщений)</span>
        </div>

        <div class="panel-content" id="messagesList">
          <div v-if="!currentDialogId" class="placeholder">Выберите диалог</div>
          <div v-else-if="loadingMessages" class="loading">Загрузка сообщений...</div>
          <div v-else-if="messagesError" class="error">{{ messagesError }}</div>
          <div v-else-if="messages.length === 0" class="no-data">Сообщения не найдены</div>
          <table v-else>
            <thead>
              <tr>
                <th>Отправитель</th>
                <th @click="toggleMessageSort('createdAt')" style="cursor: pointer;">
                  Время
                  <span class="sort-indicator" :class="{ active: currentMessageSort && currentMessageSort.includes('createdAt') }">
                    {{ getMessageSortIndicator('createdAt') }}
                  </span>
                </th>
                <th>Содержимое</th>
                <th>Тип</th>
                <th>Инфо</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="message in messages" :key="message.messageId">
                <td>{{ message.senderId }}</td>
                <td>{{ formatMessageTime(message.createdAt) }}</td>
                <td class="message-content">{{ message.content }}</td>
                <td>{{ message.type }}</td>
                <td>
                  <button class="info-button" @click="showMessageInfo(message.messageId)">
                    ℹ️ Инфо
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Модальное окно для информации -->
    <div v-if="showInfoModalFlag" class="modal" @click.self="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2 class="modal-title">{{ modalTitle }}</h2>
          <span class="close" @click="closeModal">&times;</span>
        </div>
        <div class="modal-body" v-html="modalBody"></div>
      </div>
    </div>

    <!-- Модальное окно для создания диалога -->
    <div v-if="showCreateDialogModalFlag" class="modal" @click.self="closeCreateDialogModal">
      <div class="modal-content" style="max-width: 500px;" @click.stop>
        <div class="modal-header">
          <h2 class="modal-title">Создать диалог</h2>
          <span class="close" @click="closeCreateDialogModal">&times;</span>
        </div>
        <div class="modal-body">
          <div class="form-section">
            <label>👥 Участники диалога:</label>
            <div style="margin-top: 5px;">
              <button type="button" class="url-button" @click="loadUsersForDialog" style="margin-bottom: 10px;">
                🔄 Загрузить пользователей
              </button>
              <div v-if="loadingUsers" style="display: block; color: #6c757d; font-size: 12px;">Загрузка...</div>
              <div v-else-if="usersError" style="color: #dc3545; font-size: 12px;">{{ usersError }}</div>
              <div v-else-if="usersForDialog.length === 0 && usersLoaded" class="no-data" style="padding: 20px;">
                Пользователи не найдены
              </div>
              <div v-else-if="usersForDialog.length > 0" class="member-list" style="display: block;">
                <div v-for="user in usersForDialog" :key="user.userId" class="member-item">
                  <input
                    type="checkbox"
                    :id="`member_${user.userId}`"
                    :value="user.userId"
                    class="member-checkbox"
                    v-model="selectedMembers"
                  />
                  <label :for="`member_${user.userId}`">
                    <strong>{{ user.userName }}</strong>
                    <span style="color: #6c757d; font-size: 12px; margin-left: 5px;">({{ user.userId }})</span>
                    <span style="color: #6c757d; font-size: 11px; margin-left: 5px;">[{{ user.userType }}]</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
          <div class="form-actions" style="margin-top: 20px;">
            <button type="button" class="btn-primary" @click="createDialog">✅ Создать диалог</button>
            <button type="button" class="url-button" @click="closeCreateDialogModal" style="margin-left: 10px;">
              Отмена
            </button>
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

// Состояние диалогов
const dialogs = ref<any[]>([]);
const loadingDialogs = ref(false); // Будет установлено в true при начале загрузки
const dialogsError = ref<string | null>(null);
const currentPage = ref(1);
const totalPages = ref(1);
const totalDialogs = ref(0);
const currentFilter = ref<string | null>(null);
const currentAdditionalFilter = ref<string | null>(null);
const currentSort = ref<string>('');
const filterValue = ref('');
const sortValue = ref('');
const selectedFilterExample = ref('');
const selectedSortExample = ref('');
const applying = ref(false);
const applyButtonText = ref('Применить');
const showDialogsPagination = ref(false);

// Состояние сообщений
const messages = ref<any[]>([]);
const loadingMessages = ref(false);
const messagesError = ref<string | null>(null);
const currentDialogId = ref<string | null>(null);
const currentMessagePage = ref(1);
const totalMessagePages = ref(1);
const totalMessages = ref(0);
const currentMessageFilter = ref<string | null>(null);
const currentMessageSort = ref<string | null>(null);
const messageFilterValue = ref('');
const selectedMessageFilterExample = ref('');
const showMessagesPagination = ref(false);

// Модальные окна
const showInfoModalFlag = ref(false);
const showCreateDialogModalFlag = ref(false);
const modalTitle = ref('Информация');
const modalBody = ref('');
const modalUrl = ref('');
const currentModalJsonForCopy = ref<string | null>(null);

// Создание диалога
const usersForDialog = ref<any[]>([]);
const loadingUsers = ref(false);
const usersError = ref<string | null>(null);
const usersLoaded = ref(false);
const selectedMembers = ref<string[]>([]);

// Computed
const visibleDialogPages = computed(() => {
  const pages: number[] = [];
  const maxPages = Math.min(5, totalPages.value);
  for (let i = 1; i <= maxPages; i++) {
    pages.push(i);
  }
  return pages;
});

const visibleMessagePages = computed(() => {
  const pages: number[] = [];
  const maxPages = Math.min(5, totalMessagePages.value);
  for (let i = 1; i <= maxPages; i++) {
    pages.push(i);
  }
  return pages;
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

  loadDialogsWithFilter('');
}

function getApiKey() {
  return apiKey.value;
}

function updateFilterInput() {
  if (selectedFilterExample.value === 'custom') {
    filterValue.value = '';
  } else if (selectedFilterExample.value) {
    filterValue.value = selectedFilterExample.value;
  }
}

function updateSortInput() {
  if (selectedSortExample.value === 'custom') {
    sortValue.value = '';
  } else if (selectedSortExample.value) {
    sortValue.value = selectedSortExample.value;
  }
}

function clearAll() {
  filterValue.value = '';
  sortValue.value = '';
  selectedFilterExample.value = '';
  selectedSortExample.value = '';
  currentFilter.value = null;
  currentAdditionalFilter.value = null;
  currentSort.value = '';
  currentPage.value = 1;
  loadDialogsWithFilter('');
}

async function applyCombined() {
  const filterVal = filterValue.value.trim();
  const sortVal = sortValue.value.trim();

  if (filterVal && (!filterVal.startsWith('(') || !filterVal.endsWith(')'))) {
    alert('Фильтр должен быть в формате (field,operator,value)');
    return;
  }

  if (sortVal && (!sortVal.startsWith('(') || !sortVal.endsWith(')'))) {
    alert('Сортировка должна быть в формате (field,direction)');
    return;
  }

  applying.value = true;
  applyButtonText.value = 'Применяется...';

  try {
    currentAdditionalFilter.value = filterVal || null;
    currentSort.value = sortVal || '';
    currentPage.value = 1;

    const combinedFilter = filterVal || '';
    await loadDialogsWithFilter(combinedFilter, 1);

    applyButtonText.value = '✓ Применено';
    setTimeout(() => {
      applyButtonText.value = 'Применить';
    }, 2000);
  } catch (error) {
    applyButtonText.value = '✗ Ошибка';
    setTimeout(() => {
      applyButtonText.value = 'Применить';
    }, 2000);
  } finally {
    applying.value = false;
  }
}

async function loadDialogsWithFilter(filter: string, page = 1, sort: string | null = null) {
  loadingDialogs.value = true;
  dialogsError.value = null;

  try {
    const key = getApiKey();
    if (!key || !key.trim()) {
      throw new Error('API Key не указан');
    }

    let url = `/api/dialogs?filter=${encodeURIComponent(filter)}&page=${page}&limit=10`;
    const sortParam = sort || currentSort.value;
    if (sortParam) {
      url += `&sort=${encodeURIComponent(sortParam)}`;
    }

    const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
    
    let headers;
    try {
      headers = credentialsStore.getHeaders();
    } catch (err) {
      throw new Error('API Key не указан');
    }
    
    const response = await fetch(`${baseUrl}${url}`, {
      headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.data && data.data.length > 0) {
      currentPage.value = page;
      totalPages.value = data.pagination?.pages || 1;
      totalDialogs.value = data.pagination?.total || 0;
      dialogs.value = data.data;
      showDialogsPagination.value = true;
    } else {
      dialogs.value = [];
      showDialogsPagination.value = false;
    }
  } catch (error) {
    console.error('Error loading dialogs:', error);
    dialogsError.value = error instanceof Error ? error.message : 'Ошибка загрузки';
    dialogs.value = [];
    showDialogsPagination.value = false;
  } finally {
    loadingDialogs.value = false;
  }
}

async function changePage(page: number) {
  if (page < 1 || page > totalPages.value || page === currentPage.value) return;

  currentPage.value = page;

  const filterVal = filterValue.value.trim();
  const combinedFilter = filterVal || '';

  await loadDialogsWithFilter(combinedFilter, page, currentSort.value);
}

function formatUpdatedAt(createdAt: string | number | undefined) {
  if (!createdAt) return '-';

  const timestamp = typeof createdAt === 'string' ? parseFloat(createdAt) : createdAt;
  const date = new Date(timestamp);
  return date.toLocaleString('ru-RU');
}

function formatMembers(members: any[] | undefined) {
  if (!members || members.length === 0) return '-';

  return members
    .map((member) => {
      const status = member.isActive ? '🟢' : '🔴';
      return `${status} ${member.userId}`;
    })
    .join(', ');
}

async function selectDialog(dialogId: string) {
  currentDialogId.value = dialogId;
  currentMessagePage.value = 1;
  loadDialogMessages(dialogId, 1);
}

async function loadDialogMessages(dialogId: string, page = 1) {
  loadingMessages.value = true;
  messagesError.value = null;

  try {
    const key = getApiKey();
    if (!key) {
      throw new Error('API Key не указан');
    }

    let url = `/api/dialogs/${dialogId}/messages?page=${page}&limit=10`;
    if (currentMessageSort.value) {
      url += `&sort=${encodeURIComponent(currentMessageSort.value)}`;
    }
    if (currentMessageFilter.value) {
      url += `&filter=${encodeURIComponent(currentMessageFilter.value)}`;
    }

    const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}${url}`, {
      headers: credentialsStore.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.data && data.data.length > 0) {
      currentMessagePage.value = page;
      totalMessagePages.value = data.pagination?.pages || 1;
      totalMessages.value = data.pagination?.total || 0;
      messages.value = data.data;
      showMessagesPagination.value = true;
    } else {
      messages.value = [];
      showMessagesPagination.value = false;
    }
  } catch (error) {
    console.error('Error loading messages:', error);
    messagesError.value = error instanceof Error ? error.message : 'Ошибка загрузки';
    messages.value = [];
    showMessagesPagination.value = false;
  } finally {
    loadingMessages.value = false;
  }
}

async function changeMessagePage(page: number) {
  if (page < 1 || page === currentMessagePage.value || !currentDialogId.value) return;

  currentMessagePage.value = page;
  loadDialogMessages(currentDialogId.value, page);
}

function formatMessageTime(createdAt: string | number | undefined) {
  if (!createdAt) return '-';

  const timestamp = typeof createdAt === 'string' ? parseFloat(createdAt) : createdAt;
  const date = new Date(timestamp);
  return date.toLocaleString('ru-RU');
}

function toggleSort(field: string) {
  let newSort: string | null = null;

  if (!currentSort.value || !currentSort.value.includes(field)) {
    newSort = `(${field},asc)`;
  } else if (currentSort.value.includes('asc')) {
    newSort = `(${field},desc)`;
  } else {
    newSort = null;
  }

  currentSort.value = newSort || '';
  currentPage.value = 1;
  const filterVal = filterValue.value.trim();
  loadDialogsWithFilter(filterVal || '', 1);
}

function getDialogSortIndicator(field: string) {
  if (!currentSort.value || !currentSort.value.includes(field)) {
    return '◄';
  } else if (currentSort.value.includes('asc')) {
    return '▲';
  } else {
    return '▼';
  }
}

function toggleMessageSort(field: string) {
  let newSort: string | null = null;

  if (!currentMessageSort.value || !currentMessageSort.value.includes(field)) {
    newSort = `(${field},asc)`;
  } else if (currentMessageSort.value.includes('asc')) {
    newSort = `(${field},desc)`;
  } else {
    newSort = null;
  }

  currentMessageSort.value = newSort;
  currentMessagePage.value = 1;
  if (currentDialogId.value) {
    loadDialogMessages(currentDialogId.value, 1);
  }
}

function getMessageSortIndicator(field: string) {
  if (!currentMessageSort.value || !currentMessageSort.value.includes(field)) {
    return '◄';
  } else if (currentMessageSort.value.includes('asc')) {
    return '▲';
  } else {
    return '▼';
  }
}

function updateMessageFilterInput() {
  if (selectedMessageFilterExample.value === 'custom') {
    messageFilterValue.value = '';
  } else if (selectedMessageFilterExample.value) {
    messageFilterValue.value = selectedMessageFilterExample.value;
  }
}

function applyMessageFilter() {
  const filterVal = messageFilterValue.value.trim();
  currentMessageFilter.value = filterVal || null;
  currentMessagePage.value = 1;
  if (currentDialogId.value) {
    loadDialogMessages(currentDialogId.value, 1);
  }
}

function clearMessageFilter() {
  messageFilterValue.value = '';
  selectedMessageFilterExample.value = '';
  currentMessageFilter.value = null;
  currentMessageSort.value = null;
  currentMessagePage.value = 1;

  if (currentDialogId.value) {
    loadDialogMessages(currentDialogId.value, 1);
  }
}

function showCurrentMessageUrl() {
  if (!currentDialogId.value) {
    alert('Выберите диалог');
    return;
  }

  let url = `/api/dialogs/${currentDialogId.value}/messages`;
  const params = new URLSearchParams();

  params.append('page', currentMessagePage.value.toString());
  params.append('limit', '10');

  if (currentMessageFilter.value) {
    params.append('filter', currentMessageFilter.value);
  }

  if (currentMessageSort.value) {
    params.append('sort', currentMessageSort.value);
  }

  const fullUrl = url + (params.toString() ? '?' + params.toString() : '');
  const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
  const completeUrl = `${baseUrl}${fullUrl}`;

  showModal(
    'Текущий URL запроса сообщений',
    `
    <div class="url-info">
      <h4>API Endpoint:</h4>
      <div class="url-display">${escapeHtml(fullUrl)}</div>
      
      <h4>Параметры:</h4>
      <div class="params-list">
        <div><strong>page:</strong> ${currentMessagePage.value}</div>
        <div><strong>limit:</strong> 10</div>
        ${currentMessageFilter.value ? `<div><strong>filter:</strong> ${escapeHtml(currentMessageFilter.value)}</div>` : ''}
        ${currentMessageSort.value ? `<div><strong>sort:</strong> ${escapeHtml(currentMessageSort.value)}</div>` : ''}
      </div>
      
      <h4>Полный URL для копирования:</h4>
      <div class="url-copy">
        <input type="text" value="${escapeHtml(completeUrl)}" readonly onclick="this.select()" style="width: 100%; padding: 8px; font-family: monospace; font-size: 12px;">
        <button onclick="copyToClipboard('${escapeHtml(completeUrl)}')" style="margin-top: 8px; padding: 6px 12px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;">📋 Копировать</button>
      </div>
    </div>
  `,
    completeUrl,
  );
}

function showCurrentUrl() {
  let url = `/api/dialogs`;
  const params = new URLSearchParams();

  params.append('page', currentPage.value.toString());
  params.append('limit', '10');

  if (currentFilter.value) {
    params.append('filter', currentFilter.value);
  }

  if (currentAdditionalFilter.value) {
    params.append('filter', currentAdditionalFilter.value);
  }

  if (currentSort.value) {
    params.append('sort', currentSort.value);
  }

  const fullUrl = url + (params.toString() ? '?' + params.toString() : '');
  const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
  const completeUrl = `${baseUrl}${fullUrl}`;

  showModal(
    'Текущий URL запроса диалогов',
    `
    <div class="url-info">
      <h4>API Endpoint:</h4>
      <div class="url-display">${escapeHtml(fullUrl)}</div>
      
      <h4>Параметры:</h4>
      <div class="params-list">
        <div><strong>page:</strong> ${currentPage.value}</div>
        <div><strong>limit:</strong> 10</div>
        ${currentFilter.value ? `<div><strong>filter:</strong> ${escapeHtml(currentFilter.value)}</div>` : ''}
        ${currentAdditionalFilter.value ? `<div><strong>additional filter:</strong> ${escapeHtml(currentAdditionalFilter.value)}</div>` : ''}
        ${currentSort.value ? `<div><strong>sort:</strong> ${escapeHtml(currentSort.value)}</div>` : ''}
      </div>
      
      <h4>Полный URL для копирования:</h4>
      <div class="url-copy">
        <input type="text" value="${escapeHtml(completeUrl)}" readonly onclick="this.select()" style="width: 100%; padding: 8px; font-family: monospace; font-size: 12px;">
        <button onclick="copyToClipboard('${escapeHtml(completeUrl)}')" style="margin-top: 8px; padding: 6px 12px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;">📋 Копировать</button>
      </div>
    </div>
  `,
    completeUrl,
  );
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(
    () => {
      alert('URL скопирован в буфер обмена!');
    },
    (err) => {
      console.error('Ошибка копирования:', err);
      alert('Ошибка копирования в буфер обмена');
    },
  );
}

function showAddDialogModal() {
  showCreateDialogModalFlag.value = true;
  usersForDialog.value = [];
  selectedMembers.value = [];
  usersLoaded.value = false;
  usersError.value = null;
}

function closeCreateDialogModal() {
  showCreateDialogModalFlag.value = false;
}

async function loadUsersForDialog() {
  const key = getApiKey();
  if (!key) {
    alert('API ключ не задан');
    return;
  }

  loadingUsers.value = true;
  usersError.value = null;
  usersLoaded.value = false;

  try {
    const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/users?limit=100`, {
      headers: credentialsStore.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const users = data.data || data.users || [];

    if (users.length === 0) {
      usersForDialog.value = [];
      usersLoaded.value = true;
      return;
    }

    usersForDialog.value = users.map((user: any) => ({
      userId: user.userId || user._id,
      userName: user.meta?.name || user.userId || user._id,
      userType: user.type || 'user',
    }));

    usersLoaded.value = true;
  } catch (error) {
    console.error('Error loading users:', error);
    usersError.value = error instanceof Error ? error.message : 'Ошибка загрузки';
  } finally {
    loadingUsers.value = false;
  }
}

async function createDialog() {
  const key = getApiKey();
  if (!key) {
    alert('API ключ не задан');
    return;
  }

  if (selectedMembers.value.length === 0) {
    alert('Выберите хотя бы одного участника');
    return;
  }

  try {
    const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';

    const requestBody = {
      members: selectedMembers.value.map((userId) => ({ userId })),
    };

    const response = await fetch(`${baseUrl}/api/dialogs`, {
      method: 'POST',
      headers: {
        ...credentialsStore.getHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.message || errorData.error || `HTTP error! status: ${response.status}`;
      throw new Error(errorMessage);
    }

    const result = await response.json();
    const dialog = result.data || result;

    alert(`Диалог успешно создан!\nDialog ID: ${dialog.dialogId || dialog._id}`);

    closeCreateDialogModal();

    loadDialogsWithFilter(currentFilter.value || '');
  } catch (error) {
    console.error('Error creating dialog:', error);
    const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
    alert(`Ошибка при создании диалога: ${errorMessage}`);
  }
}

async function showDialogInfo(dialogId: string) {
  try {
    const key = getApiKey();
    const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
    const url = `${baseUrl}/api/dialogs/${dialogId}`;

    const response = await fetch(url, {
      headers: credentialsStore.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const dialog = await response.json();
    const dialogData = dialog.data || dialog;

    const dialogName = dialogData.dialogId || 'Диалог';

    const formattedJson = JSON.stringify(dialog, null, 2);
    showModal(
      `Информация о диалоге: ${dialogName}`,
      `<div class="json-content">${formattedJson}</div>`,
      url,
      dialogData,
    );
  } catch (error) {
    console.error('Error loading dialog info:', error);
    const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
    const url = `${baseUrl}/api/dialogs/${dialogId}`;
    showModal('Ошибка', `Не удалось загрузить информацию о диалоге: ${error instanceof Error ? error.message : 'Unknown error'}`, url);
  }
}

async function showMessageInfo(messageId: string) {
  try {
    const key = getApiKey();
    const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
    const url = `${baseUrl}/api/messages/${messageId}`;

    const response = await fetch(url, {
      headers: credentialsStore.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const message = await response.json();
    const messageData = message.data || message;

    showModal('Информация о сообщении', `<div class="json-content">${JSON.stringify(message, null, 2)}</div>`, url, messageData);
  } catch (error) {
    console.error('Error loading message info:', error);
    const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
    const url = `${baseUrl}/api/messages/${messageId}`;
    showModal('Ошибка', `Не удалось загрузить информацию о сообщении: ${error instanceof Error ? error.message : 'Unknown error'}`, url);
  }
}

function showModal(title: string, content: string, url: string | null = null, jsonContent: any = null) {
  modalTitle.value = title;

  let modalContent = '';

  if (url) {
    modalContent += `<div class="info-url" style="margin-bottom: 15px; padding: 8px; background: #f8f9fa; border-radius: 4px; font-family: monospace; font-size: 12px; word-break: break-all; color: #495057;">${escapeHtml(url)}</div>`;
  }

  modalContent += content;

  if (jsonContent) {
    const jsonStr = typeof jsonContent === 'string' ? jsonContent : JSON.stringify(jsonContent, null, 2);
    currentModalJsonForCopy.value = jsonStr;
    modalContent += `<div class="form-actions" style="margin-top: 15px;">
      <button type="button" class="btn-primary" onclick="copyJsonToClipboardFromModal()" style="margin-right: 10px;">📋 Копировать JSON</button>
    </div>`;
  }

  modalBody.value = modalContent;
  modalUrl.value = url || '';
  showInfoModalFlag.value = true;
}

function closeModal() {
  showInfoModalFlag.value = false;
  modalBody.value = '';
  currentModalJsonForCopy.value = null;
}

function copyJsonToClipboardFromModal() {
  const jsonText = currentModalJsonForCopy.value;

  if (!jsonText) {
    alert('Нет данных для копирования');
    return;
  }

  navigator.clipboard.writeText(jsonText).then(
    () => {
      const button = document.querySelector('#modalBody .btn-primary') as HTMLButtonElement;
      if (button) {
        const originalText = button.textContent;
        button.textContent = '✅ Скопировано!';
        button.style.background = '#28a745';
        setTimeout(() => {
          button.textContent = originalText;
          button.style.background = '';
        }, 2000);
      }
    },
    (err) => {
      console.error('Failed to copy JSON:', err);
      alert('Не удалось скопировать JSON');
    },
  );
}

function escapeHtml(value: string) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Инициализация
onMounted(() => {
  // Глобальные функции для использования в v-html
  (window as any).copyJsonToClipboardFromModal = copyJsonToClipboardFromModal;
  (window as any).copyToClipboard = copyToClipboard;
  
  credentialsStore.loadFromStorage();

  const params = getUrlParams();
  if (params.apiKey) {
    setApiKeyFromExternal(params.apiKey, params.tenantId);
  } else {
    const key = getApiKey();
    if (key && key.trim()) {
      // Если API Key уже есть в store, загружаем диалоги
      loadDialogsWithFilter('');
    } else {
      // Если API Key нет, не показываем загрузку
      loadingDialogs.value = false;
    }
  }

  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'setApiCredentials') {
      setApiKeyFromExternal(event.data.apiKey, event.data.tenantId);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' || event.key === 'Esc') {
      if (showInfoModalFlag.value) {
        closeModal();
      }
      if (showCreateDialogModalFlag.value) {
        closeCreateDialogModal();
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

.dialogs-messages-page {
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
}

.dialogs-panel {
  width: 50%;
  min-width: 350px;
}

.messages-panel {
  width: 50%;
  min-width: 350px;
}

.panel {
  background: white;
  display: flex;
  flex-direction: column;
  overflow: hidden;
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

.url-button {
  background: #667eea;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-weight: normal;
  transition: background-color 0.2s;
}

.url-button:hover {
  background: #5a6fd8;
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}

.combined-form,
.filter-panel {
  padding: 15px;
  border-bottom: 1px solid #e9ecef;
  background: #f8f9fa;
}

.form-section {
  margin-bottom: 12px;
}

.form-section:last-child {
  margin-bottom: 0;
}

.form-section label {
  display: block;
  margin-bottom: 4px;
  font-weight: 500;
  color: #495057;
  font-size: 12px;
}

.form-section select,
.form-section input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 12px;
  margin-bottom: 8px;
}

.input-with-clear {
  position: relative;
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.input-with-clear input {
  padding-right: 35px;
  margin-bottom: 0;
}

.clear-field {
  position: absolute;
  right: 8px;
  background: none;
  border: none;
  color: #6c757d;
  cursor: pointer;
  font-size: 16px;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.clear-field:hover {
  color: #dc3545;
}

.form-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.form-actions button {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s;
}

.form-actions button:disabled {
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

.btn-secondary {
  background: #6c757d;
  color: white;
  border: none;
}

.btn-secondary:hover:not(:disabled) {
  background: #5a6268;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 15px;
  gap: 5px;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
}

.pagination button {
  padding: 5px 10px;
  border: 1px solid #ced4da;
  background: white;
  cursor: pointer;
  border-radius: 4px;
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

.pagination span {
  margin-left: 15px;
  color: #6c757d;
  font-size: 12px;
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
}

th:hover {
  background: #e9ecef;
}

.sort-indicator {
  margin-left: 5px;
  color: #6c757d;
}

.sort-indicator.active {
  color: #667eea;
}

tr:hover {
  background: #f8f9fa;
}

.dialog-row {
  cursor: pointer;
}

.dialog-row:hover {
  background: #e3f2fd;
}

.dialog-row-selected {
  background-color: #e9ecef !important;
}

.dialog-row-selected:hover {
  background-color: #dee2e6 !important;
}

.unread-badge {
  background: #dc3545;
  color: white;
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 500;
}

.loading,
.error,
.no-data,
.placeholder {
  padding: 40px 20px;
  text-align: center;
  color: #6c757d;
}

.error {
  color: #dc3545;
}

.message-content {
  max-width: 100%;
  word-wrap: break-word;
  white-space: pre-wrap;
}

table button {
  padding: 4px 8px;
  font-size: 11px;
  border: 1px solid #ced4da;
  background: white;
  border-radius: 3px;
  cursor: pointer;
}

table button:hover {
  background: #e9ecef;
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

/* Модальное окно */
.modal {
  position: fixed;
  z-index: 1000;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-content {
  background-color: #fefefe;
  margin: 5% auto;
  padding: 20px;
  border: none;
  border-radius: 8px;
  width: 80%;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 1px solid #e9ecef;
}

.modal-title {
  font-size: 18px;
  font-weight: 600;
  color: #333;
  margin: 0;
}

.close {
  color: #aaa;
  font-size: 28px;
  font-weight: bold;
  cursor: pointer;
  line-height: 1;
}

.close:hover,
.close:focus {
  color: #000;
  text-decoration: none;
}

.modal-body {
  font-size: 14px;
  line-height: 1.5;
}

.json-content {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  padding: 10px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  white-space: pre-wrap !important;
  overflow-x: auto;
  word-wrap: break-word;
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
}

.member-list {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  margin-top: 10px;
}

.member-item {
  display: flex;
  align-items: center;
  padding: 10px 15px;
  border-bottom: 1px solid #f0f0f0;
}

.member-item:last-child {
  border-bottom: none;
}

.member-item:hover {
  background: #f8f9fa;
}

.member-item input[type='checkbox'] {
  margin-right: 10px;
  cursor: pointer;
}

.member-item label {
  flex: 1;
  cursor: pointer;
  margin: 0;
}
</style>

<style>
/* Стили для динамически вставляемого контента через v-html (не scoped) */
.json-content {
  background: #f8f9fa !important;
  border: 1px solid #e9ecef !important;
  border-radius: 4px !important;
  padding: 10px !important;
  font-family: 'Courier New', monospace !important;
  font-size: 12px !important;
  white-space: pre-wrap !important;
  overflow-x: auto !important;
  word-wrap: break-word !important;
}

.form-actions {
  display: flex !important;
  gap: 8px !important;
  margin-top: 12px !important;
}

.form-actions button {
  padding: 6px 12px !important;
  border: none !important;
  border-radius: 4px !important;
  cursor: pointer !important;
  font-size: 12px !important;
  font-weight: 500 !important;
  transition: all 0.2s !important;
}

.form-actions button:disabled {
  opacity: 0.5 !important;
  cursor: not-allowed !important;
}

.btn-primary {
  background: #667eea !important;
  color: white !important;
  border: none !important;
}

.btn-primary:hover:not(:disabled) {
  background: #5a6fd8 !important;
}

.btn-secondary {
  background: #6c757d !important;
  color: white !important;
  border: none !important;
}

.btn-secondary:hover:not(:disabled) {
  background: #5a6268 !important;
}
</style>
