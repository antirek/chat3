<template>
  <div class="tenants-page">
    <div class="header">
      <div class="header-left">
        <h1>🏢 Тенанты</h1>
        <button class="btn-success btn-small" @click="showCreateModal">➕ Создать тенант</button>
      </div>
      <div class="header-right">
        <button class="btn-primary btn-small" @click="showUrlModal">URL</button>
      </div>
    </div>

    <div class="container">
      <div class="filter-panel">
        <div class="form-section">
          <label for="tenantFilterInput">
            🔍 Фильтр тенантов (формат: <code>(поле,оператор,значение)</code>)
          </label>
          <select
            id="tenantFilterExample"
            v-model="selectedFilterExample"
            @change="selectTenantFilterExample"
            style="margin-bottom: 8px;"
          >
            <option value="">Выберите пример</option>
            <optgroup label="tenantId">
              <option value="(tenantId,regex,test)">tenantId содержит "test"</option>
              <option value="(tenantId,eq,tnt_default)">tenantId = tnt_default</option>
            </optgroup>
            <optgroup label="meta.*">
              <option value="(meta.company,eq,MyCompany)">meta.company = MyCompany</option>
              <option value="(meta.region,regex,europe)">meta.region содержит "europe"</option>
            </optgroup>
            <option value="custom">Пользовательский фильтр</option>
          </select>
          <div class="input-with-clear" style="margin-bottom: 8px;">
            <input
              type="text"
              id="tenantFilterInput"
              v-model="filterInput"
              placeholder="Например: (tenantId,regex,test)&(meta.company,eq,MyCompany)"
            />
            <button
              class="clear-field"
              type="button"
              @click="clearTenantFilter"
              title="Очистить поле"
            >
              ✕
            </button>
          </div>
          <small style="display: block; color: #6c757d;">
            Поддерживаются поля `tenantId`, `meta.*`. Операторы: eq, ne, in, nin, regex, gt, lt, gte, lte.
          </small>
        </div>
        <div class="form-actions">
          <button class="btn-primary" type="button" @click="applyTenantFilter">Применить</button>
        </div>
      </div>

      <div class="pagination" v-if="totalTenants > 0" id="pagination">
        <div class="pagination-info" id="paginationInfo">
          Показано {{ paginationStart }}-{{ paginationEnd }} из {{ totalTenants }} тенантов
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
            ◀ Предыдущая
          </button>
          <span style="font-size: 12px; margin: 0 8px;">Страница</span>
          <input
            type="number"
            id="currentPageInput"
            v-model.number="currentPageInput"
            :min="1"
            :max="totalPages"
            @change="goToPage(currentPageInput)"
          />
          <span style="font-size: 12px; margin: 0 8px;">из</span>
          <span id="totalPages" style="font-size: 12px;">{{ totalPages }}</span>
          <button
            class="btn-secondary btn-small"
            @click="goToNextPage"
            :disabled="currentPage >= totalPages"
          >
            Следующая ▶
          </button>
          <button
            class="btn-secondary btn-small"
            @click="goToLastPage"
            :disabled="currentPage >= totalPages"
          >
            Последняя ⏭
          </button>
          <span style="font-size: 12px; margin-left: 12px;">Показать:</span>
          <select
            id="pageLimit"
            v-model.number="currentLimit"
            @change="changeLimit(currentLimit)"
            style="padding: 4px 8px; border: 1px solid #ced4da; border-radius: 4px; font-size: 12px;"
          >
            <option :value="10">10</option>
            <option :value="20">20</option>
            <option :value="50">50</option>
            <option :value="100">100</option>
          </select>
        </div>
      </div>

      <div class="content" id="tenantsList">
        <div v-if="loading" class="loading">Загрузка...</div>
        <div v-else-if="error" class="error">Ошибка загрузки: {{ error }}</div>
        <div v-else-if="tenants.length === 0" class="no-data">Тенанты не найдены</div>
        <table v-else>
          <thead>
            <tr>
              <th @click="toggleSort('tenantId')" style="cursor: pointer;">
                Tenant ID
                <span class="sort-indicator">{{ getSortIndicator('tenantId') }}</span>
              </th>
              <th @click="toggleSort('createdAt')" style="cursor: pointer;">
                Создан
                <span class="sort-indicator">{{ getSortIndicator('createdAt') }}</span>
              </th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="tenant in tenants" :key="tenant.tenantId">
              <td><strong>{{ tenant.tenantId || '-' }}</strong></td>
              <td>{{ formatTimestamp(tenant.createdAt) }}</td>
              <td>
                <button
                  class="btn-primary btn-small"
                  @click="showInfoModal(tenant.tenantId)"
                >
                  📋 Инфо
                </button>
                <button
                  class="btn-success btn-small"
                  @click="showMetaModal(tenant.tenantId)"
                >
                  🏷️ Мета
                </button>
                <button
                  class="btn-danger btn-small"
                  @click="deleteTenant(tenant.tenantId)"
                >
                  🗑️ Удалить
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal для создания тенанта -->
    <div v-if="showCreateModalFlag" class="modal" @click.self="closeCreateModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2>Создать тенант</h2>
          <button class="modal-close" @click="closeCreateModal" title="Закрыть">×</button>
        </div>
        <div class="modal-body">
          <form @submit.prevent="createTenant">
            <div class="form-group">
              <label for="createTenantId">Tenant ID</label>
              <input
                type="text"
                id="createTenantId"
                v-model="createTenantId"
                placeholder="my_tenant"
                maxlength="20"
              />
              <small>
                Опционально. Максимум 20 символов. Если не указан, будет сгенерирован автоматически.
              </small>
            </div>
            <div class="meta-section">
              <h3>Мета-теги (опционально)</h3>
              <div id="createMetaTagsList">
                <div v-if="createMetaTags.length === 0" style="padding: 10px; color: #6c757d; font-size: 12px;">
                  Мета-теги не добавлены
                </div>
                <table v-else style="width: 100%; margin-bottom: 10px;">
                  <thead>
                    <tr>
                      <th style="padding: 6px; font-size: 11px;">Key</th>
                      <th style="padding: 6px; font-size: 11px;">Value</th>
                      <th style="padding: 6px; font-size: 11px;">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="tag in createMetaTags" :key="tag.key">
                      <td style="padding: 6px; font-size: 12px;"><strong>{{ tag.key }}</strong></td>
                      <td style="padding: 6px; font-size: 12px;">{{ JSON.stringify(tag.value) }}</td>
                      <td style="padding: 6px;">
                        <button
                          class="btn-danger btn-small"
                          @click="removeCreateMetaTag(tag.key)"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div class="meta-tag-row">
                <input
                  type="text"
                  id="createMetaKey"
                  v-model="newMetaKey"
                  placeholder="key (например: company)"
                />
                <input
                  type="text"
                  id="createMetaValue"
                  v-model="newMetaValue"
                  placeholder="value (например: My Company)"
                />
                <button
                  type="button"
                  class="btn-success btn-small"
                  @click="addCreateMetaTag"
                >
                  ➕ Добавить
                </button>
              </div>
            </div>
            <div class="form-actions">
              <button type="button" class="btn-secondary" @click="closeCreateModal">Отмена</button>
              <button type="submit" class="btn-success">Создать</button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- Modal для управления meta тегами -->
    <div v-if="showMetaModalFlag" class="modal" @click.self="closeMetaModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2>🏷️ Meta теги тенанта</h2>
          <button class="modal-close" @click="closeMetaModal" title="Закрыть">×</button>
        </div>
        <div class="modal-body">
          <div class="meta-list" id="metaList">
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
                    <button
                      class="btn-danger btn-small"
                      @click="deleteMetaTag(key)"
                    >
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
                placeholder="key (например: company)"
              />
              <input
                type="text"
                id="newMetaValue"
                v-model="newMetaValueForEdit"
                placeholder="value (например: My Company)"
              />
              <button
                class="btn-success btn-small"
                @click="addMetaTag"
              >
                ➕ Добавить
              </button>
            </div>
          </div>
          <div class="form-actions">
            <button type="button" class="btn-secondary" @click="closeMetaModal">Закрыть</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal для просмотра JSON -->
    <div v-if="showInfoModalFlag" class="modal" @click.self="closeInfoModal">
      <div class="modal-content" style="max-width: 800px;" @click.stop>
        <div class="modal-header">
          <h2>📋 Информация о тенанте</h2>
          <button class="modal-close" @click="closeInfoModal" title="Закрыть">×</button>
        </div>
        <div class="modal-body">
          <div
            class="info-url"
            id="infoUrl"
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

    <!-- Modal для просмотра URL -->
    <div v-if="showUrlModalFlag" class="modal" @click.self="closeUrlModal">
      <div class="modal-content" style="max-width: 800px;" @click.stop>
        <div class="modal-header">
          <h2>🔗 URL запроса к API</h2>
          <button class="modal-close" @click="closeUrlModal" title="Закрыть">×</button>
        </div>
        <div class="modal-body">
          <div class="json-viewer" id="urlViewer">{{ generatedUrl }}</div>
          <div class="form-actions" style="margin-top: 15px;">
            <button
              type="button"
              class="btn-primary"
              id="copyUrlButton"
              @click="copyUrlToClipboard"
            >
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
import { ref, computed, onMounted, watch } from 'vue';
import { useConfigStore } from '@/app/stores/config';

// Конфигурация
const configStore = useConfigStore();

// Состояние
const apiKey = ref('');
const tenantId = ref('tnt_default');
const currentPage = ref(1);
const currentLimit = ref(20);
const totalPages = ref(1);
const totalTenants = ref(0);
const tenants = ref<any[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

// Фильтры и сортировка
const currentFilter = ref('');
const filterInput = ref('');
const selectedFilterExample = ref('');
const currentSort = ref({ field: 'createdAt', order: -1 });

// Модальные окна
const showCreateModalFlag = ref(false);
const showMetaModalFlag = ref(false);
const showInfoModalFlag = ref(false);
const showUrlModalFlag = ref(false);

// Создание тенанта
const createTenantId = ref('');
const createMetaTags = ref<Array<{ key: string; value: any }>>([]);
const newMetaKey = ref('');
const newMetaValue = ref('');

// Meta теги
const metaTenantId = ref('');
const metaTags = ref<Record<string, any> | null>(null);
const newMetaKeyForEdit = ref('');
const newMetaValueForEdit = ref('');

// Info modal
const infoUrl = ref('');
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
  return Math.min(currentPage.value * currentLimit.value, totalTenants.value);
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

  apiKey.value = extApiKey;
  tenantId.value = extTenantId || 'tnt_default';

  console.log('API Key set from external:', apiKey.value);
  console.log('Tenant ID set from external:', tenantId.value);

  loadTenants(1);
}

function getApiKey() {
  return apiKey.value;
}

async function loadTenants(page = currentPage.value, limit = currentLimit.value) {
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

    const baseUrl = configStore.config.TENANT_API_URL || '/api';
    const response = await fetch(`${baseUrl}/tenants?${params.toString()}`, {
      headers: {
        'X-API-Key': key,
        'X-Tenant-ID': tenantId.value,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    totalTenants.value = data.pagination?.total || 0;
    totalPages.value = data.pagination?.pages || 1;

    if (data.data && data.data.length > 0) {
      tenants.value = data.data;
    } else {
      tenants.value = [];
    }
  } catch (err) {
    console.error('Error loading tenants:', err);
    error.value = err instanceof Error ? err.message : 'Ошибка загрузки';
    tenants.value = [];
  } finally {
    loading.value = false;
  }
}

function goToFirstPage() {
  if (currentPage.value > 1) {
    loadTenants(1, currentLimit.value);
  }
}

function goToPreviousPage() {
  if (currentPage.value > 1) {
    loadTenants(currentPage.value - 1, currentLimit.value);
  }
}

function goToNextPage() {
  if (currentPage.value < totalPages.value) {
    loadTenants(currentPage.value + 1, currentLimit.value);
  }
}

function goToLastPage() {
  if (currentPage.value < totalPages.value) {
    loadTenants(totalPages.value, currentLimit.value);
  }
}

function goToPage(page: number) {
  if (page >= 1 && page <= totalPages.value) {
    loadTenants(page, currentLimit.value);
  } else {
    currentPageInput.value = currentPage.value;
  }
}

function changeLimit(limit: number) {
  loadTenants(1, limit);
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
  loadTenants(currentPage.value, currentLimit.value);
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
  createTenantId.value = '';
  createMetaTags.value = [];
  newMetaKey.value = '';
  newMetaValue.value = '';
}

function closeCreateModal() {
  showCreateModalFlag.value = false;
}

function addCreateMetaTag() {
  const key = newMetaKey.value.trim();
  const valueStr = newMetaValue.value.trim();

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

  if (createMetaTags.value.find((tag) => tag.key === key)) {
    alert('Мета-тег с таким ключом уже добавлен');
    return;
  }

  createMetaTags.value.push({ key, value });
  newMetaKey.value = '';
  newMetaValue.value = '';
}

function removeCreateMetaTag(key: string) {
  createMetaTags.value = createMetaTags.value.filter((tag) => tag.key !== key);
}

async function createTenant() {
  const tenantData: any = {};

  const tenantIdValue = createTenantId.value.trim();
  if (tenantIdValue) {
    tenantData.tenantId = tenantIdValue.toLowerCase().trim();
  }

  if (createMetaTags.value.length > 0) {
    tenantData.meta = {};
    for (const tag of createMetaTags.value) {
      tenantData.meta[tag.key] = tag.value;
    }
  }

  try {
    const key = getApiKey();
    const baseUrl = configStore.config.TENANT_API_URL || '/api';

    const response = await fetch(`${baseUrl}/tenants`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': key,
      },
      body: JSON.stringify(tenantData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      let errorMessage = errorData.message || 'Failed to create tenant';

      if (response.status === 400 && errorData.message?.includes('X-Tenant-Id')) {
        errorMessage =
          'Ошибка: заголовок X-Tenant-Id не должен отправляться при создании тенанта.';
      } else if (response.status === 409) {
        if (tenantIdValue) {
          errorMessage = `Тенант с ID "${tenantIdValue}" уже существует.`;
        } else {
          errorMessage = 'Ошибка: не удалось создать тенант с автоматически сгенерированным ID.';
        }
      }

      throw new Error(errorMessage);
    }

    closeCreateModal();
    loadTenants(1, currentLimit.value);
    alert('Тенант успешно создан!');
  } catch (err) {
    console.error('Error creating tenant:', err);
    alert('Ошибка создания тенанта: ' + (err instanceof Error ? err.message : 'Unknown error'));
  }
}

async function showMetaModal(tenantIdValue: string) {
  metaTenantId.value = tenantIdValue;
  showMetaModalFlag.value = true;
  await loadMetaTags(tenantIdValue);
}

function closeMetaModal() {
  showMetaModalFlag.value = false;
  metaTags.value = null;
  newMetaKeyForEdit.value = '';
  newMetaValueForEdit.value = '';
}

async function loadMetaTags(tenantIdValue: string) {
  try {
    const key = getApiKey();
    const baseUrl = configStore.config.TENANT_API_URL || '/api';

    const response = await fetch(`${baseUrl}/meta/tenant/${tenantIdValue}`, {
      headers: {
        'X-API-Key': key,
        'X-Tenant-ID': tenantId.value,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to load tenant meta');
    }

    const { data: meta } = await response.json();
    metaTags.value = meta || {};
  } catch (err) {
    console.error('Error loading meta tags:', err);
    metaTags.value = null;
  }
}

async function addMetaTag() {
  const tenantIdValue = metaTenantId.value;
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
    const baseUrl = configStore.config.TENANT_API_URL || '/api';

    const response = await fetch(`${baseUrl}/meta/tenant/${tenantIdValue}/${key}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKeyValue,
        'X-Tenant-ID': tenantId.value,
      },
      body: JSON.stringify({ value }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to set meta tag');
    }

    newMetaKeyForEdit.value = '';
    newMetaValueForEdit.value = '';
    await loadMetaTags(tenantIdValue);
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
    const baseUrl = configStore.config.TENANT_API_URL || '/api';

    const response = await fetch(`${baseUrl}/meta/tenant/${metaTenantId.value}/${key}`, {
      method: 'DELETE',
      headers: {
        'X-API-Key': apiKeyValue,
        'X-Tenant-ID': tenantId.value,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete meta tag');
    }

    await loadMetaTags(metaTenantId.value);
    alert('Meta тег успешно удален!');
  } catch (err) {
    console.error('Error deleting meta tag:', err);
    alert('Ошибка удаления meta тега: ' + (err instanceof Error ? err.message : 'Unknown error'));
  }
}

async function showInfoModal(tenantIdParam: string) {
  try {
    const key = getApiKey();
    const baseUrl = configStore.config.TENANT_API_URL || '/api';
    const url = `${baseUrl}/tenants/${tenantIdParam}`;

    infoUrl.value = url;

    const tenantResponse = await fetch(url, {
      headers: {
        'X-API-Key': key,
        'X-Tenant-ID': tenantId.value,
      },
    });

    const responseData = await tenantResponse.json();

    if (!tenantResponse.ok) {
      const errorJson = JSON.stringify(
        {
          status: tenantResponse.status,
          statusText: tenantResponse.statusText,
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
    console.error('Error loading tenant info:', err);
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

async function deleteTenant(tenantIdParam: string) {
  if (!confirm(`Вы уверены, что хотите удалить тенант "${tenantIdParam}"?`)) {
    return;
  }

  try {
    const key = getApiKey();
    const baseUrl = configStore.config.TENANT_API_URL || '/api';

    const response = await fetch(`${baseUrl}/tenants/${tenantIdParam}`, {
      method: 'DELETE',
      headers: {
        'X-API-Key': key,
        'X-Tenant-ID': tenantId.value,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete tenant');
    }

    loadTenants(currentPage.value, currentLimit.value);
    alert('Тенант успешно удален!');
  } catch (err) {
    console.error('Error deleting tenant:', err);
    alert('Ошибка удаления тенанта: ' + (err instanceof Error ? err.message : 'Unknown error'));
  }
}

function selectTenantFilterExample() {
  if (selectedFilterExample.value && selectedFilterExample.value !== 'custom') {
    filterInput.value = selectedFilterExample.value;
  } else if (selectedFilterExample.value === 'custom') {
    filterInput.value = '';
  }
}

function clearTenantFilter() {
  filterInput.value = '';
  selectedFilterExample.value = '';
  currentFilter.value = '';
  loadTenants(1, currentLimit.value);
}

function applyTenantFilter() {
  currentFilter.value = filterInput.value.trim();
  loadTenants(1, currentLimit.value);
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

  const baseUrl = configStore.config.TENANT_API_URL || '/api';
  return `${baseUrl}/tenants?${params.toString()}`;
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
  const params = getUrlParams();
  if (params.apiKey) {
    setApiKeyFromExternal(params.apiKey, params.tenantId);
  }

  // Обработка сообщений от родительского окна
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
      } else if (showMetaModalFlag.value) {
        closeMetaModal();
      } else if (showInfoModalFlag.value) {
        closeInfoModal();
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

.tenants-page {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f5f5f5;
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.header {
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

h1 {
  font-size: 16px;
  color: #495057;
  font-weight: 600;
}

.container {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: white;
  overflow: hidden;
}

.controls {
  padding: 15px 20px;
  border-bottom: 1px solid #e9ecef;
  background: #f8f9fa;
  display: flex;
  gap: 10px;
  align-items: center;
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
.form-group select {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 13px;
}

.form-group small {
  display: block;
  margin-top: 4px;
  color: #6c757d;
  font-size: 11px;
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
  border-top: 1px solid #e9ecef;
  background: #f8f9fa;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.pagination-info {
  font-size: 13px;
  color: #6c757d;
}

.pagination-controls {
  display: flex;
  gap: 8px;
  align-items: center;
}

.pagination-controls input {
  width: 60px;
  padding: 4px 8px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 12px;
  text-align: center;
}

.badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.badge-active {
  background: #d4edda;
  color: #155724;
}

.badge-inactive {
  background: #f8d7da;
  color: #721c24;
}

.badge-type {
  background: #e3f2fd;
  color: #1976d2;
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
</style>
