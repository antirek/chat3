<template>
  <div class="users-page">
    <div class="page-header">
      <div class="page-header-left">
        <h1>👤 Пользователи</h1>
        <button class="btn-success btn-small" @click="showCreateModal">➕ Создать пользователя</button>
      </div>
      <div class="page-header-right">
        <button class="btn-primary btn-small" @click="showUrlModal">URL</button>
      </div>
    </div>

    <div class="page-container">
      <div class="filter-panel">
        <div class="form-section">
          <label for="userFilterInput">
            🔍 Фильтр пользователей (формат: <code>(поле,оператор,значение)</code>)
          </label>
          <select
            id="userFilterExample"
            v-model="selectedFilterExample"
            @change="selectUserFilterExample"
            style="margin-bottom: 8px;"
          >
            <option value="">Выберите пример</option>
            <optgroup label="userId">
              <option value="(userId,regex,bot)">userId содержит "bot"</option>
              <option value="(userId,eq,system_bot)">userId = system_bot</option>
            </optgroup>
            <optgroup label="type">
              <option value="(type,in,[user,bot])">type в списке [user, bot]</option>
              <option value="(type,eq,user)">type = user</option>
              <option value="(type,eq,bot)">type = bot</option>
              <option value="(type,eq,contact)">type = contact</option>
            </optgroup>
            <optgroup label="meta.*">
              <option value="(meta.role,eq,manager)">meta.role = manager</option>
              <option value="(meta.region,regex,europe)">meta.region содержит "europe"</option>
            </optgroup>
            <option value="custom">Пользовательский фильтр</option>
          </select>
          <div class="input-with-clear" style="margin-bottom: 8px;">
            <input
              type="text"
              id="userFilterInput"
              v-model="filterInput"
              placeholder="Например: (userId,regex,carl)&(meta.role,eq,manager)"
              @keydown.enter="applyUserFilter"
            />
            <button
              class="clear-field"
              type="button"
              @click="clearUserFilter"
              title="Очистить поле"
            >
              ✕
            </button>
          </div>
          <small style="display: block; color: #6c757d;">
            Поддерживаются поля `userId`, `type`, `meta.*`. Операторы: eq, ne, in, nin, regex, gt, lt, gte, lte.
          </small>
        </div>
        <div class="form-actions">
          <button class="btn-primary" type="button" @click="applyUserFilter">Применить</button>
        </div>
      </div>

      <div class="pagination" v-if="totalUsers > 0">
        <div class="pagination-info">
          Показано {{ paginationStart }}-{{ paginationEnd }} из {{ totalUsers }} пользователей
        </div>
        <div class="pagination-controls">
          <button
            class="btn-secondary btn-small"
            @click="goToFirstPage"
            :disabled="currentPage <= 1"
          >
            ⏮ Первая
          </button>
          <button
            class="btn-secondary btn-small"
            @click="goToPreviousPage"
            :disabled="currentPage <= 1"
          >
            ← Предыдущая
          </button>
          <span>Страница</span>
          <input
            type="number"
            id="currentPageInput"
            v-model.number="currentPageInput"
            :min="1"
            :max="totalPages"
            @change="goToPage(currentPageInput)"
          />
          <span>из</span>
          <span>{{ totalPages }}</span>
          <button
            class="btn-secondary btn-small"
            @click="goToNextPage"
            :disabled="currentPage >= totalPages"
          >
            Следующая →
          </button>
          <button
            class="btn-secondary btn-small"
            @click="goToLastPage"
            :disabled="currentPage >= totalPages"
          >
            Последняя ⏭
          </button>
          <span>Показать:</span>
          <select id="pageLimit" v-model.number="currentLimit" @change="changeLimit(currentLimit)">
            <option :value="10">10</option>
            <option :value="20">20</option>
            <option :value="50">50</option>
            <option :value="100">100</option>
          </select>
        </div>
      </div>

      <div class="content">
        <div v-if="loading" class="loading">Загрузка...</div>
        <div v-else-if="error" class="error">Ошибка загрузки: {{ error }}</div>
        <div v-else-if="users.length === 0" class="no-data">Пользователи не найдены</div>
        <table v-else>
          <thead>
            <tr>
              <th @click="toggleSort('userId')" style="cursor: pointer;">
                User ID
                <span class="sort-indicator">{{ getSortIndicator('userId') }}</span>
              </th>
              <th @click="toggleSort('type')" style="cursor: pointer;">
                Тип
                <span class="sort-indicator">{{ getSortIndicator('type') }}</span>
              </th>
              <th @click="toggleSort('createdAt')" style="cursor: pointer;">
                Создан
                <span class="sort-indicator">{{ getSortIndicator('createdAt') }}</span>
              </th>
              <th style="text-align: center; width: 80px;" title="Общее количество диалогов">💬 Диалоги</th>
              <th style="text-align: center; width: 80px;" title="Диалоги с непрочитанными сообщениями">🔔 Непрочитано</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in users" :key="user.userId">
              <td><strong>{{ user.userId || '-' }}</strong></td>
              <td>
                <span style="background: #e3f2fd; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 500;">
                  {{ user.type || 'user' }}
                </span>
              </td>
              <td>{{ formatTimestamp(user.createdAt) }}</td>
              <td style="text-align: center;">
                <span style="background: #f0f0f0; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; color: #495057;">
                  {{ user.dialogCount !== undefined ? user.dialogCount : '-' }}
                </span>
              </td>
              <td style="text-align: center;">
                <span
                  :style="{
                    background: (user.unreadDialogsCount || 0) > 0 ? '#fff3cd' : '#f0f0f0',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: (user.unreadDialogsCount || 0) > 0 ? '#856404' : '#495057',
                  }"
                >
                  {{ user.unreadDialogsCount !== undefined ? user.unreadDialogsCount : '-' }}
                </span>
              </td>
              <td>
                <button class="btn-primary btn-small" @click="showUserInfoModal(user.userId)">
                  ℹ️ Инфо
                </button>
                <button class="btn-success btn-small" @click="showMetaModal(user.userId)">
                  🏷️ Мета
                </button>
                <button class="btn-primary btn-small" @click="showEditModal(user.userId)">
                  ✏️ Изменить Тип
                </button>
                <button class="btn-danger btn-small" @click="deleteUser(user.userId)">
                  🗑️ Удалить
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal для создания пользователя -->
    <div v-if="showCreateModalFlag" class="modal" @click.self="closeCreateModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2>Создать пользователя</h2>
          <button class="modal-close" @click="closeCreateModal" title="Закрыть">×</button>
        </div>
        <div class="modal-body">
          <form @submit.prevent="createUser">
            <div class="form-group">
              <label for="createUserId">User ID *</label>
              <input
                type="text"
                id="createUserId"
                v-model="createUserId"
                required
                placeholder="john"
              />
            </div>
            <div class="form-group">
              <label for="createType">Тип</label>
              <select id="createType" v-model="createType">
                <option value="user">user</option>
                <option value="bot">bot</option>
                <option value="contact">contact</option>
                <option value="agent">agent</option>
              </select>
            </div>
            <div class="form-actions">
              <button type="button" class="btn-secondary" @click="closeCreateModal">Отмена</button>
              <button type="submit" class="btn-success">Создать</button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- Modal для редактирования пользователя -->
    <div v-if="showEditModalFlag" class="modal" @click.self="closeEditModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2>Редактировать пользователя</h2>
          <button class="modal-close" @click="closeEditModal" title="Закрыть">×</button>
        </div>
        <div class="modal-body">
          <form @submit.prevent="updateUser">
            <input type="hidden" :value="editUserId" />
            <div class="form-group">
              <label for="editType">Тип</label>
              <select id="editType" v-model="editType">
                <option value="user">user</option>
                <option value="bot">bot</option>
                <option value="contact">contact</option>
                <option value="agent">agent</option>
              </select>
            </div>
            <div class="form-actions">
              <button type="button" class="btn-secondary" @click="closeEditModal">Отмена</button>
              <button type="submit" class="btn-primary">Сохранить</button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- Modal для управления meta тегами -->
    <div v-if="showMetaModalFlag" class="modal" @click.self="closeMetaModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2>🏷️ Meta теги пользователя</h2>
          <button class="modal-close" @click="closeMetaModal" title="Закрыть">×</button>
        </div>
        <div class="modal-body">
          <div class="meta-list">
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
                id="newMetaKey"
                v-model="newMetaKeyForEdit"
                placeholder="key (например: department)"
              />
              <input
                type="text"
                id="newMetaValue"
                v-model="newMetaValueForEdit"
                placeholder="value (например: Sales)"
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

    <!-- Modal для просмотра JSON информации о пользователе -->
    <div v-if="showUserInfoModalFlag" class="modal" @click.self="closeUserInfoModal">
      <div class="modal-content" style="max-width: 800px;" @click.stop>
        <div class="modal-header">
          <h2>📋 Информация о пользователе</h2>
          <button class="modal-close" @click="closeUserInfoModal" title="Закрыть">×</button>
        </div>
        <div class="modal-body">
          <div
            class="info-url"
            style="margin-bottom: 15px; padding: 8px; background: #f8f9fa; border-radius: 4px; font-family: monospace; font-size: 12px; word-break: break-all; color: #495057;"
          >
            {{ userInfoUrl }}
          </div>
          <div class="json-viewer">{{ jsonViewerContent }}</div>
          <div class="form-actions" style="margin-top: 15px;">
            <button
              type="button"
              class="btn-primary"
              @click="copyUserJsonToClipboard"
              style="margin-right: 10px;"
            >
              {{ copyJsonButtonText }}
            </button>
            <button type="button" class="btn-secondary" @click="closeUserInfoModal">Закрыть</button>
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
          <div class="json-viewer">{{ generatedUrl }}</div>
          <div class="form-actions" style="margin-top: 15px;">
            <button type="button" class="btn-primary" @click="copyUrlToClipboard">
              {{ copyUrlButtonText }}
            </button>
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
const totalUsers = ref(0);
const users = ref<any[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

// Фильтры и сортировка
const currentFilter = ref('');
const filterInput = ref('');
const selectedFilterExample = ref('');
const currentSort = ref({ field: 'createdAt', order: -1 });

// Модальные окна
const showCreateModalFlag = ref(false);
const showEditModalFlag = ref(false);
const showMetaModalFlag = ref(false);
const showUserInfoModalFlag = ref(false);
const showUrlModalFlag = ref(false);

// Создание пользователя
const createUserId = ref('');
const createType = ref('user');

// Редактирование пользователя
const editUserId = ref('');
const editType = ref('user');

// Meta теги
const metaUserId = ref('');
const metaTags = ref<Record<string, any> | null>(null);
const newMetaKeyForEdit = ref('');
const newMetaValueForEdit = ref('');

// Info modal
const userInfoUrl = ref('');
const jsonViewerContent = ref('');
const currentJsonForCopy = ref('');
const copyJsonButtonText = ref('📋 Копировать JSON');

// URL modal
const generatedUrl = ref('');
const copyUrlButtonText = ref('📋 Скопировать');

// Пагинация
const currentPageInput = ref(1);

// Computed
const paginationStart = computed(() => {
  return (currentPage.value - 1) * currentLimit.value + 1;
});

const paginationEnd = computed(() => {
  return Math.min(currentPage.value * currentLimit.value, totalUsers.value);
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

  loadUsers(1);
}

function getApiKey() {
  return apiKey.value;
}

async function loadUsers(page = currentPage.value, limit = currentLimit.value) {
  try {
    const key = getApiKey();

    if (!key) {
      throw new Error('API Key не указан');
    }

    currentPage.value = page;
    currentLimit.value = limit;
    loading.value = true;
    error.value = null;

    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    if (currentFilter.value) {
      params.append('filter', currentFilter.value);
    }

    const sortObj: Record<string, number> = {};
    sortObj[currentSort.value.field] = currentSort.value.order;
    params.append('sort', JSON.stringify(sortObj));

    const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/users?${params.toString()}`, {
      headers: credentialsStore.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    totalUsers.value = data.pagination?.total || 0;
    totalPages.value = data.pagination?.pages || 1;

    if (data.data && data.data.length > 0) {
      users.value = data.data;
    } else {
      users.value = [];
    }
  } catch (err) {
    console.error('Error loading users:', err);
    error.value = err instanceof Error ? err.message : 'Ошибка загрузки';
    users.value = [];
  } finally {
    loading.value = false;
  }
}

function goToFirstPage() {
  if (currentPage.value > 1) {
    loadUsers(1, currentLimit.value);
  }
}

function goToPreviousPage() {
  if (currentPage.value > 1) {
    loadUsers(currentPage.value - 1, currentLimit.value);
  }
}

function goToNextPage() {
  if (currentPage.value < totalPages.value) {
    loadUsers(currentPage.value + 1, currentLimit.value);
  }
}

function goToLastPage() {
  if (currentPage.value < totalPages.value) {
    loadUsers(totalPages.value, currentLimit.value);
  }
}

function goToPage(page: number) {
  if (page >= 1 && page <= totalPages.value) {
    loadUsers(page, currentLimit.value);
  } else {
    currentPageInput.value = currentPage.value;
  }
}

function changeLimit(limit: number) {
  loadUsers(1, limit);
}

function getSortIndicator(field: string) {
  if (currentSort.value.field === field) {
    return currentSort.value.order === 1 ? ' ▲' : ' ▼';
  }
  return '';
}

function toggleSort(field: string) {
  if (currentSort.value.field === field) {
    currentSort.value.order = currentSort.value.order === 1 ? -1 : 1;
  } else {
    currentSort.value.field = field;
    currentSort.value.order = -1;
  }
  loadUsers(currentPage.value, currentLimit.value);
}

function formatTimestamp(timestamp: string | number | undefined) {
  if (!timestamp) return '-';
  const ts = typeof timestamp === 'string' ? parseFloat(timestamp) : timestamp;
  const date = new Date(ts);
  return date.toLocaleString('ru-RU');
}

// Модальные окна
function showCreateModal() {
  showCreateModalFlag.value = true;
  createUserId.value = '';
  createType.value = 'user';
}

function closeCreateModal() {
  showCreateModalFlag.value = false;
}

async function createUser() {
  const userData = {
    userId: createUserId.value.trim().toLowerCase(),
    type: createType.value || 'user',
  };

  try {
    const key = getApiKey();
    const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';

    const response = await fetch(`${baseUrl}/api/users`, {
      method: 'POST',
      headers: {
        ...credentialsStore.getHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create user');
    }

    closeCreateModal();
    loadUsers(1, currentLimit.value);
    alert('Пользователь успешно создан!');
  } catch (err) {
    console.error('Error creating user:', err);
    alert('Ошибка создания пользователя: ' + (err instanceof Error ? err.message : 'Unknown error'));
  }
}

async function showEditModal(userId: string) {
  try {
    const key = getApiKey();
    const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';

    const response = await fetch(`${baseUrl}/api/users/${userId}`, {
      headers: credentialsStore.getHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to load user');
    }

    const { data: user } = await response.json();

    editUserId.value = user.userId;
    editType.value = user.type || 'user';
    showEditModalFlag.value = true;
  } catch (err) {
    console.error('Error loading user:', err);
    alert('Ошибка загрузки данных пользователя');
  }
}

function closeEditModal() {
  showEditModalFlag.value = false;
}

async function updateUser() {
  const userData = {
    type: editType.value || 'user',
  };

  try {
    const key = getApiKey();
    const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';

    const response = await fetch(`${baseUrl}/api/users/${editUserId.value}`, {
      method: 'PUT',
      headers: {
        ...credentialsStore.getHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update user');
    }

    closeEditModal();
    loadUsers(currentPage.value, currentLimit.value);
    alert('Пользователь успешно обновлен!');
  } catch (err) {
    console.error('Error updating user:', err);
    alert('Ошибка обновления пользователя: ' + (err instanceof Error ? err.message : 'Unknown error'));
  }
}

async function deleteUser(userId: string) {
  if (!confirm(`Вы уверены, что хотите удалить пользователя "${userId}"?`)) {
    return;
  }

  try {
    const key = getApiKey();
    const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';

    const response = await fetch(`${baseUrl}/api/users/${userId}`, {
      method: 'DELETE',
      headers: credentialsStore.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete user');
    }

    loadUsers(currentPage.value, currentLimit.value);
    alert('Пользователь успешно удален!');
  } catch (err) {
    console.error('Error deleting user:', err);
    alert('Ошибка удаления пользователя: ' + (err instanceof Error ? err.message : 'Unknown error'));
  }
}

async function showMetaModal(userIdValue: string) {
  metaUserId.value = userIdValue;
  showMetaModalFlag.value = true;
  await loadMetaTags(userIdValue);
}

function closeMetaModal() {
  showMetaModalFlag.value = false;
  metaTags.value = null;
  newMetaKeyForEdit.value = '';
  newMetaValueForEdit.value = '';
}

async function loadMetaTags(userIdValue: string) {
  try {
    const key = getApiKey();
    const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';

    const response = await fetch(`${baseUrl}/api/users/${userIdValue}`, {
      headers: credentialsStore.getHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to load user meta');
    }

    const { data: user } = await response.json();
    metaTags.value = user.meta || {};
  } catch (err) {
    console.error('Error loading meta tags:', err);
    metaTags.value = null;
  }
}

async function addMetaTag() {
  const userIdValue = metaUserId.value;
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

    const response = await fetch(`${baseUrl}/api/meta/user/${userIdValue}/${key}`, {
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
    await loadMetaTags(userIdValue);
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

    const response = await fetch(`${baseUrl}/api/meta/user/${metaUserId.value}/${key}`, {
      method: 'DELETE',
      headers: credentialsStore.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete meta tag');
    }

    await loadMetaTags(metaUserId.value);
    alert('Meta тег успешно удален!');
  } catch (err) {
    console.error('Error deleting meta tag:', err);
    alert('Ошибка удаления meta тега: ' + (err instanceof Error ? err.message : 'Unknown error'));
  }
}

async function showUserInfoModal(userIdParam: string) {
  try {
    const key = getApiKey();
    const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
    const url = `${baseUrl}/api/users/${userIdParam}`;

    userInfoUrl.value = url;

    const userResponse = await fetch(url, {
      headers: credentialsStore.getHeaders(),
    });

    const responseData = await userResponse.json();

    if (!userResponse.ok) {
      const errorJson = JSON.stringify(
        {
          status: userResponse.status,
          statusText: userResponse.statusText,
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

    showUserInfoModalFlag.value = true;
    copyJsonButtonText.value = '📋 Копировать JSON';
  } catch (err) {
    console.error('Error loading user info:', err);
    const errorJson = JSON.stringify(
      {
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      null,
      2,
    );
    jsonViewerContent.value = errorJson;
    currentJsonForCopy.value = errorJson;
    showUserInfoModalFlag.value = true;
  }
}

function closeUserInfoModal() {
  showUserInfoModalFlag.value = false;
}

async function copyUserJsonToClipboard() {
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

function selectUserFilterExample() {
  if (selectedFilterExample.value && selectedFilterExample.value !== 'custom') {
    filterInput.value = selectedFilterExample.value;
  } else if (selectedFilterExample.value === 'custom') {
    filterInput.value = '';
  }
}

function clearUserFilter() {
  filterInput.value = '';
  selectedFilterExample.value = '';
  currentFilter.value = '';
  loadUsers(1, currentLimit.value);
}

function applyUserFilter() {
  currentFilter.value = filterInput.value.trim();
  loadUsers(1, currentLimit.value);
}

function generateApiUrl() {
  const key = getApiKey();
  if (!key) {
    return 'API Key не указан';
  }

  const params = new URLSearchParams({
    page: currentPage.value.toString(),
    limit: currentLimit.value.toString(),
  });

  if (currentFilter.value) {
    params.append('filter', currentFilter.value);
  }

  const sortObj: Record<string, number> = {};
  sortObj[currentSort.value.field] = currentSort.value.order;
  params.append('sort', JSON.stringify(sortObj));

  const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
  return `${baseUrl}/api/users?${params.toString()}`;
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
  const url = generateApiUrl();
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

// Синхронизация currentPageInput с currentPage
watch(currentPage, (newValue) => {
  currentPageInput.value = newValue;
});

// Инициализация
onMounted(() => {
  // Загружаем credentials из store (они уже загружены из localStorage при создании store)
  credentialsStore.loadFromStorage();

  // Проверяем URL параметры (для обратной совместимости с iframe)
  const params = getUrlParams();
  if (params.apiKey) {
    setApiKeyFromExternal(params.apiKey, params.tenantId);
  } else {
    // Если нет URL параметров, но есть API Key в store, загружаем пользователей
    const key = getApiKey();
    if (key) {
      loadUsers(1);
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
      if (showCreateModalFlag.value) {
        closeCreateModal();
      } else if (showEditModalFlag.value) {
        closeEditModal();
      } else if (showMetaModalFlag.value) {
        closeMetaModal();
      } else if (showUserInfoModalFlag.value) {
        closeUserInfoModal();
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

.users-page {
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
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
  border-radius: 8px 8px 0 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h2 {
  font-size: 16px;
  margin: 0;
  color: #333;
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  color: #6c757d;
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
  background: #e9ecef;
  color: #333;
}

.modal-body {
  padding: 20px;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  color: #495057;
  font-size: 13px;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 13px;
}

.form-group textarea {
  resize: vertical;
  min-height: 60px;
  font-family: monospace;
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

.filter-panel .clear-field:hover {
  color: #dc3545;
}

.filter-panel .form-actions {
  margin-top: 10px;
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

.pagination-controls button,
.pagination-controls button.btn-secondary,
.pagination-controls button.btn-small {
  padding: 5px 10px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  color: #333;
  margin-right: 0;
}

.pagination-controls button:hover:not(:disabled),
.pagination-controls button.btn-secondary:hover:not(:disabled) {
  background: #e9ecef;
  color: #333;
}

.pagination-controls button:disabled,
.pagination-controls button.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pagination-controls input {
  width: 60px;
  padding: 4px 8px;
  border: 1px solid #667eea;
  border-radius: 4px;
  font-size: 12px;
  text-align: center;
  background: #667eea;
  color: white;
}

.pagination-controls span {
  font-size: 11px;
  color: #666;
}

.pagination-controls select {
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
  background: white;
}

.sort-indicator {
  margin-left: 5px;
  font-size: 10px;
  color: #667eea;
}
</style>
